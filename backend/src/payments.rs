use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};
use axum_extra::extract::cookie::CookieJar;

use crate::models::{CheckoutRequest, CheckoutResponse, OrderDb, ProductDb};

#[derive(Serialize)]
struct ZarinPalRequest {
    merchant_id: String,
    amount: i64,
    callback_url: String,
    description: String,
}

#[derive(Deserialize)]
struct ZarinPalRequestData {
    code: i64,
    authority: String,
}

#[derive(Deserialize)]
struct ZarinPalRequestResponse {
    data: Option<ZarinPalRequestData>,
}

#[derive(Serialize)]
struct ZarinPalVerifyRequest {
    merchant_id: String,
    amount: i64,
    authority: String,
}

#[derive(Deserialize)]
struct ZarinPalVerifyData {
    code: i64,
    ref_id: i64,
}

#[derive(Deserialize)]
struct ZarinPalVerifyResponse {
    data: Option<ZarinPalVerifyData>,
}

#[derive(Serialize)]
struct NOWPaymentsInvoiceRequest {
    price_amount: f64,
    price_currency: &'static str,
    order_id: String,
    order_description: String,
    ipn_callback_url: String,
    success_url: String,
    cancel_url: String,
}

#[derive(Deserialize)]
struct NOWPaymentsInvoiceResponse {
    invoice_url: String,
}

#[derive(Deserialize)]
pub struct ZarinPalCallback {
    #[serde(rename = "Authority")]
    pub authority: String,
    #[serde(rename = "Status")]
    pub status: String,
}

#[derive(Deserialize)]
pub struct NOWPaymentsIPN {
    pub payment_status: String,
    pub order_id: String,
}

pub async fn checkout(
    State(pool): State<SqlitePool>,
    jar: CookieJar,
    Json(payload): Json<CheckoutRequest>,
) -> Result<Json<CheckoutResponse>, (StatusCode, String)> {
    let user_id = crate::auth::get_user_from_jar(&jar)
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let user = sqlx::query_as::<_, crate::models::User>("SELECT id, username, avatar_url, email FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let email = user.email.ok_or((StatusCode::BAD_REQUEST, "User has no email address".to_string()))?;

    let product = sqlx::query_as::<_, ProductDb>(
        "SELECT id, title, description, price, features, tags, thumbnail_url, photos, type, metadata, file_path FROM products WHERE id = ?"
    )
    .bind(&payload.product_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Product not found".to_string()))?;

    let order_id = uuid::Uuid::new_v4().to_string();
    let host_url = env::var("HOST_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());

    if payload.gateway == "zarinpal" {
        let price_db: Option<(f64,)> = sqlx::query_as(
            "SELECT price FROM product_translations WHERE product_id = ? AND language = 'fa'"
        )
        .bind(&product.id)
        .fetch_optional(&pool)
        .await
        .unwrap_or(None);

        let amount = price_db.map(|p| p.0).unwrap_or(0.0);
        if amount <= 0.0 {
            return Err((StatusCode::BAD_REQUEST, "Product price not defined in Tomans".to_string()));
        }

        sqlx::query(
            "INSERT INTO orders (id, user_id, email, product_id, amount, currency, gateway, status) VALUES (?, ?, ?, ?, ?, 'IRT', 'zarinpal', 'pending')"
        )
        .bind(&order_id)
        .bind(user_id)
        .bind(&email)
        .bind(&product.id)
        .bind(amount)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let merchant_id = env::var("ZARINPAL_MERCHANT_ID").unwrap_or_else(|_| "sandbox".to_string());
        let is_sandbox = merchant_id == "sandbox";

        let req_url = if is_sandbox {
            "https://sandbox.zarinpal.com/pg/v4/payment/request.json"
        } else {
            "https://api.zarinpal.com/pg/v4/payment/request.json"
        };

        let callback_url = format!("{}/api/payments/verify/zarinpal", host_url);

        let client = reqwest::Client::new();
        let res = client.post(req_url)
            .json(&ZarinPalRequest {
                merchant_id: merchant_id.clone(),
                amount: amount as i64,
                callback_url,
                description: format!("Purchase {}", product.id),
            })
            .send()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("ZarinPal request failed: {}", e)))?;

        let zarinpal_res: ZarinPalRequestResponse = res.json()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("ZarinPal response parse error: {}", e)))?;

        let data = zarinpal_res.data.ok_or((StatusCode::BAD_GATEWAY, "Failed to get ZarinPal authority".to_string()))?;

        sqlx::query("UPDATE orders SET ref_id = ? WHERE id = ?")
            .bind(&data.authority)
            .bind(&order_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let redirect_url = if is_sandbox {
            format!("https://sandbox.zarinpal.com/pg/StartPay/{}", data.authority)
        } else {
            format!("https://www.zarinpal.com/pg/StartPay/{}", data.authority)
        };

        Ok(Json(CheckoutResponse { redirect_url }))

    } else if payload.gateway == "crypto" {
        let price_db: Option<(f64,)> = sqlx::query_as(
            "SELECT price FROM product_translations WHERE product_id = ? AND language = 'en'"
        )
        .bind(&product.id)
        .fetch_optional(&pool)
        .await
        .unwrap_or(None);

        let amount = price_db.map(|p| p.0).unwrap_or(0.0);
        if amount <= 0.0 {
            return Err((StatusCode::BAD_REQUEST, "Product price not defined in USD".to_string()));
        }

        sqlx::query(
            "INSERT INTO orders (id, user_id, email, product_id, amount, currency, gateway, status) VALUES (?, ?, ?, ?, ?, 'USD', 'crypto', 'pending')"
        )
        .bind(&order_id)
        .bind(user_id)
        .bind(&email)
        .bind(&product.id)
        .bind(amount)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let api_key = env::var("NOWPAYMENTS_API_KEY").unwrap_or_else(|_| "sandbox".to_string());
        if api_key == "sandbox" {
            let redirect_url = format!("{}/api/payments/verify/crypto/mock?orderId={}", host_url, order_id);
            return Ok(Json(CheckoutResponse { redirect_url }));
        }

        let client = reqwest::Client::new();
        let res = client.post("https://api.nowpayments.io/v1/invoice")
            .header("x-api-key", api_key)
            .json(&NOWPaymentsInvoiceRequest {
                price_amount: amount,
                price_currency: "usd",
                order_id: order_id.clone(),
                order_description: format!("Purchase {}", product.id),
                ipn_callback_url: format!("{}/api/payments/verify/crypto", host_url),
                success_url: format!("{}/store/checkout/verify?status=success&orderId={}", host_url, order_id),
                cancel_url: format!("{}/store", host_url),
            })
            .send()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("NOWPayments request failed: {}", e)))?;

        let np_res: NOWPaymentsInvoiceResponse = res.json()
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("NOWPayments parse error: {}", e)))?;

        Ok(Json(CheckoutResponse { redirect_url: np_res.invoice_url }))

    } else {
        Err((StatusCode::BAD_REQUEST, "Unsupported gateway".to_string()))
    }
}

pub async fn verify_zarinpal(
    State(pool): State<SqlitePool>,
    Query(params): Query<ZarinPalCallback>,
) -> impl IntoResponse {
    let host_url = env::var("HOST_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());

    let order = sqlx::query_as::<_, OrderDb>("SELECT * FROM orders WHERE ref_id = ?")
        .bind(&params.authority)
        .fetch_optional(&pool)
        .await;

    let order = match order {
        Ok(Some(o)) => o,
        _ => return Redirect::to(&format!("{}/store/checkout/verify?status=failure", host_url)),
    };

    if params.status != "OK" {
        let _ = sqlx::query("UPDATE orders SET status = 'failed' WHERE id = ?")
            .bind(&order.id)
            .execute(&pool)
            .await;
        return Redirect::to(&format!("{}/store/checkout/verify?status=failure", host_url));
    }

    let merchant_id = env::var("ZARINPAL_MERCHANT_ID").unwrap_or_else(|_| "sandbox".to_string());
    let is_sandbox = merchant_id == "sandbox";
    let verify_url = if is_sandbox {
        "https://sandbox.zarinpal.com/pg/v4/payment/verify.json"
    } else {
        "https://api.zarinpal.com/pg/v4/payment/verify.json"
    };

    let client = reqwest::Client::new();
    let res = client.post(verify_url)
        .json(&ZarinPalVerifyRequest {
            merchant_id,
            amount: order.amount as i64,
            authority: params.authority.clone(),
        })
        .send()
        .await;

    let success = match res {
        Ok(resp) => {
            if let Ok(verify_resp) = resp.json::<ZarinPalVerifyResponse>().await {
                if let Some(data) = verify_resp.data {
                    data.code == 100 || data.code == 101
                } else {
                    false
                }
            } else {
                false
            }
        }
        _ => false,
    };

    if success {
        let _ = sqlx::query("UPDATE orders SET status = 'completed' WHERE id = ?")
            .bind(&order.id)
            .execute(&pool)
            .await;

        let exp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as usize + 86400;
        let claims = crate::products::DownloadClaims {
            sub: order.id.clone(),
            exp,
        };
        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(jwt_secret.as_bytes()),
        ).unwrap_or_default();

        Redirect::to(&format!("{}/store/checkout/verify?status=success&orderId={}&token={}", host_url, order.id, token))
    } else {
        let _ = sqlx::query("UPDATE orders SET status = 'failed' WHERE id = ?")
            .bind(&order.id)
            .execute(&pool)
            .await;
        Redirect::to(&format!("{}/store/checkout/verify?status=failure", host_url))
    }
}

pub async fn verify_crypto(
    State(pool): State<SqlitePool>,
    Json(payload): Json<NOWPaymentsIPN>,
) -> Result<StatusCode, (StatusCode, String)> {
    if payload.payment_status == "finished" {
        sqlx::query("UPDATE orders SET status = 'completed' WHERE id = ?")
            .bind(&payload.order_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    Ok(StatusCode::OK)
}

pub async fn verify_crypto_mock(
    State(pool): State<SqlitePool>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let host_url = env::var("HOST_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    if let Some(order_id) = params.get("orderId") {
        let _ = sqlx::query("UPDATE orders SET status = 'completed' WHERE id = ?")
            .bind(order_id)
            .execute(&pool)
            .await;
        Redirect::to(&format!("{}/store/checkout/verify?status=success&orderId={}", host_url, order_id))
    } else {
        Redirect::to(&format!("{}/store/checkout/verify?status=failure", host_url))
    }
}

pub async fn get_order_token(
    State(pool): State<SqlitePool>,
    jar: CookieJar,
    Path(order_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = crate::auth::get_user_from_jar(&jar)
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let order = sqlx::query_as::<_, OrderDb>("SELECT * FROM orders WHERE id = ?")
        .bind(&order_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Order not found".to_string()))?;

    if order.user_id != user_id {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    if order.status != "completed" {
        return Err((StatusCode::PAYMENT_REQUIRED, "Order is not completed".to_string()));
    }

    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
    let exp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as usize + 86400;
    let claims = crate::products::DownloadClaims {
        sub: order.id.clone(),
        exp,
    };
    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(jwt_secret.as_bytes()),
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "token": token })))
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

        sqlx::query(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                avatar_url TEXT NOT NULL,
                email TEXT UNIQUE
            )"
        ).execute(&pool).await.unwrap();

        sqlx::query(
            "CREATE TABLE orders (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                email TEXT NOT NULL,
                product_id TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL,
                gateway TEXT NOT NULL,
                status TEXT NOT NULL,
                ref_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )"
        ).execute(&pool).await.unwrap();

        pool
    }

    #[tokio::test]
    async fn test_verify_crypto_mock() {
        let pool = setup_test_db().await;

        sqlx::query("INSERT INTO orders (id, user_id, email, product_id, amount, currency, gateway, status) VALUES ('order123', 1, 'test@example.com', 'prod123', 10.0, 'USD', 'crypto', 'pending')")
            .execute(&pool).await.unwrap();

        let mut params = std::collections::HashMap::new();
        params.insert("orderId".to_string(), "order123".to_string());

        let res = verify_crypto_mock(State(pool.clone()), Query(params)).await.into_response();
        assert_eq!(res.status(), StatusCode::SEE_OTHER); // Redirect status

        let order: OrderDb = sqlx::query_as("SELECT * FROM orders WHERE id = 'order123'")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(order.status, "completed");
    }

    #[tokio::test]
    async fn test_get_order_token_unauthorized() {
        let pool = setup_test_db().await;
        let jar = CookieJar::new();

        let res = get_order_token(State(pool), jar, Path("order123".to_string())).await;
        assert!(res.is_err());
        let (status, msg) = res.err().unwrap();
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(msg, "Not logged in");
    }

    #[tokio::test]
    async fn test_get_order_token_non_matching_user() {
        let pool = setup_test_db().await;

        // Create user 1 (purchaser) and user 2 (attacker)
        sqlx::query("INSERT INTO users (id, username, avatar_url, email) VALUES (1, 'purchaser', 'avatar1', 'p@example.com')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO users (id, username, avatar_url, email) VALUES (2, 'attacker', 'avatar2', 'a@example.com')")
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO orders (id, user_id, email, product_id, amount, currency, gateway, status) VALUES ('order123', 1, 'p@example.com', 'prod123', 10.0, 'USD', 'crypto', 'completed')")
            .execute(&pool).await.unwrap();

        // Attacker is logged in (user_id = 2)
        let claims = crate::auth::Claims {
            sub: 2,
            exp: 100000000000,
        };
        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret("secret".as_bytes()),
        ).unwrap();

        unsafe { std::env::set_var("JWT_SECRET", "secret"); }
        let jar = CookieJar::new().add(axum_extra::extract::cookie::Cookie::new("token", token));

        let res = get_order_token(State(pool), jar, Path("order123".to_string())).await;
        assert!(res.is_err());
        let (status, msg) = res.err().unwrap();
        assert_eq!(status, StatusCode::FORBIDDEN);
        assert_eq!(msg, "Access denied");
    }

    #[tokio::test]
    async fn test_get_order_token_success() {
        let pool = setup_test_db().await;

        sqlx::query("INSERT INTO users (id, username, avatar_url, email) VALUES (1, 'purchaser', 'avatar1', 'p@example.com')")
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO orders (id, user_id, email, product_id, amount, currency, gateway, status) VALUES ('order123', 1, 'p@example.com', 'prod123', 10.0, 'USD', 'crypto', 'completed')")
            .execute(&pool).await.unwrap();

        // Purchaser is logged in (user_id = 1)
        let claims = crate::auth::Claims {
            sub: 1,
            exp: 100000000000,
        };
        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret("secret".as_bytes()),
        ).unwrap();

        unsafe { std::env::set_var("JWT_SECRET", "secret"); }
        let jar = CookieJar::new().add(axum_extra::extract::cookie::Cookie::new("token", token));

        let res = get_order_token(State(pool), jar, Path("order123".to_string())).await;
        assert!(res.is_ok());
        let json_val = res.unwrap();
        assert!(json_val.0.get("token").is_some());
    }
}
