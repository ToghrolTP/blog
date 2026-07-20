# ==============================================================================
# Stage 1: Build the frontend React app
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Build the backend Rust app
# ==============================================================================
FROM rust:1.96-slim AS backend-builder
WORKDIR /app/backend

# Install build dependencies for C libraries (openssl, sqlite)
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    gcc \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/Cargo.toml backend/Cargo.lock ./
# Create a dummy main.rs to compile and cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Copy source code and build the real binary
COPY backend/src ./src
RUN cargo build --release

# ==============================================================================
# Stage 3: Runtime image
# ==============================================================================
FROM ubuntu:24.04 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
RUN mkdir -p db uploads && chmod 777 db uploads

# Copy compiled binary and static assets
COPY --from=backend-builder /app/backend/target/release/backend ./backend
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

ENV DATABASE_URL=sqlite://db/blog.db
ENV NODE_ENV=production

EXPOSE 3000
CMD ["./backend"]
