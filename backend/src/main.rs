mod handlers;
mod models;
mod auth;
mod comments;
mod upvotes;
mod upload;
mod products;
mod payments;

use axum::{routing::{get, post, put, delete}, Router};
use dotenvy::dotenv;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{ConnectOptions, SqlitePool};
use std::env;
use std::str::FromStr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use axum::extract::{OriginalUri, Path, State};
use axum::http::StatusCode;
use axum::response::Html;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://db/blog.db".to_string());
    
    // Ensure the parent directory of the database file exists
    if let Some(path_str) = db_url.strip_prefix("sqlite://") {
        let path = std::path::Path::new(path_str);
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)?;
            }
        }
    }

    // Create the database file if it doesn't exist and connect
    let mut options = SqliteConnectOptions::from_str(&db_url)?;
    options = options
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal);
    
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // Run migrations / initialization
    init_db(&pool).await?;

    // Setup CORS
    let allowed_origins_str = env::var("CORS_ALLOWED_ORIGINS").unwrap_or_else(|_| "http://localhost:5173,http://127.0.0.1:5173,https://logfort.ir".to_string());
    let allowed_origins: Vec<axum::http::HeaderValue> = allowed_origins_str
        .split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods(vec![
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers(vec![
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::CONTENT_TYPE,
        ])
        .allow_credentials(true);

    let app = Router::new()
        .route("/api/posts", get(handlers::get_posts).post(handlers::create_post))
        .route("/api/posts/{id}", get(handlers::get_post).put(handlers::update_post).delete(handlers::delete_post))
        .route("/api/posts/{id}/comments", get(comments::get_comments).post(comments::create_comment))
        .route("/api/admin/comments", get(comments::get_all_comments_admin))
        .route("/api/comments/{id}", delete(comments::delete_comment))
        .route("/api/auth/github", get(auth::github_login))
        .route("/api/auth/github/callback", get(auth::github_callback))
        .route("/api/auth/me", get(auth::get_me))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/check-email", get(auth::check_email))
        .route("/api/auth/manual", post(auth::manual_auth))
        .route("/api/avatar/{username}", get(auth::get_avatar))
        .route("/api/user/upvotes", get(upvotes::get_user_upvotes))
        .route("/api/posts/{id}/upvote", post(upvotes::toggle_post_upvote))
        .route("/api/comments/{id}/upvote", post(upvotes::toggle_comment_upvote))
        .route("/api/upload", post(upload::upload_image))
        .route("/api/settings", get(handlers::get_settings).put(handlers::update_setting))
        .route("/api/feedbacks", post(handlers::submit_feedback))
        .route("/api/admin/feedbacks", get(handlers::get_feedbacks))
        .route("/api/admin/feedbacks/{id}", delete(handlers::delete_feedback))
        .route("/api/products", get(products::get_products).post(products::create_product))
        .route("/api/products/{id}", get(products::get_product).put(products::update_product).delete(products::delete_product))
        .route("/api/downloads/{order_id}", get(products::download_file))
        .route("/api/orders/checkout", post(payments::checkout))
        .route("/api/payments/verify/zarinpal", get(payments::verify_zarinpal))
        .route("/api/payments/verify/crypto", post(payments::verify_crypto))
        .route("/api/payments/verify/crypto/mock", get(payments::verify_crypto_mock))
        .route("/api/orders/{order_id}/token", get(payments::get_order_token))
        .route("/", get(serve_seo_home))
        .route("/fa", get(serve_seo_home))
        .route("/fa/", get(serve_seo_home))
        .route("/store/product/{id}", get(serve_seo_product))
        .route("/fa/store/product/{id}", get(serve_seo_product))
        .route("/store", get(serve_seo_store))
        .route("/fa/store", get(serve_seo_store))
        .route("/post/{id}", get(serve_seo_post))
        .route("/fa/post/{id}", get(serve_seo_post))
        .route("/about", get(serve_seo_about))
        .route("/fa/about", get(serve_seo_about))
        .route("/sitemap.xml", get(handlers::sitemap_xml))
        .route("/robots.txt", get(handlers::robots_txt))
        .layer(cors)
        .with_state(pool.clone());
    let frontend_dist = "../frontend/dist";
    let index_file = "../frontend/dist/index.html";

    let app = app
        .nest_service("/uploads", ServeDir::new("uploads"))
        .fallback_service(ServeDir::new(frontend_dist).fallback(ServeFile::new(index_file)));


    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("Server running on port 3000");
    axum::serve(listener, app).await?;

    Ok(())
}

async fn init_db(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Create posts table if not exists (with legacy fields for fresh start if needed)
    // To handle migration cleanly, we first ensure the base table exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            tags TEXT NOT NULL,
            summary TEXT,
            read_time INTEGER,
            content TEXT,
            upvotes INTEGER NOT NULL DEFAULT 0,
            thumbnail_url TEXT,
            type TEXT DEFAULT 'linux'
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            price REAL NOT NULL,
            features TEXT NOT NULL,
            tags TEXT NOT NULL,
            thumbnail_url TEXT,
            photos TEXT,
            type TEXT DEFAULT 'latex',
            metadata TEXT
        )
        "#
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query("ALTER TABLE posts ADD COLUMN type TEXT DEFAULT 'linux'")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE posts ADD COLUMN thumbnail_url TEXT")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE products ADD COLUMN thumbnail_url TEXT")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE products ADD COLUMN photos TEXT")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE products ADD COLUMN type TEXT DEFAULT 'latex'")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE products ADD COLUMN metadata TEXT")
        .execute(pool)
        .await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_translations (
            product_id TEXT NOT NULL,
            language TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            features TEXT NOT NULL,
            price REAL NOT NULL DEFAULT 0.0,
            PRIMARY KEY (product_id, language),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
        "#
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query("ALTER TABLE product_translations ADD COLUMN price REAL DEFAULT 0.0")
        .execute(pool)
        .await;

    // Migrate existing products into the english variant to prevent data loss
    sqlx::query(
        r#"
        INSERT OR IGNORE INTO product_translations (product_id, language, title, description, features, price)
        SELECT id, 'en', title, description, features, price FROM products
        "#
    )
    .execute(pool)
    .await?;

    // Also update existing english variants to have the original price just in case the migration above was already run
    let _ = sqlx::query(
        r#"
        UPDATE product_translations 
        SET price = (SELECT price FROM products WHERE products.id = product_translations.product_id)
        WHERE language = 'en' AND price = 0.0
        "#
    )
    .execute(pool)
    .await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS post_translations (
            post_id TEXT NOT NULL,
            language TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            content TEXT NOT NULL,
            read_time INTEGER NOT NULL,
            is_machine_translated BOOLEAN NOT NULL DEFAULT 0,
            PRIMARY KEY (post_id, language),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        )
        "#
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query("ALTER TABLE post_translations ADD COLUMN is_machine_translated BOOLEAN NOT NULL DEFAULT 0")
        .execute(pool)
        .await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            avatar_url TEXT NOT NULL
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT OR IGNORE INTO settings (key, value) VALUES 
        ('store_maintenance', 'false'),
        ('blog_maintenance', 'false'),
        ('comments_maintenance', 'false'),
        ('site_maintenance', 'false'),
        ('feedback_enabled', 'true'),
        ('feedback_allowed_paths', '*')
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            parent_id INTEGER,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (parent_id) REFERENCES comments(id)
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS feedbacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route TEXT NOT NULL,
            content TEXT NOT NULL,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
        "#
    )
    .execute(pool)
    .await?;

    // Create orders table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            email TEXT NOT NULL,
            product_id TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            gateway TEXT NOT NULL,
            status TEXT NOT NULL,
            ref_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
        "#
    )
    .execute(pool)
    .await?;

    // Add file_path to products table
    let _ = sqlx::query("ALTER TABLE products ADD COLUMN file_path TEXT")
        .execute(pool)
        .await;

    // Migrations to add upvotes safely
    let _ = sqlx::query("ALTER TABLE posts ADD COLUMN upvotes INTEGER NOT NULL DEFAULT 0")
        .execute(pool)
        .await; // Ignore error if column exists

    let _ = sqlx::query("ALTER TABLE comments ADD COLUMN upvotes INTEGER NOT NULL DEFAULT 0")
        .execute(pool)
        .await;
        
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN email TEXT")
        .execute(pool)
        .await;
    let _ = sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN password_hash TEXT")
        .execute(pool)
        .await;
        
    // Perform data migration from old posts structure to new
    let legacy_rows = sqlx::query_as::<_, (String, String, String, String, i64)>("SELECT id, title, summary, content, read_time FROM posts WHERE title IS NOT NULL")
        .fetch_all(pool)
        .await;
        
    if let Ok(rows) = legacy_rows {
        for (id, title, summary, content, read_time) in rows {
            let _ = sqlx::query("INSERT OR IGNORE INTO post_translations (post_id, language, title, summary, content, read_time) VALUES (?, 'en', ?, ?, ?, ?)")
                .bind(&id)
                .bind(title)
                .bind(summary)
                .bind(content)
                .bind(read_time)
                .execute(pool)
                .await;
            
            // Set the legacy columns to NULL to indicate migration complete for this row
            let _ = sqlx::query("UPDATE posts SET title = NULL, summary = NULL, content = NULL, read_time = NULL WHERE id = ?")
                .bind(&id)
                .execute(pool)
                .await;
        }
    }

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS post_upvotes (
            post_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS comment_upvotes (
            comment_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (comment_id, user_id),
            FOREIGN KEY (comment_id) REFERENCES comments(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        "#
    )
    .execute(pool)
    .await?;

    // Check if empty, if so, seed
    let count: (i64,) = sqlx::query_as("SELECT count(*) FROM posts")
        .fetch_one(pool)
        .await?;

    if count.0 == 0 {
        println!("Seeding database...");
        seed_db(pool).await?;
    }

    Ok(())
}

async fn seed_db(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    let posts = vec![
        (
            "rust-ownership-model",
            "Demystifying the Rust Ownership Model",
            "2026-05-28",
            r#"["Rust", "Memory Safety", "Systems Programming"]"#,
            "A deep dive into how Rust guarantees memory safety without a garbage collector through its unique ownership and borrowing system.",
            8,
            "Rust's ownership model is its most distinct and compelling feature. For developers coming from garbage-collected languages (like Java or Python) or manually-managed languages (like C or C++), it requires a fundamental shift in thinking.\n\n### The Problem it Solves\nIn systems programming, memory management is notoriously difficult. You either pay the runtime cost of a garbage collector (GC), pausing execution to clean up unreferenced memory, or you manually allocate and free memory, leading to notorious bugs like use-after-free, double-free, and memory leaks.\n\nRust says: *Why not neither?*\n\n### The Rules of Ownership\nRust enforces memory safety at compile time using a set of rules:\n1. Each value in Rust has a variable that's called its *owner*.\n2. There can only be one owner at a time.\n3. When the owner goes out of scope, the value will be dropped.\n\nThis simple set of rules eliminates a massive class of bugs before your code even runs.\n\n### Borrowing: Letting Others Peek\nOwnership alone would be restrictive. If I pass a variable to a function, I don't always want that function to take ownership and consume it. This is where *borrowing* comes in.\n\nUsing references (`&T`), you can allow other parts of your code to access a value without taking ownership. But there's a catch: you can have either one mutable reference (`&mut T`) OR any number of immutable references (`&T`), but not both simultaneously. This prevents data races at compile time.\n\nUnderstanding these concepts is the key to unlocking the full power of Rust. It's not just about safety; it's about shifting the cognitive load of memory management from the programmer to the compiler."
        ),
        (
            "linux-kernel-contribution",
            "My First Journey into the Linux Kernel",
            "2026-05-15",
            r#"["Linux", "Kernel", "Open Source", "C"]"#,
            "Navigating the mailing lists, understanding the workflow, and finally getting my first patch merged into the Linux kernel.",
            12,
            "Contributing to the Linux kernel is often seen as this mythical, insurmountable mountain for new developers. The codebase is massive, the workflow is seemingly antiquated (email? really?), and the maintainers are notoriously strict. \n\nHowever, my recent experience proved that while it's challenging, it's also incredibly rewarding and surprisingly accessible if you approach it the right way.\n\n### Finding a Starting Point\nDon't try to rewrite the scheduler on your first try. My approach was to use a static analysis tool (like Smatch or Coccinelle) to find minor bugs in peripheral drivers. The staging tree (`drivers/staging`) is explicitly designed for code that needs cleanup, making it a perfect playground for newcomers.\n\n### The Mighty Email Workflow\nGit was built for the Linux kernel, and the kernel relies heavily on patch series sent via email using `git send-email`. This felt like stepping back in time, but it forces a level of discipline. You can't just push a broken commit to a branch and fix it later; every patch you submit must compile and (mostly) make sense on its own.\n\n### Lessons Learned\n1.  **Read the documentation:** Specifically `Documentation/process/`. It's all there.\n2.  **Lurk before you leap:** Spend a few weeks reading the mailing list for the subsystem you want to contribute to. Get a feel for the rhythm and expectations.\n3.  **Accept criticism gracefully:** Your code will be critiqued. It's not personal. Embrace the feedback; you are learning from some of the best systems engineers in the world.\n\nMy first patch was tiny—just fixing a memory leak in an obscure network driver context path—but seeing my name in the mainline tree was an unparalleled thrill."
        ),
        (
            "why-i-use-arch-btw",
            "Yes, I Use Arch, and Here is Why",
            "2026-04-10",
            r#"["Linux", "Arch", "Dotfiles", "Productivity"]"#,
            "Cutting through the meme: A practical look at why a rolling release, DIY distribution genuinely improves my workflow.",
            6,
            "We all know the meme. But beyond the elitism, there are very practical reasons why Arch Linux remains my daily driver for software development.\n\n### The Pacman Ecosystem and AUR\nThe magic of Arch isn't just the rolling release model; it's the package manager (`pacman`) and the Arch User Repository (AUR). \n\nIf a piece of software exists for Linux, it is invariably in the AUR. On Debian or Ubuntu, I constantly found myself adding PPAs, downloading `.deb` files manually, or compiling from source. With an AUR helper (like `yay` or `paru`), installing almost anything is a single, unified command.\n\n### Zero Bloat, Complete Control\nWhen you install Ubuntu, you get Ubuntu's idea of a good desktop. When you install Arch, you get a command prompt. \n\nYou build the system up, not tear it down. For me, this means a custom Wayland compositor (Sway), exactly the terminal emulator I want (Alacritty), and precisely zero background services that I didn't explicitly enable. This creates a remarkably lean and snappy environment.\n\n### The Bleeding Edge\nAs a developer, especially when working with newer languages like Rust or modern container runtimes, having up-to-date packages is critical. On LTS distributions, I often felt constrained by years-old library versions. Arch guarantees I'm interacting with the latest upstream releases.\n\nIt requires discipline—you must read the news before upgrading—but the trade-off for a customized, frictionless development environment is entirely worth it."
        ),
        (
            "building-tui-rust",
            "Building Terminal UIs in Rust with Ratatui",
            "2026-03-22",
            r#"["Rust", "TUI", "Open Source"]"#,
            "A tutorial on creating rich, interactive command-line applications using the Ratatui library.",
            10,
            "The terminal isn't just for running sed and awk scripts; it's a powerful canvas for user interfaces. Rust, with its focus on performance and safety, is arguably the best language today for building modern Terminal User Interfaces (TUIs).\n\n### Enter Ratatui\nWhile `termion` and `crossterm` handle the low-level interactions (raw mode, event parsing), `ratatui` (a community fork of the original `tui-rs`) provides the widget rendering logic.\n\n### The Architecture of a TUI\nA typical TUI application operates in a loop:\n1.  **Poll for events:** (Keyboard input, mouse clicks, resize events).\n2.  **Update application state:** React to the inputs.\n3.  **Draw the UI:** Render widgets based on the current state.\n\nRatatui utilizes an immediate mode rendering paradigm. You don't create stateful UI objects (`Button`, `List`) and mutate them. Instead, on every frame, you declare down the entire UI tree based on your application's state.\n\n### Why I Love This Paradigm\nThis approach fits beautifully with Rust's ownership model. Because the UI is declared transiently on every frame, you don't have to worry about complex referencing or lifetimes between your data model and long-lived UI components.\n\nBuilding an interactive, responsive dashboard for a command-line tool has never been more enjoyable. The era of the sophisticated TUI is definitely here."
        )
    ];

    for (id, title, date, tags, summary, read_time, content) in posts {
        sqlx::query(
            "INSERT INTO posts (id, date, tags, summary, content, read_time, upvotes) VALUES (?, ?, ?, '', '', 0, 0)"
        )
        .bind(id)
        .bind(date)
        .bind(tags)
        .execute(pool)
        .await?;
        
        sqlx::query(
            "INSERT INTO post_translations (post_id, language, title, summary, content, read_time) VALUES (?, 'en', ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(title)
        .bind(summary)
        .bind(content)
        .bind(read_time)
        .execute(pool)
        .await?;
    }

    Ok(())
}

fn escape_html(s: &str) -> String {
    s.replace("&", "&amp;")
     .replace("<", "&lt;")
     .replace(">", "&gt;")
     .replace("\"", "&quot;")
     .replace("'", "&#x27;")
}

async fn serve_seo_post(
    uri: OriginalUri,
    Path(id): Path<String>,
    State(pool): State<SqlitePool>,
) -> Result<Html<String>, StatusCode> {
    let mut html = std::fs::read_to_string("../frontend/dist/index.html")
        .or_else(|_| std::fs::read_to_string("../frontend/index.html"))
        .unwrap_or_else(|_| "<html><head></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>".to_string());
        
    let post = sqlx::query_as::<_, crate::models::PostDb>("SELECT * FROM posts WHERE id = ?").bind(&id).fetch_optional(&pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if let Some(post) = post {
        let is_fa = uri.path().starts_with("/fa/");
        let target_lang = if is_fa { "fa" } else { "en" };
        
        let translations = sqlx::query_as::<_, crate::models::PostTranslationDb>(
            "SELECT post_id, language, title, summary, content, read_time, is_machine_translated FROM post_translations WHERE post_id = ?"
        ).bind(&id).fetch_all(&pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        if let Some(trans) = translations.iter().find(|t| t.language == target_lang) {
            let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://log40.liara.run".to_string());
            let current_url = format!("{}{}", base_url, uri.path());
            let thumb = post.thumbnail_url.unwrap_or_default();
            let absolute_thumb = if thumb.is_empty() {
                format!("{}/og-image.png", base_url)
            } else if thumb.starts_with('/') {
                format!("{}{}", base_url, thumb)
            } else {
                thumb.clone()
            };
            
            html = html.replace("<title>Log40</title>", "");
            html = html.replace("<title>Vite App</title>", "");
            html = html.replace("<meta name=\"description\" content=\"Personal blog sharing insights on software engineering, web development, and technology.\" />", "");

            let mut meta = format!(
                r#"<title>{} | Log40</title>
                <meta name="description" content="{}" />
                <link rel="canonical" href="{}" />
                <meta property="og:title" content="{}" />
                <meta property="og:description" content="{}" />
                <meta property="og:url" content="{}" />
                <meta property="og:type" content="article" />
                <meta property="og:site_name" content="Log40" />
                <meta property="og:image" content="{}" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="{}" />
                <meta name="twitter:description" content="{}" />
                <meta name="twitter:image" content="{}" />"#,
                escape_html(&trans.title), escape_html(&trans.summary), escape_html(&current_url),
                escape_html(&trans.title), escape_html(&trans.summary), escape_html(&current_url),
                escape_html(&absolute_thumb),
                escape_html(&trans.title), escape_html(&trans.summary),
                escape_html(&absolute_thumb)
            );
            
            for t in &translations {
                let alt_url = if t.language == "fa" {
                    format!("{}/fa/post/{}", base_url, id)
                } else {
                    format!("{}/post/{}", base_url, id)
                };
                meta.push_str(&format!(
                    r#"<link rel="alternate" hreflang="{}" href="{}" />"#,
                    t.language, alt_url
                ));
            }
            
            let dir = if is_fa { "rtl" } else { "ltr" };
            html = html.replace("<html lang=\"en\">", &format!("<html lang=\"{}\" dir=\"{}\">", target_lang, dir));
            
            let mut article_html = String::new();
            let parser = pulldown_cmark::Parser::new(&trans.content);
            pulldown_cmark::html::push_html(&mut article_html, parser);

            // Build body HTML containing full post contents for SEO/GEO crawlers
            let body_html = format!(
                r#"<div id="root">
                <article dir="{}">
                    <header>
                        <h1>{}</h1>
                        <time datetime="{}">{}</time>
                        <p><strong>{}</strong></p>
                    </header>
                    <section>{}</section>
                </article>
                </div>"#,
                dir, escape_html(&trans.title), escape_html(&post.date), escape_html(&post.date), escape_html(&trans.summary), article_html
            );

            // Add schema markup
            let person_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"Person","@id":"{}/#person","name":"Toghrol","url":"https://github.com/toghrol","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"],"image":"{}/avatar.png","knowsAbout":["Rust (Programming Language)","Software Engineering","Linux","Backend Development"]}}"#,
                base_url, base_url
            );
            let organization_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"Organization","@id":"{}/#organization","name":"Log40","url":"{}/","logo":"{}/favicon.png","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"]}}"#,
                base_url, base_url, base_url
            );
            let blogposting_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"BlogPosting","@id":"{}#blogposting","headline":"{}","description":"{}","url":"{}","mainEntityOfPage":{{"@type":"WebPage","@id":"{}"}},"datePublished":"{}","dateModified":"{}","author":{{"@id":"{}/#person"}},"publisher":{{"@id":"{}/#organization"}},"keywords":{}}}"#,
                current_url, escape_html(&trans.title), escape_html(&trans.summary), current_url, current_url, escape_html(&post.date), escape_html(&post.date), base_url, base_url, post.tags
            );

            meta.push_str(&format!(
                r#"<script type="application/ld+json">{}</script>
                <script type="application/ld+json">{}</script>
                <script type="application/ld+json">{}</script>"#,
                person_schema, organization_schema, blogposting_schema
            ));

            html = html.replace("<div id=\"root\"></div>", &body_html);
            return Ok(Html(html.replace("</head>", &format!("{}\n</head>", meta))));
        }
    }
    
    Ok(Html(html))
}

async fn serve_seo_product(
    uri: OriginalUri,
    Path(id): Path<String>,
    State(pool): State<SqlitePool>,
) -> Result<Html<String>, StatusCode> {
    let mut html = std::fs::read_to_string("../frontend/dist/index.html")
        .or_else(|_| std::fs::read_to_string("../frontend/index.html"))
        .unwrap_or_else(|_| "<html><head></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>".to_string());
        
    let product = sqlx::query_as::<_, crate::models::ProductDb>("SELECT * FROM products WHERE id = ?").bind(&id).fetch_optional(&pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if let Some(product) = product {
        let is_fa = uri.path().starts_with("/fa/");
        let target_lang = if is_fa { "fa" } else { "en" };
        let dir = if is_fa { "rtl" } else { "ltr" };
        let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://log40.liara.run".to_string());
        let current_url = format!("{}{}", base_url, uri.path());
        
        let translations = sqlx::query_as::<_, crate::models::ProductTranslationDb>(
            "SELECT product_id, language, title, description, features, price FROM product_translations WHERE product_id = ?"
        ).bind(&id).fetch_all(&pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        if let Some(trans) = translations.iter().find(|t| t.language == target_lang) {
            html = html.replace("<title>Log40</title>", "");
            html = html.replace("<title>Vite App</title>", "");
            html = html.replace("<meta name=\"description\" content=\"Personal blog sharing insights on software engineering, web development, and technology.\" />", "");
            
            let thumb = product.thumbnail_url.clone().unwrap_or_default();
            let absolute_thumb = if thumb.is_empty() {
                format!("{}/og-image.png", base_url)
            } else if thumb.starts_with('/') {
                format!("{}{}", base_url, thumb)
            } else {
                thumb.clone()
            };
            
            let mut meta = format!(
                r#"<title>{} | Log40</title>
                <meta name="description" content="{}" />
                <link rel="canonical" href="{}" />
                <meta property="og:title" content="{}" />
                <meta property="og:description" content="{}" />
                <meta property="og:url" content="{}" />
                <meta property="og:type" content="product" />
                <meta property="og:site_name" content="Log40" />
                <meta property="og:image" content="{}" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="{}" />
                <meta name="twitter:description" content="{}" />
                <meta name="twitter:image" content="{}" />"#,
                escape_html(&trans.title), escape_html(&trans.description), escape_html(&current_url),
                escape_html(&trans.title), escape_html(&trans.description), escape_html(&current_url),
                escape_html(&absolute_thumb),
                escape_html(&trans.title), escape_html(&trans.description),
                escape_html(&absolute_thumb)
            );
            
            for t in &translations {
                let alt_url = if t.language == "fa" {
                    format!("{}/fa/store/product/{}", base_url, id)
                } else {
                    format!("{}/store/product/{}", base_url, id)
                };
                meta.push_str(&format!(
                    r#"<link rel="alternate" hreflang="{}" href="{}" />"#,
                    t.language, alt_url
                ));
            }
            
            let person_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"Person","@id":"{}/#person","name":"Toghrol","url":"https://github.com/toghrol","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"],"image":"{}/avatar.png","knowsAbout":["Rust (Programming Language)","Software Engineering","Linux","Backend Development"]}}"#,
                base_url, base_url
            );

            let organization_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"Organization","@id":"{}/#organization","name":"Log40","url":"{}/","logo":"{}/favicon.png","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"]}}"#,
                base_url, base_url, base_url
            );

            let product_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"Product","@id":"{}#product","name":"{}","image":"{}","description":"{}","offers":{{"@type":"Offer","priceCurrency":"USD","price":{},"availability":"https://schema.org/InStock","seller":{{"@id":"{}/#organization"}}}}}}"#,
                current_url, escape_html(&trans.title), escape_html(&absolute_thumb), escape_html(&trans.description), trans.price, base_url
            );

            meta.push_str(&format!(
                r#"<script type="application/ld+json">{}</script>
                <script type="application/ld+json">{}</script>
                <script type="application/ld+json">{}</script>"#,
                person_schema, organization_schema, product_schema
            ));

            // Inject body product contents inside #root
            let features: Vec<String> = serde_json::from_str(&trans.features).unwrap_or_default();
            let mut body_html = format!(
                r#"<div id="root">
                <article dir="{}">
                    <header>
                        <h1>{}</h1>
                        <p><strong>Price:</strong> ${:.2}</p>
                    </header>
                    <section>
                        <h2>Description</h2>
                        <p>{}</p>
                        <h2>Features</h2>
                        <ul>"#,
                dir, escape_html(&trans.title), trans.price, escape_html(&trans.description)
            );
            for feat in features {
                body_html.push_str(&format!("<li>{}</li>\n", escape_html(&feat)));
            }
            body_html.push_str(
                r#"</ul>
                    </section>
                </article>
                </div>"#
            );

            html = html.replace("<html lang=\"en\">", &format!("<html lang=\"{}\" dir=\"{}\">", target_lang, dir));
            html = html.replace("<div id=\"root\"></div>", &body_html);
            return Ok(Html(html.replace("</head>", &format!("{}\n</head>", meta))));
        }
    }
    
    Err(StatusCode::NOT_FOUND)
}

async fn serve_seo_store(
    uri: OriginalUri,
    State(pool): State<SqlitePool>,
) -> Result<Html<String>, StatusCode> {
    let mut html = std::fs::read_to_string("../frontend/dist/index.html")
        .or_else(|_| std::fs::read_to_string("../frontend/index.html"))
        .unwrap_or_else(|_| "<html><head></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>".to_string());

    let products_db = sqlx::query_as::<_, crate::models::ProductDb>("SELECT * FROM products")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let is_fa = uri.path().starts_with("/fa/");
    let target_lang = if is_fa { "fa" } else { "en" };
    let dir = if is_fa { "rtl" } else { "ltr" };
    
    html = html.replace("<title>Log40</title>", "");
    html = html.replace("<title>Vite App</title>", "");
    html = html.replace("<meta name=\"description\" content=\"Personal blog sharing insights on software engineering, web development, and technology.\" />", "");
    
    let description = if is_fa {
        format!("دانلود قالب‌های LaTeX، کتاب‌های فنی و ابزارهای مهندسی. گردآوری شده توسط طغرل برای مهندسان نرم‌افزار و پژوهشگران. شامل {} محصول دیجیتال.", products_db.len())
    } else {
        format!("Download LaTeX templates, technical books, and engineering tools. Curated by Toghrol for software engineers and researchers. Explore {} digital products.", products_db.len())
    };
    
    let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://log40.liara.run".to_string());
    let current_url = format!("{}{}", base_url, uri.path());
    let store_title = if is_fa {
        "فروشگاه Log40 — قالب‌های لاتک، کتاب‌ها و ابزارهای فنی"
    } else {
        "Log40 Store — LaTeX Templates, Tech Books & Tools"
    };

    let translations_db = sqlx::query_as::<_, crate::models::ProductTranslationDb>(
        "SELECT product_id, language, title, description, features, price FROM product_translations"
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let person_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Person","@id":"{}/#person","name":"Toghrol","url":"https://github.com/toghrol","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"],"image":"{}/avatar.png","knowsAbout":["Rust (Programming Language)","Software Engineering","Linux","Backend Development"]}}"#,
        base_url, base_url
    );
    let organization_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Organization","@id":"{}/#organization","name":"Log40","url":"{}/","logo":"{}/favicon.png","description":"{}","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"]}}"#,
        base_url, base_url, base_url, escape_html(&description)
    );

    let mut list_items_json = Vec::new();
    for (idx, prod) in products_db.iter().enumerate() {
        if let Some(trans) = translations_db.iter()
            .find(|t| t.product_id == prod.id && t.language == target_lang)
            .or_else(|| translations_db.iter().find(|t| t.product_id == prod.id && t.language == "en"))
        {
            let prod_url = if is_fa {
                format!("{}/fa/store/product/{}", base_url, prod.id)
            } else {
                format!("{}/store/product/{}", base_url, prod.id)
            };
            list_items_json.push(format!(
                r#"{{"@type":"ListItem","position":{},"name":"{}","url":"{}"}}"#,
                idx + 1, escape_html(&trans.title), prod_url
            ));
        }
    }
    let list_items_str = list_items_json.join(",");
    let item_list_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"ItemList","name":"Log40 Store","description":"{}","itemListElement":[{}]}}"#,
        escape_html(&description), list_items_str
    );

    let meta = format!(
        r#"<title>{}</title>
        <meta name="description" content="{}" />
        <link rel="canonical" href="{}" />
        <link rel="alternate" hreflang="en" href="{}/store" />
        <link rel="alternate" hreflang="fa" href="{}/fa/store" />
        <meta property="og:title" content="{}" />
        <meta property="og:description" content="{}" />
        <meta property="og:url" content="{}" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Log40" />
        <meta property="og:image" content="{}/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{}" />
        <meta name="twitter:description" content="{}" />
        <meta name="twitter:image" content="{}/og-image.png" />
        <script type="application/ld+json">{}</script>
        <script type="application/ld+json">{}</script>
        <script type="application/ld+json">{}</script>"#,
        escape_html(store_title), escape_html(&description), escape_html(&current_url),
        base_url, base_url,
        escape_html(store_title), escape_html(&description), escape_html(&current_url),
        base_url,
        escape_html(store_title), escape_html(&description),
        base_url,
        person_schema, organization_schema, item_list_schema
    );
    
    // Fetch translations for pre-rendering store contents inside #root
    let mut body_html = format!(
        r#"<div id="root">
        <header>
            <h1>Store</h1>
            <p>{}</p>
        </header>
        <main>
            <ul>"#,
        escape_html(&description)
    );

    for prod in products_db {
        if let Some(trans) = translations_db.iter()
            .find(|t| t.product_id == prod.id && t.language == target_lang)
            .or_else(|| translations_db.iter().find(|t| t.product_id == prod.id && t.language == "en"))
        {
            let prod_url = if is_fa {
                format!("/fa/store/product/{}", prod.id)
            } else {
                format!("/store/product/{}", prod.id)
            };
            body_html.push_str(&format!(
                r#"<li>
                    <h3><a href="{}">{}</a></h3>
                    <p>{}</p>
                    <span>Price: ${:.2}</span>
                </li>"#,
                escape_html(&prod_url),
                escape_html(&trans.title),
                escape_html(&trans.description),
                trans.price
            ));
        }
    }

    body_html.push_str(
        r#"</ul>
        </main>
        </div>"#
    );

    html = html.replace("<html lang=\"en\">", &format!("<html lang=\"{}\" dir=\"{}\">", target_lang, dir));
    html = html.replace("<div id=\"root\"></div>", &body_html);
    Ok(Html(html.replace("</head>", &format!("{}\n</head>", meta))))
}

async fn serve_seo_home(
    uri: OriginalUri,
    State(pool): State<SqlitePool>,
) -> Result<Html<String>, StatusCode> {
    let mut html = std::fs::read_to_string("../frontend/dist/index.html")
        .or_else(|_| std::fs::read_to_string("../frontend/index.html"))
        .unwrap_or_else(|_| "<html><head></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>".to_string());

    let path = uri.path();
    let is_fa = path.starts_with("/fa");
    let target_lang = if is_fa { "fa" } else { "en" };
    let dir = if is_fa { "rtl" } else { "ltr" };
    
    // Fetch top 10 posts
    let posts_db = sqlx::query_as::<_, crate::models::PostDb>(
        "SELECT id, date, tags, upvotes, thumbnail_url, type FROM posts ORDER BY date DESC LIMIT 10"
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let translations_db = sqlx::query_as::<_, crate::models::PostTranslationDb>(
        "SELECT post_id, language, title, summary, content, read_time, is_machine_translated FROM post_translations"
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://log40.liara.run".to_string());
    let current_url = format!("{}{}", base_url, path);

    let title = if is_fa {
        "لاگ۴۰ — وبلاگ مهندسی نرم‌افزار و راست"
    } else {
        "Log40 — Software Engineering & Rust Dev Blog"
    };

    let description = if is_fa {
        "وبلاگ تخصصی مهندسی نرم‌افزار، برنامه‌نویسی راست (Rust)، کرنل لینوکس و معماری سیستم‌ها توسط طغرل در Log40. مقالات عمیق و کاربردی."
    } else {
        "Explore deep-dive software engineering tutorials, Rust programming, Linux kernel internals, and backend architecture insights by Toghrol at Log40."
    };

    html = html.replace("<title>Log40</title>", "");
    html = html.replace("<title>Vite App</title>", "");
    html = html.replace("<meta name=\"description\" content=\"Personal blog sharing insights on software engineering, web development, and technology.\" />", "");

    let person_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Person","@id":"{}/#person","name":"Toghrol","url":"https://github.com/toghrol","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"],"image":"{}/avatar.png","knowsAbout":["Rust (Programming Language)","Software Engineering","Linux","Backend Development"]}}"#,
        base_url, base_url
    );

    let organization_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Organization","@id":"{}/#organization","name":"Log40","url":"{}/","logo":"{}/favicon.png","description":"{}","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"]}}"#,
        base_url, base_url, base_url, escape_html(description)
    );

    let website_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"WebSite","@id":"{}/#website","url":"{}/","name":"Log40","description":"{}","publisher":{{"@id":"{}/#organization"}},"potentialAction":{{"@type":"SearchAction","target":{{"@type":"EntryPoint","urlTemplate":"{}/?q={{search_term_string}}"}},"query-input":"required name=search_term_string"}}}}"#,
        base_url, base_url, escape_html(description), base_url, base_url
    );

    let mut blog_posts_json = Vec::new();
    for db_post in &posts_db {
        let post_url = if is_fa {
            format!("{}/fa/post/{}", base_url, db_post.id)
        } else {
            format!("{}/post/{}", base_url, db_post.id)
        };
        blog_posts_json.push(format!(r#"{{"@type":"BlogPosting","@id":"{}#blogposting"}}"#, post_url));
    }
    let blog_posts_str = blog_posts_json.join(",");

    let blog_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Blog","@id":"{}/#blog","name":"Log40 Blog","description":"{}","publisher":{{"@id":"{}/#organization"}},"inLanguage":["en","fa"],"url":"{}","author":{{"@id":"{}/#person"}},"blogPost":[{}]}}"#,
        base_url, escape_html(description), base_url, current_url, base_url, blog_posts_str
    );

    let meta = format!(
        r#"<title>{}</title>
        <meta name="description" content="{}" />
        <link rel="canonical" href="{}" />
        <link rel="alternate" hreflang="en" href="{}/" />
        <link rel="alternate" hreflang="fa" href="{}/fa" />
        <meta property="og:title" content="{}" />
        <meta property="og:description" content="{}" />
        <meta property="og:url" content="{}" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Log40" />
        <meta property="og:image" content="{}/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{}" />
        <meta name="twitter:description" content="{}" />
        <meta name="twitter:image" content="{}/og-image.png" />
        <script type="application/ld+json">{}</script>
        <script type="application/ld+json">{}</script>
        <script type="application/ld+json">{}</script>
        <script type="application/ld+json">{}</script>"#,
        escape_html(title), escape_html(description), escape_html(&current_url),
        base_url, base_url,
        escape_html(title), escape_html(description), escape_html(&current_url),
        base_url,
        escape_html(title), escape_html(description),
        base_url,
        person_schema, organization_schema, website_schema, blog_schema
    );

    let mut body_html = format!(
        r#"<div id="root">
        <header>
            <h1>Software Engineering, Linux & Rust — Log40</h1>
            <p>{}</p>
        </header>
        <main>
            <h2>{}</h2>
            <ul>"#,
        escape_html(description),
        if is_fa { "آخرین نوشته‌ها" } else { "Latest Posts" }
    );

    for db_post in posts_db {
        if let Some(trans) = translations_db.iter().find(|t| t.post_id == db_post.id && t.language == target_lang) {
            let post_url = if is_fa {
                format!("/fa/post/{}", db_post.id)
            } else {
                format!("/post/{}", db_post.id)
            };
            body_html.push_str(&format!(
                r#"<li>
                    <h3><a href="{}">{}</a></h3>
                    <p>{}</p>
                    <time datetime="{}">{}</time>
                </li>"#,
                escape_html(&post_url),
                escape_html(&trans.title),
                escape_html(&trans.summary),
                escape_html(&db_post.date),
                escape_html(&db_post.date)
            ));
        }
    }

    body_html.push_str(
        r#"</ul>
        </main>
        </div>"#
    );

    html = html.replace("<html lang=\"en\">", &format!("<html lang=\"{}\" dir=\"{}\">", target_lang, dir));
    html = html.replace("<div id=\"root\"></div>", &body_html);
    
    Ok(Html(html.replace("</head>", &format!("{}\n</head>", meta))))
}

async fn serve_seo_about(
    uri: OriginalUri,
) -> Result<Html<String>, StatusCode> {
    let mut html = std::fs::read_to_string("../frontend/dist/index.html")
        .or_else(|_| std::fs::read_to_string("../frontend/index.html"))
        .unwrap_or_else(|_| "<html><head></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>".to_string());

    let path = uri.path();
    let is_fa = path.starts_with("/fa");
    let target_lang = if is_fa { "fa" } else { "en" };
    let dir = if is_fa { "rtl" } else { "ltr" };
    
    let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://log40.liara.run".to_string());
    let current_url = format!("{}{}", base_url, path);

    let title = if is_fa {
        "طغرل — مهندس سیستم و توسعه‌دهنده راست | Log40"
    } else {
        "Toghrol — Systems Engineer & Rust Developer | Log40"
    };

    let description = if is_fa {
        "طغرل مهندس سیستم و توسعه‌دهنده راست است که مقالاتی عمیق درباره لینوکس، مهندسی بک‌اند و ابزارهای متن‌باز می‌نویسد. بیوگرافی و مهارت‌ها را بخوانید."
    } else {
        "Toghrol is a systems engineer and Rust developer writing in-depth guides on Linux, backend engineering, and open-source tooling. Explore my bio and skills."
    };

    html = html.replace("<title>Log40</title>", "");
    html = html.replace("<title>Vite App</title>", "");
    html = html.replace("<meta name=\"description\" content=\"Personal blog sharing insights on software engineering, web development, and technology.\" />", "");

    let person_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Person","@id":"{}/#person","name":"Toghrol","url":"https://github.com/toghrol","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"],"jobTitle":"Systems & Rust Software Engineer","description":"{}","image":"{}/avatar.png","knowsAbout":["Rust (Programming Language)","Software Engineering","Linux","Backend Development"]}}"#,
        base_url, escape_html(description), base_url
    );

    let meta = format!(
        r#"<title>{}</title>
        <meta name="description" content="{}" />
        <link rel="canonical" href="{}" />
        <link rel="alternate" hreflang="en" href="{}/about" />
        <link rel="alternate" hreflang="fa" href="{}/fa/about" />
        <meta property="og:title" content="{}" />
        <meta property="og:description" content="{}" />
        <meta property="og:url" content="{}" />
        <meta property="og:type" content="profile" />
        <meta property="og:site_name" content="Log40" />
        <meta property="og:image" content="{}/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{}" />
        <meta name="twitter:description" content="{}" />
        <meta name="twitter:image" content="{}/og-image.png" />
        <script type="application/ld+json">{}</script>"#,
        escape_html(title), escape_html(description), escape_html(&current_url),
        base_url, base_url,
        escape_html(title), escape_html(description), escape_html(&current_url),
        base_url,
        escape_html(title), escape_html(description),
        base_url,
        person_schema
    );

    let body_html = if is_fa {
        format!(
            r#"<div id="root">
            <article dir="rtl">
                <header>
                    <img src="/avatar.png" alt="طغرل - مهندس سیستم و توسعه‌دهنده راست" />
                    <h1>درباره من</h1>
                </header>
                <section>
                    <p>سلام! من <strong>طغرل</strong> هستم، مهندس سیستم و توسعه‌دهنده راست. تخصص من توسعه سیستم‌های بک‌اند با کارایی بالا، ابزارهای کم‌حجم سیستمی لینوکس و رابط‌های کاربری متنی ترمینال (TUI) است. در طول سال‌ها، پروژه‌های مختلفی را توسعه داده و منتشر کرده‌ام؛ از جمله <em>porg</em> (ابزار مدیریت آرشیو و بسته‌بندی در راست)، <em>Log40</em> (همین وبلاگ و فروشگاه با کارایی بالا)، و ابزارهای خط فرمان مختلف شامل داشبورد ترمینالی با کتابخانه <em>ratatui</em> و بازی تتریس متنی ترمینال با پوسته‌های سفارشی.</p>
                    <p>من وبلاگ لاگ۴۰ را به عنوان پایگاهی برای انتشار مقالات تخصصی، تحلیل‌های عمیق روی مدل مالکیت و مدیریت حافظه در راست، معماری‌های سیستم و لینوکس راه‌اندازی کردم. تمامی ابزارها و قالب‌های موجود در فروشگاه به صورت متن‌باز یا اختصاصی برای توسعه‌دهندگانی طراحی شده‌اند که به دنبال بهبود فرآیندهای مهندسی خود هستند.</p>
                    <h2>مهارت‌های اصلی</h2>
                    <ul>
                        <li>زبان برنامه‌نویسی راست (Rust)</li>
                        <li>سیستم‌های لینوکس و ابزارهای ترمینال</li>
                        <li>توسعه بک‌اند و پایگاه‌داده (Axum, SQLite, PostgreSQL)</li>
                        <li>داکر و استقرار ابری (Docker, Liara)</li>
                    </ul>
                </section>
            </article>
            </div>"#
        )
    } else {
        format!(
            r#"<div id="root">
            <article dir="ltr">
                <header>
                    <img src="/avatar.png" alt="Toghrol - Systems & Rust Software Engineer" />
                    <h1>About Me</h1>
                </header>
                <section>
                    <p>Hello! I'm <strong>Toghrol</strong>, a systems engineer and Rust developer. I specialize in building high-performance backend systems, low-level Linux utilities, and terminal user interfaces (TUIs). Over the years, I have built and shipped projects like <em>porg</em> (a lightweight Rust packer and archive manager), <em>Log40</em> (this high-performance blogging & digital product store platform), and various command-line applications including a custom <em>ratatui</em>-based TUI dashboard and a themed terminal Tetris game.</p>
                    <p>I started Log40 as a hub for publishing technical articles, deep dives into Rust ownership and memory management models, Linux system internals, and backend architectural design. All the tools and templates featured in my store are fully open-source or curated for engineers looking to level up their development workflow.</p>
                    <h2>Core Skills</h2>
                    <ul>
                        <li>Rust Programming Language</li>
                        <li>Linux Systems & Terminal Utilities</li>
                        <li>Backend & Database Development (Axum, SQLite, PostgreSQL)</li>
                        <li>Docker & Cloud Deployment (Docker, Liara)</li>
                    </ul>
                </section>
            </article>
            </div>"#
        )
    };

    html = html.replace("<html lang=\"en\">", &format!("<html lang=\"{}\" dir=\"{}\">", target_lang, dir));
    html = html.replace("<div id=\"root\"></div>", &body_html);
    
    Ok(Html(html.replace("</head>", &format!("{}\n</head>", meta))))
}
