use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use axum_extra::extract::cookie::CookieJar;
use serde::Serialize;
use sqlx::SqlitePool;

use crate::auth::get_user_from_jar;

#[derive(Serialize)]
pub struct UpvoteResponse {
    pub upvotes: i32,
    pub has_upvoted: bool,
}

#[derive(Serialize)]
pub struct UserUpvotesResponse {
    pub posts: Vec<String>,
    pub comments: Vec<i64>,
}

pub async fn get_user_upvotes(
    State(pool): State<SqlitePool>,
    jar: CookieJar,
) -> Result<Json<UserUpvotesResponse>, (StatusCode, String)> {
    let user_id = match get_user_from_jar(&jar) {
        Some(id) => id,
        None => return Ok(Json(UserUpvotesResponse { posts: vec![], comments: vec![] })), // anonymous user has no upvotes
    };

    let posts: Vec<(String,)> = sqlx::query_as("SELECT post_id FROM post_upvotes WHERE user_id = ?")
        .bind(user_id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    let comments: Vec<(i64,)> = sqlx::query_as("SELECT comment_id FROM comment_upvotes WHERE user_id = ?")
        .bind(user_id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    Ok(Json(UserUpvotesResponse {
        posts: posts.into_iter().map(|p| p.0).collect(),
        comments: comments.into_iter().map(|c| c.0).collect(),
    }))
}

pub async fn toggle_post_upvote(
    State(pool): State<SqlitePool>,
    Path(post_id): Path<String>,
    jar: CookieJar,
) -> Result<Json<UpvoteResponse>, (StatusCode, String)> {
    let user_id = get_user_from_jar(&jar)
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let post_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM posts WHERE id = ?")
        .bind(&post_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if post_exists.0 == 0 {
        return Err((StatusCode::NOT_FOUND, "Post not found".to_string()));
    }

    let existing: Option<(String,)> = sqlx::query_as("SELECT post_id FROM post_upvotes WHERE post_id = ? AND user_id = ?")
        .bind(&post_id)
        .bind(user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut has_upvoted = false;

    if existing.is_some() {
        sqlx::query("DELETE FROM post_upvotes WHERE post_id = ? AND user_id = ?")
            .bind(&post_id)
            .bind(user_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        
        sqlx::query("UPDATE posts SET upvotes = upvotes - 1 WHERE id = ?")
            .bind(&post_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    } else {
        sqlx::query("INSERT INTO post_upvotes (post_id, user_id) VALUES (?, ?)")
            .bind(&post_id)
            .bind(user_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        sqlx::query("UPDATE posts SET upvotes = upvotes + 1 WHERE id = ?")
            .bind(&post_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        has_upvoted = true;
    }

    let upvotes: (i64,) = sqlx::query_as("SELECT upvotes FROM posts WHERE id = ?")
        .bind(&post_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(UpvoteResponse {
        upvotes: upvotes.0 as i32,
        has_upvoted,
    }))
}

pub async fn toggle_comment_upvote(
    State(pool): State<SqlitePool>,
    Path(comment_id): Path<i64>,
    jar: CookieJar,
) -> Result<Json<UpvoteResponse>, (StatusCode, String)> {
    let user_id = get_user_from_jar(&jar)
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let comment_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM comments WHERE id = ?")
        .bind(comment_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if comment_exists.0 == 0 {
        return Err((StatusCode::NOT_FOUND, "Comment not found".to_string()));
    }

    let existing: Option<(i64,)> = sqlx::query_as("SELECT comment_id FROM comment_upvotes WHERE comment_id = ? AND user_id = ?")
        .bind(comment_id)
        .bind(user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut has_upvoted = false;

    if existing.is_some() {
        sqlx::query("DELETE FROM comment_upvotes WHERE comment_id = ? AND user_id = ?")
            .bind(comment_id)
            .bind(user_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        
        sqlx::query("UPDATE comments SET upvotes = upvotes - 1 WHERE id = ?")
            .bind(comment_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    } else {
        sqlx::query("INSERT INTO comment_upvotes (comment_id, user_id) VALUES (?, ?)")
            .bind(comment_id)
            .bind(user_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        sqlx::query("UPDATE comments SET upvotes = upvotes + 1 WHERE id = ?")
            .bind(comment_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        has_upvoted = true;
    }

    let upvotes: (i64,) = sqlx::query_as("SELECT upvotes FROM comments WHERE id = ?")
        .bind(comment_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(UpvoteResponse {
        upvotes: upvotes.0 as i32,
        has_upvoted,
    }))
}
