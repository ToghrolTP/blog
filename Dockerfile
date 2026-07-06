FROM ubuntu:latest AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory to /app/backend.
# CRITICAL: the backend binary uses RELATIVE paths:
#   "../frontend/dist"            → /app/frontend/dist  (static files served by Axum)
#   "../frontend/dist/index.html" → SPA fallback for client-side routing
#   "uploads"                     → /app/backend/uploads (user-uploaded files)
#   "db/blog.db"                  --> /app/backend/db/blog.db (SQLite database)
WORKDIR /app/backend

# Create directories for persistent data (volumes will be mounted here at runtime)
RUN mkdir -p db uploads

# Copy the precompiled binary from the local build
COPY prod_build/backend ./backend

# Copy the built frontend static assets
COPY prod_build/dist /app/frontend/dist

# Environment defaults — override these at runtime via Liara env vars panel
ENV DATABASE_URL=sqlite://db/blog.db
ENV NODE_ENV=production

EXPOSE 3000

CMD ["./backend"]
