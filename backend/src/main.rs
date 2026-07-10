mod auth;
mod comments;
mod db;
mod handlers;
mod models;
mod payments;
mod products;
mod saves;
mod seo;
mod upload;
mod upvotes;

use axum::{
    Router,
    routing::{delete, get, post},
};
use dotenvy::dotenv;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::env;
use std::str::FromStr;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Ensure db/ folder is created so hook can write to it if needed
    let _ = std::fs::create_dir_all("db");

    std::panic::set_hook(Box::new(|panic_info| {
        let msg = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            *s
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.as_str()
        } else {
            "Box<Any>"
        };
        let location = panic_info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());
        let log_msg = format!("PANIC at {}: {}\n", location, msg);
        eprintln!("{}", log_msg);
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open("db/crash.log")
            .and_then(|mut f| {
                use std::io::Write;
                write!(f, "{}", log_msg)
            });
    }));

    if let Err(e) = run().await {
        let log_msg = format!("ERROR: {:?}\n", e);
        eprintln!("{}", log_msg);
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open("db/crash.log")
            .and_then(|mut f| {
                use std::io::Write;
                write!(f, "{}", log_msg)
            });
        return Err(e);
    }

    Ok(())
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://db/blog.db".to_string());

    // Ensure the parent directory of the database file exists
    if let Some(path_str) = db_url.strip_prefix("sqlite://") {
        let path = std::path::Path::new(path_str);
        if let Some(parent) = path.parent()
            && !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)?;
            }
    }

    // Create the database file if it doesn't exist and connect
    let mut options = SqliteConnectOptions::from_str(&db_url)?;
    options = options
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .pragma("foreign_keys", "on");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // Run migrations / initialization
    db::init_db(&pool).await?;

    // Setup CORS
    let allowed_origins_str = env::var("CORS_ALLOWED_ORIGINS").unwrap_or_else(|_| {
        "http://localhost:5173,http://127.0.0.1:5173,https://logfort.ir".to_string()
    });
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
        .route(
            "/api/categories",
            get(handlers::get_categories).post(handlers::create_category),
        )
        .route(
            "/api/posts",
            get(handlers::get_posts).post(handlers::create_post),
        )
        .route(
            "/api/posts/{id}",
            get(handlers::get_post)
                .put(handlers::update_post)
                .delete(handlers::delete_post),
        )
        .route(
            "/api/posts/{id}/comments",
            get(comments::get_comments).post(comments::create_comment),
        )
        .route("/api/admin/comments", get(comments::get_all_comments_admin))
        .route("/api/comments/{id}", delete(comments::delete_comment))
        .route("/api/auth/github", get(auth::github_login))
        .route("/api/auth/github/callback", get(auth::github_callback))
        .route("/api/auth/me", get(auth::get_me))
        .route(
            "/api/users/profile",
            post(auth::update_profile).delete(auth::delete_profile),
        )
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/check-email", get(auth::check_email))
        .route("/api/auth/manual", post(auth::manual_auth))
        .route("/api/auth/admin", post(auth::admin_auth))
        .route("/api/avatar/{username}", get(auth::get_avatar))
        .route("/api/user/upvotes", get(upvotes::get_user_upvotes))
        .route("/api/posts/{id}/upvote", post(upvotes::toggle_post_upvote))
        .route(
            "/api/comments/{id}/upvote",
            post(upvotes::toggle_comment_upvote),
        )
        .route("/api/user/saved-posts", get(saves::get_user_saves))
        .route("/api/posts/{id}/save", post(saves::toggle_save_post))
        .route("/api/upload", post(upload::upload_image))
        .route(
            "/api/settings",
            get(handlers::get_settings).put(handlers::update_setting),
        )
        .route("/api/feedbacks", post(handlers::submit_feedback))
        .route("/api/admin/feedbacks", get(handlers::get_feedbacks))
        .route(
            "/api/admin/feedbacks/{id}",
            delete(handlers::delete_feedback),
        )
        .route(
            "/api/products",
            get(products::get_products).post(products::create_product),
        )
        .route(
            "/api/products/{id}",
            get(products::get_product)
                .put(products::update_product)
                .delete(products::delete_product),
        )
        .route("/api/downloads/{order_id}", get(products::download_file))
        .route("/api/orders/checkout", post(payments::checkout))
        .route("/api/orders/my-downloads", get(payments::my_downloads))
        .route(
            "/api/payments/verify/zarinpal",
            get(payments::verify_zarinpal),
        )
        .route("/api/payments/verify/crypto", post(payments::verify_crypto))
        .route(
            "/api/payments/verify/crypto/mock",
            get(payments::verify_crypto_mock),
        )
        .route(
            "/api/orders/{order_id}/token",
            get(payments::get_order_token),
        )
        .route("/", get(seo::serve_seo_home))
        .route("/fa", get(seo::serve_seo_home))
        .route("/fa/", get(seo::serve_seo_home))
        .route("/store/product/{id}", get(seo::serve_seo_product))
        .route("/fa/store/product/{id}", get(seo::serve_seo_product))
        .route("/store", get(seo::serve_seo_store))
        .route("/fa/store", get(seo::serve_seo_store))
        .route("/post/{id}", get(seo::serve_seo_post))
        .route("/fa/post/{id}", get(seo::serve_seo_post))
        .route("/about", get(seo::serve_seo_about))
        .route("/fa/about", get(seo::serve_seo_about))
        .route("/sitemap.xml", get(handlers::sitemap_xml))
        .route("/robots.txt", get(handlers::robots_txt))
        .layer(cors)
        .with_state(pool.clone());
    let frontend_dist = "../frontend/dist";
    let index_file = "../frontend/dist/index.html";

    let app = app
        .nest_service("/uploads", ServeDir::new("uploads"))
        .fallback_service(ServeDir::new(frontend_dist).fallback(ServeFile::new(index_file)))
        .layer(axum::middleware::from_fn(cache_header_middleware))
        .layer(tower_http::compression::CompressionLayer::new());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("Server running on port 3000");
    use std::io::Write;
    std::io::stdout().flush().ok();
    axum::serve(listener, app).await?;

    Ok(())
}

async fn cache_header_middleware(
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let path = req.uri().path().to_string();
    let mut res = next.run(req).await;

    if path.starts_with("/assets/") || path.starts_with("/phosphoricon/") || path.starts_with("/uploads/") {
        res.headers_mut().insert(
            axum::http::header::CACHE_CONTROL,
            axum::http::HeaderValue::from_static("public, max-age=31536000, immutable"),
        );
    }
    res
}
