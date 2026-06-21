use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::SqlitePool;

use crate::models::{PostDb, PostResponse, PostTranslationDb, PostTranslationResponse};

async fn is_under_maintenance(pool: &SqlitePool, key: &str) -> bool {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);
    if let Some(r) = row {
        r.0 == "true"
    } else {
        false
    }
}

pub async fn get_posts(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
) -> Result<Json<Vec<PostResponse>>, (StatusCode, String)> {
    if is_under_maintenance(&pool, "site_maintenance").await || is_under_maintenance(&pool, "blog_maintenance").await {
        if check_auth(&headers).is_err() {
            return Err((StatusCode::SERVICE_UNAVAILABLE, "Blog is under maintenance".to_string()));
        }
    }

    let posts_db = sqlx::query_as::<_, PostDb>("SELECT id, date, tags, upvotes, thumbnail_url, type FROM posts ORDER BY date DESC")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let translations_db = sqlx::query_as::<_, PostTranslationDb>("SELECT post_id, language, title, summary, content, read_time, is_machine_translated FROM post_translations")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let mut posts = Vec::new();
    for db in posts_db {
        let tags: Vec<String> = serde_json::from_str(&db.tags).unwrap_or_default();
        let trans = translations_db.iter()
            .filter(|t| t.post_id == db.id)
            .map(|t| PostTranslationResponse {
                language: t.language.clone(),
                title: t.title.clone(),
                summary: t.summary.clone(),
                read_time: t.read_time as i32,
                content: t.content.clone(),
                is_machine_translated: t.is_machine_translated,
            })
            .collect();

        posts.push(PostResponse {
            id: db.id,
            date: db.date,
            tags,
            thumbnail_url: db.thumbnail_url,
            upvotes: db.upvotes as i32,
            translations: trans,
            type_name: db.type_name,
        });
    }

    Ok(Json(posts))
}

async fn get_post_internal(pool: &SqlitePool, id: String) -> Result<Json<PostResponse>, (StatusCode, String)> {
    let post_db = sqlx::query_as::<_, PostDb>("SELECT id, date, tags, upvotes, thumbnail_url, type FROM posts WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let db = match post_db {
        Some(db) => db,
        None => return Err((StatusCode::NOT_FOUND, "Post not found".to_string())),
    };

    let translations_db = sqlx::query_as::<_, PostTranslationDb>("SELECT post_id, language, title, summary, content, read_time, is_machine_translated FROM post_translations WHERE post_id = ?")
        .bind(&id)
        .fetch_all(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let tags: Vec<String> = serde_json::from_str(&db.tags).unwrap_or_default();
    let trans = translations_db.into_iter()
        .map(|t| PostTranslationResponse {
            language: t.language,
            title: t.title,
            summary: t.summary,
            read_time: t.read_time as i32,
            content: t.content,
            is_machine_translated: t.is_machine_translated,
        })
        .collect();

    Ok(Json(PostResponse {
        id: db.id,
        date: db.date,
        tags,
        upvotes: db.upvotes as i32,
        thumbnail_url: db.thumbnail_url,
        translations: trans,
        type_name: db.type_name,
    }))
}

pub async fn get_post(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<PostResponse>, (StatusCode, String)> {
    if is_under_maintenance(&pool, "site_maintenance").await || is_under_maintenance(&pool, "blog_maintenance").await {
        if check_auth(&headers).is_err() {
            return Err((StatusCode::SERVICE_UNAVAILABLE, "Blog is under maintenance".to_string()));
        }
    }
    get_post_internal(&pool, id).await
}

pub fn check_auth(headers: &axum::http::HeaderMap) -> Result<(), (StatusCode, String)> {
    let secret = std::env::var("ADMIN_SECRET").map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "Server misconfiguration: ADMIN_SECRET not set".to_string())
    })?;
    
    if let Some(auth_header) = headers.get(axum::http::header::AUTHORIZATION) {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str == format!("Bearer {}", secret) {
                return Ok(());
            }
        }
    }
    Err((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()))
}

pub async fn create_post(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Json(payload): Json<crate::models::CreatePostRequest>,
) -> Result<Json<PostResponse>, (StatusCode, String)> {
    check_auth(&headers)?;

    let id = payload.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    
    let tags_json = serde_json::to_string(&payload.tags).unwrap_or_else(|_| "[]".to_string());
    
    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query("INSERT INTO posts (id, date, tags, summary, content, read_time, upvotes, thumbnail_url, type) VALUES (?, ?, ?, '', '', 0, 0, ?, ?)")
        .bind(&id)
        .bind(&payload.date)
        .bind(&tags_json)
        .bind(&payload.thumbnail_url)
        .bind(&payload.type_name)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for trans in &payload.translations {
        sqlx::query("INSERT INTO post_translations (post_id, language, title, summary, content, read_time, is_machine_translated) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(&id)
            .bind(&trans.language)
            .bind(&trans.title)
            .bind(&trans.summary)
            .bind(&trans.content)
            .bind(trans.read_time)
            .bind(trans.is_machine_translated)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    get_post_internal(&pool, id).await
}

pub async fn update_post(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<crate::models::UpdatePostRequest>,
) -> Result<Json<PostResponse>, (StatusCode, String)> {
    check_auth(&headers)?;

    let tags_json = serde_json::to_string(&payload.tags).unwrap_or_else(|_| "[]".to_string());
    
    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result = sqlx::query("UPDATE posts SET date = ?, tags = ?, thumbnail_url = ?, type = ? WHERE id = ?")
        .bind(&payload.date)
        .bind(&tags_json)
        .bind(&payload.thumbnail_url)
        .bind(&payload.type_name)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Post not found".to_string()));
    }

    sqlx::query("DELETE FROM post_translations WHERE post_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for trans in &payload.translations {
        sqlx::query("INSERT INTO post_translations (post_id, language, title, summary, content, read_time, is_machine_translated) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(&id)
            .bind(&trans.language)
            .bind(&trans.title)
            .bind(&trans.summary)
            .bind(&trans.content)
            .bind(trans.read_time)
            .bind(trans.is_machine_translated)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    get_post_internal(&pool, id).await
}

pub async fn delete_post(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    check_auth(&headers)?;

    let mut tx = pool.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 1. Delete comment upvotes for this post's comments
    sqlx::query(
        "DELETE FROM comment_upvotes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)"
    )
    .bind(&id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 2. Delete comments
    sqlx::query("DELETE FROM comments WHERE post_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Delete post upvotes
    sqlx::query("DELETE FROM post_upvotes WHERE post_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 4. Delete post translations
    sqlx::query("DELETE FROM post_translations WHERE post_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 5. Delete the post itself
    let result = sqlx::query("DELETE FROM posts WHERE id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Post not found".to_string()));
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn sitemap_xml(
    State(pool): State<SqlitePool>,
) -> Result<(axum::http::HeaderMap, String), (StatusCode, String)> {
    let posts_db = sqlx::query_as::<_, PostDb>("SELECT id, date, tags, upvotes, thumbnail_url FROM posts ORDER BY date DESC")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let base_url = std::env::var("BASE_URL").unwrap_or_else(|_| "https://yourdomain.com".to_string());
    
    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
    
    // English Home
    xml.push_str(&format!(
        "  <url>\n    <loc>{}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n",
        base_url
    ));

    // Persian Home
    xml.push_str(&format!(
        "  <url>\n    <loc>{}/fa</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n",
        base_url
    ));

    // English Store
    xml.push_str(&format!(
        "  <url>\n    <loc>{}/store</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n",
        base_url
    ));

    // Persian Store
    xml.push_str(&format!(
        "  <url>\n    <loc>{}/fa/store</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n",
        base_url
    ));

    for post in posts_db {
        // English Post
        xml.push_str(&format!(
            "  <url>\n    <loc>{}/post/{}</loc>\n    <lastmod>{}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n",
            base_url, post.id, post.date
        ));
        // Persian Post
        xml.push_str(&format!(
            "  <url>\n    <loc>{}/fa/post/{}</loc>\n    <lastmod>{}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n",
            base_url, post.id, post.date
        ));
    }
    
    let products_db = sqlx::query_as::<_, crate::models::ProductDb>("SELECT * FROM products")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;
        
    for product in products_db {
        // English Product
        xml.push_str(&format!(
            "  <url>\n    <loc>{}/store/product/{}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n",
            base_url, product.id
        ));
        // Persian Product
        xml.push_str(&format!(
            "  <url>\n    <loc>{}/fa/store/product/{}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n",
            base_url, product.id
        ));
    }
    
    xml.push_str("</urlset>");

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(axum::http::header::CONTENT_TYPE, "application/xml".parse().unwrap());
    
    Ok((headers, xml))
}

pub async fn robots_txt() -> (axum::http::HeaderMap, String) {
    let base_url = std::env::var("BASE_URL").unwrap_or_else(|_| "https://yourdomain.com".to_string());
    
    let mut headers = axum::http::HeaderMap::new();
    headers.insert(axum::http::header::CONTENT_TYPE, "text/plain".parse().unwrap());
    
    let content = format!(
        "User-agent: *\nAllow: /\n\nSitemap: {}/sitemap.xml\n",
        base_url
    );
    
    (headers, content)
}

#[derive(serde::Deserialize)]
pub struct UpdateSettingRequest {
    pub key: String,
    pub value: String,
}

pub async fn get_settings(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;
    
    let mut map = serde_json::Map::new();
    for (key, value) in rows {
        let val = if value == "true" {
            serde_json::Value::Bool(true)
        } else if value == "false" {
            serde_json::Value::Bool(false)
        } else {
            serde_json::Value::String(value)
        };
        map.insert(key, val);
    }
    Ok(Json(serde_json::Value::Object(map)))
}

pub async fn update_setting(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Json(payload): Json<UpdateSettingRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    check_auth(&headers)?;
    
    if payload.key.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Key cannot be empty".to_string()));
    }
    
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(&payload.key)
        .bind(&payload.value)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;
        
    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize)]
pub struct SubmitFeedbackRequest {
    pub route: String,
    pub content: String,
}

#[derive(serde::Serialize, sqlx::FromRow)]
pub struct FeedbackDb {
    pub id: i64,
    pub route: String,
    pub content: String,
    pub user_id: Option<i64>,
    pub created_at: String,
}

#[derive(serde::Serialize)]
pub struct FeedbackResponse {
    pub id: i64,
    pub route: String,
    pub content: String,
    pub created_at: String,
    pub user: Option<crate::models::User>,
}

pub async fn submit_feedback(
    State(pool): State<SqlitePool>,
    jar: axum_extra::extract::cookie::CookieJar,
    Json(payload): Json<SubmitFeedbackRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Check if feedback is enabled
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = 'feedback_enabled'")
        .fetch_optional(&pool)
        .await
        .unwrap_or(None);
    let enabled = row.map(|r| r.0 == "true").unwrap_or(false);
    if !enabled {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "Feedback is disabled".to_string()));
    }

    // Check allowed paths
    let paths_row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = 'feedback_allowed_paths'")
        .fetch_optional(&pool)
        .await
        .unwrap_or(None);
    let allowed_paths = paths_row.map(|r| r.0).unwrap_or_else(|| "*".to_string());
    if allowed_paths != "*" && !allowed_paths.trim().is_empty() {
        let is_allowed = allowed_paths.split(',')
            .map(|s| s.trim())
            .any(|prefix| payload.route.starts_with(prefix));
        if !is_allowed {
            return Err((StatusCode::BAD_REQUEST, "Feedback not allowed on this route".to_string()));
        }
    }

    if payload.content.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Feedback content cannot be empty".to_string()));
    }

    let user_id = crate::auth::get_user_from_jar(&jar);

    sqlx::query("INSERT INTO feedbacks (route, content, user_id) VALUES (?, ?, ?)")
        .bind(&payload.route)
        .bind(&payload.content)
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok(StatusCode::OK)
}

pub async fn get_feedbacks(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
) -> Result<Json<Vec<FeedbackResponse>>, (StatusCode, String)> {
    check_auth(&headers)?;

    let rows = sqlx::query_as::<_, FeedbackDb>(
        "SELECT id, route, content, user_id, created_at FROM feedbacks ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let mut response = Vec::new();
    for row in rows {
        let user = if let Some(uid) = row.user_id {
            sqlx::query_as::<_, crate::models::User>("SELECT id, username, avatar_url FROM users WHERE id = ?")
                .bind(uid)
                .fetch_optional(&pool)
                .await
                .unwrap_or(None)
        } else {
            None
        };

        response.push(FeedbackResponse {
            id: row.id,
            route: row.route,
            content: row.content,
            created_at: row.created_at,
            user,
        });
    }

    Ok(Json(response))
}

pub async fn delete_feedback(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<StatusCode, (StatusCode, String)> {
    check_auth(&headers)?;

    sqlx::query("DELETE FROM feedbacks WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok(StatusCode::OK)
}
