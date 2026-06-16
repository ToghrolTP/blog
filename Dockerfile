# ==============================================================================
# STAGE 1: Build Frontend (Vite/React)
# ==============================================================================
FROM docker-mirror.liara.ir/node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Use Liara's NPM mirror for faster, unrestricted package downloads
RUN npm config set registry https://package-mirror.liara.ir/repository/npm/

# Copy dependency manifests first (layer cache: only re-runs npm ci if these change)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --prefer-offline

# Copy the full frontend source and build
COPY frontend/ ./
RUN npm run build

# ==============================================================================
# STAGE 2: Build Backend (Rust/Axum)
# ==============================================================================
FROM docker-mirror.liara.ir/rust:1.96-slim-bookworm AS backend-builder

# Switch APT to an Iranian mirror for faster, unrestricted package downloads
RUN sed -i 's|deb.debian.org|mirror.iranserver.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirror.iranserver.com|g' /etc/apt/sources.list 2>/dev/null || true

# Install build tools required by some crates (pkg-config is needed by several deps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Configure Cargo to use the sparse protocol for crates.io (faster, more reliable
# in restricted network environments like Iran — no need to clone the full index)
RUN mkdir -p /usr/local/cargo/registry && \
    printf '[net]\ngit-fetch-with-cli = true\n\n[registries.crates-io]\nprotocol = "sparse"\n' \
    > /usr/local/cargo/config.toml

# --- Cargo dependency caching trick ---
# Copy only manifest files first and build a dummy binary so that all
# dependency crates are downloaded and compiled.  Subsequent builds that only
# touch src/ will reuse this cached layer instead of recompiling all crates.
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir -p src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release 2>&1
RUN rm -rf src

# Copy the real source and rebuild (only application code recompiles)
COPY backend/src/ ./src/
# Touch main.rs so Cargo sees it as newer than the cached dep build
RUN touch src/main.rs
RUN cargo build --release 2>&1

# ==============================================================================
# STAGE 3: Runtime (minimal final image)
# ==============================================================================
FROM docker-mirror.liara.ir/debian:bookworm-slim AS runtime

# Switch APT to an Iranian mirror
RUN sed -i 's|deb.debian.org|mirror.iranserver.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirror.iranserver.com|g' /etc/apt/sources.list 2>/dev/null || true

# Install CA certificates (required for HTTPS calls to GitHub OAuth and any
# external APIs), plus curl for optional health-check use
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory to /app/backend.
# CRITICAL: the backend binary uses RELATIVE paths:
#   "../frontend/dist"            → /app/frontend/dist  (static files served by Axum)
#   "../frontend/dist/index.html" → SPA fallback for client-side routing
#   "uploads"                     → /app/backend/uploads (user-uploaded files)
#   "db/blog.db"                  → /app/backend/db/blog.db (SQLite database)
WORKDIR /app/backend

# Create directories for persistent data (volumes will be mounted here at runtime)
RUN mkdir -p db uploads

# Copy the compiled binary from the builder stage
COPY --from=backend-builder /app/backend/target/release/backend ./backend

# Copy the built frontend static assets from the frontend builder stage.
# Placed at /app/frontend/dist so that "../frontend/dist" resolves correctly
# relative to WORKDIR /app/backend.
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Environment defaults — override these at runtime via Liara env vars panel
ENV DATABASE_URL=sqlite://db/blog.db
ENV NODE_ENV=production

EXPOSE 3000

# Mount these paths as Liara disks to persist data across deployments
VOLUME ["/app/backend/db", "/app/backend/uploads"]

CMD ["./backend"]
