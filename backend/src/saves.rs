use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use axum_extra::extract::cookie::CookieJar;
use serde::Serialize;
use sqlx::SqlitePool;

use crate::auth::get_user_from_jar;

#[derive(Serialize)]
pub struct SaveResponse {
    pub is_saved: bool,
}

pub async fn toggle_save_post(
    State(pool): State<SqlitePool>,
    Path(post_id): Path<String>,
    jar: CookieJar,
) -> Result<Json<SaveResponse>, (StatusCode, String)> {
    let user_id =
        get_user_from_jar(&jar).ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // Check if post exists
    let post_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM posts WHERE id = ?")
        .bind(&post_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if post_exists.0 == 0 {
        return Err((StatusCode::NOT_FOUND, "Post not found".to_string()));
    }

    let existing: Option<(String,)> =
        sqlx::query_as("SELECT post_id FROM saved_posts WHERE post_id = ? AND user_id = ?")
            .bind(&post_id)
            .bind(user_id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let is_saved: bool;

    if existing.is_some() {
        sqlx::query("DELETE FROM saved_posts WHERE post_id = ? AND user_id = ?")
            .bind(&post_id)
            .bind(user_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        is_saved = false;
    } else {
        sqlx::query("INSERT INTO saved_posts (post_id, user_id) VALUES (?, ?)")
            .bind(&post_id)
            .bind(user_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        is_saved = true;
    }

    Ok(Json(SaveResponse { is_saved }))
}

pub async fn get_user_saves(
    State(pool): State<SqlitePool>,
    jar: CookieJar,
) -> Result<Json<Vec<String>>, (StatusCode, String)> {
    let user_id = match get_user_from_jar(&jar) {
        Some(id) => id,
        None => return Ok(Json(vec![])),
    };

    let posts: Vec<(String,)> = sqlx::query_as("SELECT post_id FROM saved_posts WHERE user_id = ?")
        .bind(user_id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    Ok(Json(posts.into_iter().map(|p| p.0).collect()))
}
