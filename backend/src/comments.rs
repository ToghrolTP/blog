use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
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
         ORDER BY c.upvotes DESC, c.created_at DESC"
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
    if crate::handlers::is_under_maintenance(&pool, "site_maintenance").await || crate::handlers::is_under_maintenance(&pool, "comments_maintenance").await {
        if crate::handlers::check_auth(&headers).is_err() {
            return Err((StatusCode::SERVICE_UNAVAILABLE, "Comments are under maintenance".to_string()));
        }
    }

    let user_id = get_user_from_jar(&jar)
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let result = sqlx::query(
        "INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)"
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
         ORDER BY c.created_at DESC"
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
    
    // Also delete any child comments
    let _ = sqlx::query("DELETE FROM comments WHERE parent_id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result = sqlx::query("DELETE FROM comments WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Comment not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
