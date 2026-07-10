use crate::models::{
    CreateProductRequest, ProductDb, ProductResponse, ProductTranslationDb,
    ProductTranslationResponse, UpdateProductRequest,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;
use sqlx::SqlitePool;


pub async fn get_products(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Query(params): Query<Vec<(String, String)>>,
) -> Result<Json<Vec<ProductResponse>>, (StatusCode, String)> {
    if (crate::handlers::is_under_maintenance(&pool, "store_maintenance").await
        || crate::handlers::is_under_maintenance(&pool, "site_maintenance").await)
        && crate::handlers::check_auth(&headers).is_err() {
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                "Store is under maintenance".to_string(),
            ));
        }

    let tags: Vec<String> = params
        .into_iter()
        .filter_map(|(k, v)| if k == "tag" { Some(v) } else { None })
        .collect();

    let products_db = sqlx::query_as::<_, ProductDb>("SELECT id, title, description, price, features, tags, thumbnail_url, photos, type, metadata, file_path FROM products")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let translations_db = sqlx::query_as::<_, ProductTranslationDb>("SELECT product_id, language, title, description, features, price FROM product_translations")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let mut products = Vec::new();
    for db in products_db {
        let db_tags: Vec<String> = serde_json::from_str(&db.tags).unwrap_or_default();
        let photos: Vec<String> =
            serde_json::from_str(db.photos.as_deref().unwrap_or("[]")).unwrap_or_default();

        let mut should_include = true;
        for t in &tags {
            if !db_tags.contains(t) {
                should_include = false;
                break;
            }
        }

        if should_include {
            let mut product_translations = Vec::new();
            for t in &translations_db {
                if t.product_id == db.id {
                    let features: Vec<String> =
                        serde_json::from_str(&t.features).unwrap_or_default();
                    product_translations.push(ProductTranslationResponse {
                        language: t.language.clone(),
                        title: t.title.clone(),
                        description: t.description.clone(),
                        features,
                        price: t.price,
                    });
                }
            }

            products.push(ProductResponse {
                id: db.id,
                tags: db_tags,
                thumbnail_url: db.thumbnail_url,
                photos,
                translations: product_translations,
                type_name: db.type_name,
                metadata: db.metadata.and_then(|m| serde_json::from_str(&m).ok()),
                file_path: db.file_path,
            });
        }
    }
    Ok(Json(products))
}

pub async fn get_product(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<ProductResponse>, (StatusCode, String)> {
    if (crate::handlers::is_under_maintenance(&pool, "store_maintenance").await
        || crate::handlers::is_under_maintenance(&pool, "site_maintenance").await)
        && crate::handlers::check_auth(&headers).is_err() {
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                "Store is under maintenance".to_string(),
            ));
        }

    let db = sqlx::query_as::<_, ProductDb>("SELECT id, title, description, price, features, tags, thumbnail_url, photos, type, metadata, file_path FROM products WHERE id = ?")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    match db {
        Some(db) => {
            let tags: Vec<String> = serde_json::from_str(&db.tags).unwrap_or_default();
            let photos: Vec<String> =
                serde_json::from_str(db.photos.as_deref().unwrap_or("[]")).unwrap_or_default();

            let db_translations = sqlx::query_as::<_, ProductTranslationDb>("SELECT product_id, language, title, description, features, price FROM product_translations WHERE product_id = ?")
                .bind(&id)
                .fetch_all(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Translation database error: {}", e)))?;

            let mut translations = Vec::new();
            for t in db_translations {
                let features: Vec<String> = serde_json::from_str(&t.features).unwrap_or_default();
                translations.push(ProductTranslationResponse {
                    language: t.language,
                    title: t.title,
                    description: t.description,
                    features,
                    price: t.price,
                });
            }

            Ok(Json(ProductResponse {
                id: db.id,
                tags,
                thumbnail_url: db.thumbnail_url,
                photos,
                translations,
                type_name: db.type_name,
                metadata: db.metadata.and_then(|m| serde_json::from_str(&m).ok()),
                file_path: db.file_path,
            }))
        }
        None => Err((StatusCode::NOT_FOUND, "Product not found".to_string())),
    }
}

pub async fn create_product(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Json(payload): Json<CreateProductRequest>,
) -> Result<Json<ProductResponse>, (StatusCode, String)> {
    crate::handlers::check_auth(&headers)?;

    if payload.translations.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "At least one translation is required".to_string(),
        ));
    }
    for t in &payload.translations {
        if t.title.trim().is_empty() || t.description.trim().is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                "Title and description are required".to_string(),
            ));
        }
        if t.price < 0.0 {
            return Err((
                StatusCode::BAD_REQUEST,
                "Price cannot be negative".to_string(),
            ));
        }
    }

    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let tags_json = serde_json::to_string(&payload.tags).unwrap_or_else(|_| "[]".to_string());
    let photos_json = serde_json::to_string(&payload.photos).unwrap_or_else(|_| "[]".to_string());
    let metadata_str = payload
        .metadata
        .as_ref()
        .and_then(|m| serde_json::to_string(m).ok());

    // Insert dormant fields as empty/0.0 to satisfy NOT NULL constraints
    sqlx::query("INSERT INTO products (id, title, description, price, features, tags, thumbnail_url, photos, type, metadata, file_path) VALUES (?, '', '', 0.0, '[]', ?, ?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&tags_json)
        .bind(&payload.thumbnail_url)
        .bind(&photos_json)
        .bind(&payload.type_name)
        .bind(&metadata_str)
        .bind(&payload.file_path)
        .execute(&pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e
                && db_err.is_unique_violation() {
                    return (StatusCode::CONFLICT, "Product with this ID already exists".to_string());
                }
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

    let mut response_translations = Vec::new();
    for t in payload.translations {
        let features_json = serde_json::to_string(&t.features).unwrap_or_else(|_| "[]".to_string());
        sqlx::query("INSERT INTO product_translations (product_id, language, title, description, features, price) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&id)
            .bind(&t.language)
            .bind(&t.title)
            .bind(&t.description)
            .bind(&features_json)
            .bind(t.price)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        response_translations.push(ProductTranslationResponse {
            language: t.language,
            title: t.title,
            description: t.description,
            features: t.features,
            price: t.price,
        });
    }

    Ok(Json(ProductResponse {
        id,
        tags: payload.tags,
        thumbnail_url: payload.thumbnail_url,
        photos: payload.photos,
        translations: response_translations,
        type_name: payload.type_name,
        metadata: payload.metadata,
        file_path: payload.file_path,
    }))
}

pub async fn update_product(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateProductRequest>,
) -> Result<Json<ProductResponse>, (StatusCode, String)> {
    crate::handlers::check_auth(&headers)?;

    let tags_json = serde_json::to_string(&payload.tags).unwrap_or_else(|_| "[]".to_string());
    let photos_json = serde_json::to_string(&payload.photos).unwrap_or_else(|_| "[]".to_string());
    let metadata_str = payload
        .metadata
        .as_ref()
        .and_then(|m| serde_json::to_string(m).ok());

    let result = sqlx::query("UPDATE products SET tags = ?, thumbnail_url = ?, photos = ?, type = ?, metadata = ?, file_path = ? WHERE id = ?")
        .bind(&tags_json)
        .bind(&payload.thumbnail_url)
        .bind(&photos_json)
        .bind(&payload.type_name)
        .bind(&metadata_str)
        .bind(&payload.file_path)
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Product not found".to_string()));
    }

    // Replace translations
    sqlx::query("DELETE FROM product_translations WHERE product_id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut response_translations = Vec::new();
    for t in payload.translations {
        let features_json = serde_json::to_string(&t.features).unwrap_or_else(|_| "[]".to_string());
        sqlx::query("INSERT INTO product_translations (product_id, language, title, description, features, price) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&id)
            .bind(&t.language)
            .bind(&t.title)
            .bind(&t.description)
            .bind(&features_json)
            .bind(t.price)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        response_translations.push(ProductTranslationResponse {
            language: t.language,
            title: t.title,
            description: t.description,
            features: t.features,
            price: t.price,
        });
    }

    Ok(Json(ProductResponse {
        id,
        tags: payload.tags,
        thumbnail_url: payload.thumbnail_url,
        photos: payload.photos,
        translations: response_translations,
        type_name: payload.type_name,
        metadata: payload.metadata,
        file_path: payload.file_path,
    }))
}

pub async fn delete_product(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    crate::handlers::check_auth(&headers)?;

    // Deleting from products will cascade to product_translations due to ON DELETE CASCADE
    let result = sqlx::query("DELETE FROM products WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Product not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct DownloadParams {
    pub token: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct DownloadClaims {
    pub sub: String, // order_id
    pub exp: usize,
}

pub async fn download_file(
    State(pool): State<SqlitePool>,
    Path(order_id): Path<String>,
    Query(params): Query<DownloadParams>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    use jsonwebtoken::{DecodingKey, Validation, decode};
    use std::env;

    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
    let token_data = decode::<DownloadClaims>(
        &params.token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Invalid token: {}", e)))?;

    if token_data.claims.sub != order_id {
        return Err((
            StatusCode::UNAUTHORIZED,
            "Token and order do not match".to_string(),
        ));
    }

    let order = sqlx::query_as::<_, crate::models::OrderDb>("SELECT * FROM orders WHERE id = ?")
        .bind(&order_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            )
        })?
        .ok_or((StatusCode::NOT_FOUND, "Order not found".to_string()))?;

    if order.status != "completed" {
        return Err((
            StatusCode::PAYMENT_REQUIRED,
            "Order is not completed".to_string(),
        ));
    }

    let product = sqlx::query_as::<_, crate::models::ProductDb>(
        "SELECT id, title, description, price, features, tags, thumbnail_url, photos, type, metadata, file_path FROM products WHERE id = ?"
    )
    .bind(&order.product_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?
    .ok_or((StatusCode::NOT_FOUND, "Product not found".to_string()))?;

    let file_path_str = product.file_path.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "Product has no digital file assigned".to_string(),
    ))?;

    let secure_dir = std::path::Path::new("digital_products");
    let target_path = secure_dir.join(&file_path_str);

    let canonical_secure = secure_dir.canonicalize().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("System error: {}", e),
        )
    })?;
    let canonical_target = target_path
        .canonicalize()
        .map_err(|_| (StatusCode::NOT_FOUND, "File not found".to_string()))?;

    if !canonical_target.starts_with(&canonical_secure) {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    let file = tokio::fs::File::open(&canonical_target)
        .await
        .map_err(|e| (StatusCode::NOT_FOUND, format!("File not found: {}", e)))?;
    let stream = tokio_util::io::ReaderStream::new(file);
    let body = axum::body::Body::from_stream(stream);

    let filename = canonical_target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("download.zip");

    let disposition = format!("attachment; filename=\"{}\"", filename);
    let mut response = body.into_response();
    response.headers_mut().insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/octet-stream"),
    );
    response.headers_mut().insert(
        axum::http::header::CONTENT_DISPOSITION,
        axum::http::HeaderValue::from_str(&disposition).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Header error: {}", e),
            )
        })?,
    );

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{EncodingKey, Header, encode};
    use sqlx::sqlite::SqlitePoolOptions;
    use std::time::{SystemTime, UNIX_EPOCH};

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
            "CREATE TABLE products (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                price REAL NOT NULL,
                features TEXT NOT NULL,
                tags TEXT NOT NULL,
                thumbnail_url TEXT,
                photos TEXT,
                type TEXT DEFAULT 'latex',
                metadata TEXT,
                file_path TEXT
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

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
                error_reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_download_file_valid() {
        let pool = setup_test_db().await;
        // Setup directories and test files
        std::fs::create_dir_all("digital_products").unwrap();
        std::fs::write("digital_products/test_product_file.zip", b"dummy content").unwrap();

        // Insert test user, product, order
        sqlx::query("INSERT INTO users (id, username, avatar_url, email) VALUES (1, 'testuser', 'avatar', 'test@example.com')")
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO products (id, title, description, price, features, tags, type, file_path) VALUES ('prod123', 'Test Title', 'Desc', 10.0, '[]', '[]', 'latex', 'test_product_file.zip')")
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO orders (id, user_id, email, product_id, amount, currency, gateway, status) VALUES ('order123', 1, 'test@example.com', 'prod123', 10.0, 'USD', 'crypto', 'completed')")
            .execute(&pool).await.unwrap();

        // Generate token
        let exp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize
            + 3600;
        let claims = DownloadClaims {
            sub: "order123".to_string(),
            exp,
        };
        let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(jwt_secret.as_bytes()),
        )
        .unwrap();

        let res = download_file(
            State(pool),
            Path("order123".to_string()),
            Query(DownloadParams { token }),
        )
        .await;

        assert!(res.is_ok());

        // Clean up test file
        let _ = std::fs::remove_file("digital_products/test_product_file.zip");
    }

    #[tokio::test]
    async fn test_download_file_invalid_token() {
        let pool = setup_test_db().await;
        let res = download_file(
            State(pool),
            Path("order123".to_string()),
            Query(DownloadParams {
                token: "invalid.token.here".to_string(),
            }),
        )
        .await;

        assert!(res.is_err());
        let (status, msg) = res.err().unwrap();
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(msg.contains("Invalid token"));
    }

    #[tokio::test]
    async fn test_download_file_non_matching_token() {
        let pool = setup_test_db().await;
        // Generate token for different order
        let exp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize
            + 3600;
        let claims = DownloadClaims {
            sub: "other_order".to_string(),
            exp,
        };
        let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(jwt_secret.as_bytes()),
        )
        .unwrap();

        let res = download_file(
            State(pool),
            Path("order123".to_string()),
            Query(DownloadParams { token }),
        )
        .await;

        assert!(res.is_err());
        let (status, msg) = res.err().unwrap();
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(msg, "Token and order do not match");
    }
}
