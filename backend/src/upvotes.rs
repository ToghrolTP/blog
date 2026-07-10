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
        None => {
            return Ok(Json(UserUpvotesResponse {
                posts: vec![],
                comments: vec![],
            }));
        } // anonymous user has no upvotes
    };

    let posts: Vec<(String,)> =
        sqlx::query_as("SELECT post_id FROM post_upvotes WHERE user_id = ?")
            .bind(user_id)
            .fetch_all(&pool)
            .await
            .unwrap_or_default();

    let comments: Vec<(i64,)> =
        sqlx::query_as("SELECT comment_id FROM comment_upvotes WHERE user_id = ?")
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
    let user_id =
        get_user_from_jar(&jar).ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let post_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM posts WHERE id = ?")
        .bind(&post_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if post_exists.0 == 0 {
        return Err((StatusCode::NOT_FOUND, "Post not found".to_string()));
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let insert_res =
        sqlx::query("INSERT OR IGNORE INTO post_upvotes (post_id, user_id) VALUES (?, ?)")
            .bind(&post_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut has_upvoted = false;

    if insert_res.rows_affected() == 1 {
        sqlx::query("UPDATE posts SET upvotes = upvotes + 1 WHERE id = ?")
            .bind(&post_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        has_upvoted = true;
    } else {
        let delete_res = sqlx::query("DELETE FROM post_upvotes WHERE post_id = ? AND user_id = ?")
            .bind(&post_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if delete_res.rows_affected() == 1 {
            sqlx::query("UPDATE posts SET upvotes = upvotes - 1 WHERE id = ?")
                .bind(&post_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    }

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
    let user_id =
        get_user_from_jar(&jar).ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let comment_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM comments WHERE id = ?")
        .bind(comment_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if comment_exists.0 == 0 {
        return Err((StatusCode::NOT_FOUND, "Comment not found".to_string()));
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let insert_res =
        sqlx::query("INSERT OR IGNORE INTO comment_upvotes (comment_id, user_id) VALUES (?, ?)")
            .bind(comment_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut has_upvoted = false;

    if insert_res.rows_affected() == 1 {
        sqlx::query("UPDATE comments SET upvotes = upvotes + 1 WHERE id = ?")
            .bind(comment_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        has_upvoted = true;
    } else {
        let delete_res =
            sqlx::query("DELETE FROM comment_upvotes WHERE comment_id = ? AND user_id = ?")
                .bind(comment_id)
                .bind(user_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if delete_res.rows_affected() == 1 {
            sqlx::query("UPDATE comments SET upvotes = upvotes - 1 WHERE id = ?")
                .bind(comment_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    }

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use axum_extra::extract::cookie::Cookie;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        sqlx::query(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                avatar_url TEXT NOT NULL,
                email TEXT UNIQUE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

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
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE post_upvotes (
                post_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                PRIMARY KEY (post_id, user_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_toggle_post_upvote_basic() {
        let pool = setup_test_db().await;

        sqlx::query("INSERT INTO users (id, username, avatar_url, email) VALUES (1, 'user1', 'avatar', 'u1@example.com')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO posts (id, date, tags, summary, content, read_time, upvotes, type) VALUES ('post1', '2026-07-10', '[]', '', '', 0, 0, 'linux')")
            .execute(&pool).await.unwrap();

        let claims = crate::auth::Claims {
            sub: 1,
            exp: 100000000000,
        };
        let jwt_secret = std::env::var("JWT_SECRET")
            .or_else(|_| std::env::var("ADMIN_SECRET"))
            .unwrap_or_else(|_| "secret".to_string());
        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(jwt_secret.as_bytes()),
        )
        .unwrap();
        let jar = CookieJar::new().add(Cookie::new("token", token));

        // Upvote
        let res = toggle_post_upvote(State(pool.clone()), Path("post1".to_string()), jar.clone())
            .await
            .unwrap();
        assert_eq!(res.upvotes, 1);
        assert!(res.has_upvoted);

        // Downvote (toggle off)
        let res = toggle_post_upvote(State(pool.clone()), Path("post1".to_string()), jar)
            .await
            .unwrap();
        assert_eq!(res.upvotes, 0);
        assert!(!res.has_upvoted);
    }

    #[tokio::test]
    async fn test_toggle_post_upvote_concurrent() {
        let pool = setup_test_db().await;

        sqlx::query("INSERT INTO users (id, username, avatar_url, email) VALUES (1, 'user1', 'avatar', 'u1@example.com')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO posts (id, date, tags, summary, content, read_time, upvotes, type) VALUES ('post1', '2026-07-10', '[]', '', '', 0, 0, 'linux')")
            .execute(&pool).await.unwrap();

        let claims = crate::auth::Claims {
            sub: 1,
            exp: 100000000000,
        };
        let jwt_secret = std::env::var("JWT_SECRET")
            .or_else(|_| std::env::var("ADMIN_SECRET"))
            .unwrap_or_else(|_| "secret".to_string());
        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(jwt_secret.as_bytes()),
        )
        .unwrap();
        let jar = CookieJar::new().add(Cookie::new("token", token));

        let mut tasks = vec![];
        for _ in 0..10 {
            let pool_clone = pool.clone();
            let jar_clone = jar.clone();
            tasks.push(tokio::spawn(async move {
                toggle_post_upvote(State(pool_clone), Path("post1".to_string()), jar_clone).await
            }));
        }

        for task in tasks {
            let res = task.await.unwrap();
            assert!(res.is_ok());
        }

        let post_upvotes_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM post_upvotes WHERE post_id = 'post1'")
                .fetch_one(&pool)
                .await
                .unwrap();

        let post: (i64,) = sqlx::query_as("SELECT upvotes FROM posts WHERE id = 'post1'")
            .fetch_one(&pool)
            .await
            .unwrap();

        assert_eq!(post.0, post_upvotes_count.0);
        assert!(post.0 == 0 || post.0 == 1);
    }
}
