use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use axum_extra::extract::cookie::CookieJar;
use sqlx::SqlitePool;

use crate::auth::get_user_from_jar;
use crate::models::{CommentAndUserDb, CommentDb, CommentResponse, CreateCommentRequest, User};

pub async fn get_comments(
    State(pool): State<SqlitePool>,
    Path(post_id): Path<String>,
) -> Result<Json<Vec<CommentResponse>>, (StatusCode, String)> {
    let comments_db = sqlx::query_as::<_, CommentAndUserDb>(
        "SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at, c.upvotes, \
         c.user_id, u.username, u.avatar_url, u.email \
         FROM comments c \
         INNER JOIN users u ON c.user_id = u.id \
         WHERE c.post_id = ? \
         ORDER BY c.upvotes DESC, c.created_at DESC",
    )
    .bind(&post_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = comments_db
        .into_iter()
        .map(|c| CommentResponse {
            id: c.id,
            post_id: c.post_id,
            parent_id: c.parent_id,
            content: c.content,
            created_at: c.created_at,
            user: User {
                id: c.user_id,
                username: c.username,
                avatar_url: c.avatar_url,
                email: c.email,
                display_name: None,
                bio: None,
            },
            upvotes: c.upvotes as i32,
        })
        .collect();

    Ok(Json(response))
}

pub async fn create_comment(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Path(post_id): Path<String>,
    jar: CookieJar,
    Json(payload): Json<CreateCommentRequest>,
) -> Result<Json<CommentResponse>, (StatusCode, String)> {
    if (crate::handlers::is_under_maintenance(&pool, "site_maintenance").await
        || crate::handlers::is_under_maintenance(&pool, "comments_maintenance").await)
        && crate::handlers::check_auth(&headers).is_err() {
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                "Comments are under maintenance".to_string(),
            ));
        }

    let user_id =
        get_user_from_jar(&jar).ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let result = sqlx::query(
        "INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)",
    )
    .bind(&post_id)
    .bind(user_id)
    .bind(payload.parent_id)
    .bind(&payload.content)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let inserted_id = result.last_insert_rowid();

    let comment_db = sqlx::query_as::<_, CommentDb>("SELECT * FROM comments WHERE id = ?")
        .bind(inserted_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(CommentResponse {
        id: comment_db.id,
        post_id: comment_db.post_id,
        parent_id: comment_db.parent_id,
        content: comment_db.content,
        created_at: comment_db.created_at,
        user,
        upvotes: comment_db.upvotes as i32,
    }))
}

pub async fn get_all_comments_admin(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
) -> Result<Json<Vec<CommentResponse>>, (StatusCode, String)> {
    crate::handlers::check_auth(&headers)?;

    let comments_db = sqlx::query_as::<_, CommentAndUserDb>(
        "SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at, c.upvotes, \
         c.user_id, u.username, u.avatar_url, u.email \
         FROM comments c \
         INNER JOIN users u ON c.user_id = u.id \
         ORDER BY c.created_at DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = comments_db
        .into_iter()
        .map(|c| CommentResponse {
            id: c.id,
            post_id: c.post_id,
            parent_id: c.parent_id,
            content: c.content,
            created_at: c.created_at,
            user: User {
                id: c.user_id,
                username: c.username,
                avatar_url: c.avatar_url,
                email: c.email,
                display_name: None,
                bio: None,
            },
            upvotes: c.upvotes as i32,
        })
        .collect();

    Ok(Json(response))
}

pub async fn delete_comment(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Path(id): Path<i32>,
) -> Result<StatusCode, (StatusCode, String)> {
    crate::handlers::check_auth(&headers)?;

    let result = sqlx::query(
        r#"
        WITH RECURSIVE comment_tree(id) AS (
            SELECT ?
            UNION ALL
            SELECT c.id FROM comments c JOIN comment_tree ct ON c.parent_id = ct.id
        )
        DELETE FROM comments WHERE id IN comment_tree
        "#
    )
    .bind(id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Comment not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await.unwrap();

        sqlx::query(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                avatar_url TEXT NOT NULL,
                email TEXT UNIQUE
            )"
        ).execute(&pool).await.unwrap();

        sqlx::query(
            "CREATE TABLE posts (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                tags TEXT NOT NULL,
                summary TEXT NOT NULL,
                content TEXT NOT NULL,
                read_time INTEGER NOT NULL,
                upvotes INTEGER NOT NULL DEFAULT 0,
                thumbnail_url TEXT,
                type TEXT NOT NULL
            )"
        ).execute(&pool).await.unwrap();

        sqlx::query(
            "CREATE TABLE comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                parent_id INTEGER,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                upvotes INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (post_id) REFERENCES posts(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (parent_id) REFERENCES comments(id)
            )"
        ).execute(&pool).await.unwrap();

        sqlx::query(
            "CREATE TABLE comment_upvotes (
                comment_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                PRIMARY KEY (comment_id, user_id),
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )"
        ).execute(&pool).await.unwrap();

        pool
    }

    #[tokio::test]
    async fn test_recursive_comment_deletion() {
        let pool = setup_test_db().await;

        sqlx::query("INSERT INTO users (id, username, avatar_url, email) VALUES (1, 'user1', 'avatar', 'u1@example.com')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO posts (id, date, tags, summary, content, read_time, upvotes, type) VALUES ('post1', '2026-07-10', '[]', '', '', 0, 0, 'linux')")
            .execute(&pool).await.unwrap();

        // 1. Root comment
        sqlx::query("INSERT INTO comments (id, post_id, user_id, parent_id, content) VALUES (1, 'post1', 1, NULL, 'Root')")
            .execute(&pool).await.unwrap();
        // 2. Child comment (reply to Root)
        sqlx::query("INSERT INTO comments (id, post_id, user_id, parent_id, content) VALUES (2, 'post1', 1, 1, 'Child')")
            .execute(&pool).await.unwrap();
        // 3. Grandchild comment (reply to Child)
        sqlx::query("INSERT INTO comments (id, post_id, user_id, parent_id, content) VALUES (3, 'post1', 1, 2, 'Grandchild')")
            .execute(&pool).await.unwrap();

        // Upvotes for child and grandchild comments
        sqlx::query("INSERT INTO comment_upvotes (comment_id, user_id) VALUES (2, 1)")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO comment_upvotes (comment_id, user_id) VALUES (3, 1)")
            .execute(&pool).await.unwrap();

        let secret = std::env::var("ADMIN_SECRET").unwrap_or_else(|_| "test_secret".to_string());
        let mut headers = axum::http::HeaderMap::new();
        headers.insert("Authorization", axum::http::HeaderValue::from_str(&format!("Bearer {}", secret)).unwrap());
        if std::env::var("ADMIN_SECRET").is_err() {
            unsafe { std::env::set_var("ADMIN_SECRET", "test_secret"); }
        }

        let res = delete_comment(headers, State(pool.clone()), Path(1)).await.unwrap();
        assert_eq!(res, StatusCode::NO_CONTENT);

        // Verify all comments are deleted
        let comments_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM comments")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(comments_count.0, 0);

        // Verify upvotes are cascaded and deleted
        let upvotes_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM comment_upvotes")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(upvotes_count.0, 0);
    }
}
