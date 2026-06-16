# LogFort

A bilingual (English / فارسی) tech blog and digital product store, built with Rust and React.

**Live at:** [logfort.ir](https://logfort.ir)

## Tech Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Backend  | Rust 2024, Axum 0.8, SQLx                       |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4    |
| Database | SQLite (WAL mode)                                |
| Auth     | GitHub OAuth2 + JWT sessions                     |
| Deploy   | Docker (multi-stage) → Liara PaaS                |

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── main.rs          # Entry point, routes, migrations, SSR
│   │   ├── handlers.rs      # Post CRUD, sitemap, robots.txt
│   │   ├── products.rs      # Product CRUD with i18n
│   │   ├── comments.rs      # Threaded comments
│   │   ├── auth.rs          # GitHub OAuth2 + JWT
│   │   ├── upvotes.rs       # Post & comment upvotes
│   │   ├── models.rs        # Data models
│   │   └── upload.rs        # Image upload handler
│   ├── db/                  # SQLite database (gitignored)
│   ├── uploads/             # User-uploaded images (gitignored)
│   ├── Cargo.toml
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Main app, routing, home page
│   │   ├── components/       # UI components
│   │   ├── contexts/         # Auth, Language, Upvote contexts
│   │   └── i18n/             # en.json, fa.json translations
│   ├── public/               # Static assets (pixel art icons)
│   ├── phosphoricon/         # Phosphor icon set
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile                # Multi-stage build
├── .dockerignore
├── liara.json                # Liara deployment config
└── .gitignore
```

## Prerequisites

- [Rust](https://rustup.rs/) (stable, edition 2024)
- [Node.js](https://nodejs.org/) (v20+)
- A [GitHub OAuth App](https://github.com/settings/developers) for authentication

## Local Development

### 1. Set up environment variables

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your actual values
```

### 2. Run the backend

```bash
cd backend
cargo run
```

The backend serves on `http://localhost:3000`. On first run, it creates the SQLite database and runs migrations automatically.

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies API requests to the backend.

## Environment Variables

| Variable               | Description                          |
| ---------------------- | ------------------------------------ |
| `DATABASE_URL`         | SQLite connection string             |
| `ADMIN_SECRET`         | Secret for admin panel access        |
| `GITHUB_CLIENT_ID`     | GitHub OAuth app client ID           |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret       |

## Deployment

The project deploys to [Liara](https://liara.ir) using Docker:

```bash
liara deploy
```

The `Dockerfile` runs a multi-stage build:
1. **Frontend** — `npm ci` + `vite build`
2. **Backend** — `cargo build --release`
3. **Runtime** — Minimal Debian image with the compiled binary and built frontend

Persistent data (database and uploads) is stored on Liara disks that survive redeployments.
