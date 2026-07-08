use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect},
    Json,
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use oauth2::{
    basic::BasicClient, reqwest::async_http_client, AuthUrl, AuthorizationCode, ClientId,
    ClientSecret, CsrfToken, Scope, TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::User;

#[derive(Debug, Deserialize)]
pub struct AuthRequest {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Deserialize)]
struct GithubUser {
    id: i64,
    login: String,
    avatar_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64,
    pub exp: usize,
}

fn oauth_client() -> BasicClient {
    let client_id = ClientId::new(env::var("GITHUB_CLIENT_ID").unwrap_or_default());
    let client_secret = ClientSecret::new(env::var("GITHUB_CLIENT_SECRET").unwrap_or_default());
    let auth_url = AuthUrl::new("https://github.com/login/oauth/authorize".to_string()).unwrap();
    let token_url = TokenUrl::new("https://github.com/login/oauth/access_token".to_string()).unwrap();

    BasicClient::new(client_id, Some(client_secret), auth_url, Some(token_url))
}

pub async fn github_login() -> impl IntoResponse {
    let client = oauth_client();
    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("read:user".to_string()))
        .url();

    Redirect::to(auth_url.as_ref())
}

pub async fn github_callback(
    Query(query): Query<AuthRequest>,
    State(pool): State<SqlitePool>,
    jar: CookieJar,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let client = oauth_client();
    let token_result = client
        .exchange_code(AuthorizationCode::new(query.code))
        .request_async(async_http_client)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let access_token = token_result.access_token().secret();

    let req_client = reqwest::Client::new();
    let user_res = req_client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "log40-app")
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let github_user: GithubUser = user_res
        .json()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Upsert user
    sqlx::query(
        "INSERT INTO users (id, username, avatar_url) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET username = excluded.username, avatar_url = excluded.avatar_url"
    )
    .bind(github_user.id)
    .bind(&github_user.login)
    .bind(&github_user.avatar_url)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create JWT
    let exp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize
        + 60 * 60 * 24 * 7; // 7 days

    let claims = Claims { sub: github_user.id, exp };
    let jwt_secret = env::var("JWT_SECRET").or_else(|_| env::var("ADMIN_SECRET")).map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "Server misconfiguration: JWT_SECRET or ADMIN_SECRET not set".to_string())
    })?;
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut cookie = Cookie::new("token", token);
    cookie.set_path("/");
    cookie.set_http_only(true);
    cookie.set_same_site(axum_extra::extract::cookie::SameSite::Lax);
    cookie.set_secure(env::var("NODE_ENV").unwrap_or_default() == "production");
    cookie.set_max_age(time::Duration::days(7));

    // Redirect back to frontend
    Ok((jar.add(cookie), Redirect::to("/")))
}

pub fn get_user_from_jar(jar: &CookieJar) -> Option<i64> {
    let cookie = jar.get("token")?;
    let jwt_secret = env::var("JWT_SECRET").or_else(|_| env::var("ADMIN_SECRET")).ok()?;
    let token_data = decode::<Claims>(
        cookie.value(),
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    ).ok()?;
    Some(token_data.claims.sub)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfileResponse {
    pub id: i64,
    pub username: String,
    pub avatar_url: String,
    pub email: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub bio: Option<String>,
    #[serde(rename = "savedPostIds")]
    pub saved_post_ids: Vec<String>,
    #[serde(rename = "purchasedTemplateIds")]
    pub purchased_template_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub bio: Option<String>,
    pub password: Option<String>,
}

pub async fn get_me(
    State(pool): State<SqlitePool>,
    jar: CookieJar,
) -> Result<Json<UserProfileResponse>, (StatusCode, String)> {
    let user_id = get_user_from_jar(&jar)
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let saved_posts: Vec<String> = sqlx::query_scalar("SELECT post_id FROM post_upvotes WHERE user_id = ?")
        .bind(user_id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    let purchased_templates: Vec<String> = sqlx::query_scalar(
        "SELECT o.product_id FROM orders o JOIN products p ON o.product_id = p.id WHERE o.user_id = ? AND o.status = 'completed' AND p.type = 'latex'"
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    Ok(Json(UserProfileResponse {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        saved_post_ids: saved_posts,
        purchased_template_ids: purchased_templates,
    }))
}

pub async fn update_profile(
    State(pool): State<SqlitePool>,
    jar: CookieJar,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<UserProfileResponse>, (StatusCode, String)> {
    let user_id = get_user_from_jar(&jar)
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let username_clean = payload.username.trim();
    if username_clean.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Username cannot be empty".to_string()));
    }

    let username_taken = sqlx::query("SELECT 1 FROM users WHERE username = ? AND id != ?")
        .bind(username_clean)
        .bind(user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if username_taken.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Username already taken".to_string()));
    }

    let email_clean = payload.email.as_ref().map(|e| e.trim().to_lowercase());
    if let Some(ref email) = email_clean {
        if !email.is_empty() {
            let email_taken = sqlx::query("SELECT 1 FROM users WHERE email = ? AND id != ?")
                .bind(email)
                .bind(user_id)
                .fetch_optional(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            if email_taken.is_some() {
                return Err((StatusCode::BAD_REQUEST, "Email address already in use".to_string()));
            }
        }
    }

    let display_name_clean = payload.display_name.as_ref().map(|d| d.trim().to_string());
    let bio_clean = payload.bio.as_ref().map(|b| b.trim().to_string());

    let mut tx = pool.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(ref password) = payload.password {
        if !password.is_empty() {
            let hashed = bcrypt::hash(password, bcrypt::DEFAULT_COST)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            sqlx::query("UPDATE users SET password_hash = ? WHERE id = ?")
                .bind(&hashed)
                .bind(user_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    }

    sqlx::query("UPDATE users SET username = ?, email = ?, display_name = ?, bio = ?, avatar_url = ? WHERE id = ?")
        .bind(username_clean)
        .bind(email_clean)
        .bind(display_name_clean)
        .bind(bio_clean)
        .bind(format!("/api/avatar/{}", username_clean))
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let saved_posts: Vec<String> = sqlx::query_scalar("SELECT post_id FROM post_upvotes WHERE user_id = ?")
        .bind(user_id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    let purchased_templates: Vec<String> = sqlx::query_scalar(
        "SELECT o.product_id FROM orders o JOIN products p ON o.product_id = p.id WHERE o.user_id = ? AND o.status = 'completed' AND p.type = 'latex'"
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    Ok(Json(UserProfileResponse {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        saved_post_ids: saved_posts,
        purchased_template_ids: purchased_templates,
    }))
}

pub async fn logout() -> impl IntoResponse {
    let cookie = Cookie::build(("token", ""))
        .path("/")
        .http_only(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .secure(env::var("NODE_ENV").unwrap_or_default() == "production")
        .max_age(time::Duration::seconds(0))
        .build();

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        axum::http::header::SET_COOKIE,
        cookie.to_string().parse().unwrap(),
    );

    (headers, Json("Logged out"))
}

#[derive(Debug, Deserialize)]
pub struct CheckEmailQuery {
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct CheckEmailResponse {
    pub exists: bool,
}

pub async fn check_email(
    Query(query): Query<CheckEmailQuery>,
    State(pool): State<SqlitePool>,
) -> Result<Json<CheckEmailResponse>, (StatusCode, String)> {
    let email_clean = query.email.trim().to_lowercase();
    let row = sqlx::query("SELECT 1 FROM users WHERE email = ?")
        .bind(&email_clean)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(CheckEmailResponse { exists: row.is_some() }))
}

pub async fn get_avatar(
    Path(username): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    use dicebear_core::{Avatar, Style};
    use serde_json::json;

    let style = Style::from_str(dicebear_styles::GLYPHS)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse style: {}", e)))?;

    let avatar = Avatar::new(&style, json!({
      "glyphColor": [
        "928374",
        "3c3836",
        "fb4934",
        "cc241d",
        "d65d0e",
        "fe8019",
        "d79921",
        "fabd2f",
        "98971a",
        "b8bb26",
        "689d6a",
        "8ec07c",
        "458588",
        "83a598",
        "b16286",
        "d3869b"
      ],
      "glyphColorAngle": 143,
      "seed": username
    })).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create avatar: {}", e)))?;

    let svg = avatar.to_svg().to_string();

    Ok((
        [("content-type", "image/svg+xml")],
        svg,
    ))
}

#[derive(Debug, Deserialize)]
pub struct ManualAuthRequest {
    pub email: String,
    pub password: String,
    pub username: Option<String>,
}

pub async fn manual_auth(
    State(pool): State<SqlitePool>,
    jar: CookieJar,
    Json(payload): Json<ManualAuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let email_clean = payload.email.trim().to_lowercase();
    if email_clean.is_empty() || payload.password.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Email and password are required".to_string()));
    }

    // Check if user exists
    let existing_user = sqlx::query_as::<_, User>("SELECT id, username, avatar_url, email, display_name, bio FROM users WHERE email = ?")
        .bind(&email_clean)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user_id: i64;
    let final_user: User;

    if let Some(user) = existing_user {
        // User exists: verify password
        let db_row = sqlx::query("SELECT password_hash FROM users WHERE id = ?")
            .bind(user.id)
            .fetch_one(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        
        let password_hash: String = sqlx::Row::get(&db_row, "password_hash");

        let matches = bcrypt::verify(&payload.password, &password_hash)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if !matches {
            return Err((StatusCode::UNAUTHORIZED, "Invalid password".to_string()));
        }

        user_id = user.id;
        final_user = user;
    } else {
        // User does not exist: register new user
        let username = payload.username.filter(|u| !u.trim().is_empty())
            .unwrap_or_else(|| email_clean.split('@').next().unwrap_or("user").to_string());
        let avatar_url = format!("/api/avatar/{}", username);

        let hashed = bcrypt::hash(&payload.password, bcrypt::DEFAULT_COST)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let res = sqlx::query(
            "INSERT INTO users (username, avatar_url, email, password_hash) VALUES (?, ?, ?, ?)"
        )
        .bind(&username)
        .bind(&avatar_url)
        .bind(&email_clean)
        .bind(&hashed)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        user_id = res.last_insert_rowid();
        
        final_user = User {
            id: user_id,
            username,
            avatar_url,
            email: Some(email_clean),
            display_name: None,
            bio: None,
        };
    }

    // Create JWT
    let exp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize
        + 60 * 60 * 24 * 7; // 7 days

    let claims = Claims { sub: user_id, exp };
    let jwt_secret = env::var("JWT_SECRET").or_else(|_| env::var("ADMIN_SECRET")).map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "Server misconfiguration: JWT_SECRET or ADMIN_SECRET not set".to_string())
    })?;
    
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut cookie = Cookie::new("token", token);
    cookie.set_path("/");
    cookie.set_http_only(true);
    cookie.set_same_site(axum_extra::extract::cookie::SameSite::Lax);
    cookie.set_secure(env::var("NODE_ENV").unwrap_or_default() == "production");
    cookie.set_max_age(time::Duration::days(7));

    Ok((jar.add(cookie), Json(final_user)))
}

#[derive(Debug, Deserialize)]
pub struct AdminAuthRequest {
    pub secret: String,
}

pub async fn admin_auth(
    Json(payload): Json<AdminAuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let expected_secret = env::var("ADMIN_SECRET").map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "Server misconfiguration: ADMIN_SECRET not set".to_string())
    })?;

    if payload.secret == expected_secret {
        Ok(StatusCode::OK)
    } else {
        Err((StatusCode::UNAUTHORIZED, "Invalid secret key".to_string()))
    }
}

