use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::SqlitePool;
use crate::models::{
    ProductDb, ProductResponse, CreateProductRequest, UpdateProductRequest,
    ProductTranslationDb, ProductTranslationResponse
};

#[derive(Deserialize)]
pub struct ProductFilter {
    pub tag: Option<String>,
}

async fn is_store_under_maintenance(pool: &SqlitePool) -> bool {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = 'store_maintenance'")
        .fetch_optional(pool)
        .await
        .unwrap_or(None);
    if let Some(r) = row {
        r.0 == "true"
    } else {
        false
    }
}

async fn is_site_under_maintenance(pool: &SqlitePool) -> bool {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = 'site_maintenance'")
        .fetch_optional(pool)
        .await
        .unwrap_or(None);
    if let Some(r) = row {
        r.0 == "true"
    } else {
        false
    }
}

pub async fn get_products(
    headers: axum::http::HeaderMap,
    State(pool): State<SqlitePool>,
    Query(params): Query<Vec<(String, String)>>,
) -> Result<Json<Vec<ProductResponse>>, (StatusCode, String)> {
    if is_store_under_maintenance(&pool).await || is_site_under_maintenance(&pool).await {
        if crate::handlers::check_auth(&headers).is_err() {
            return Err((StatusCode::SERVICE_UNAVAILABLE, "Store is under maintenance".to_string()));
        }
    }

    let tags: Vec<String> = params.into_iter()
        .filter_map(|(k, v)| if k == "tag" { Some(v) } else { None })
        .collect();

    let products_db = sqlx::query_as::<_, ProductDb>("SELECT id, title, description, price, features, tags, thumbnail_url, photos, type, metadata FROM products")
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
        let photos: Vec<String> = serde_json::from_str(db.photos.as_deref().unwrap_or("[]")).unwrap_or_default();

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
                    let features: Vec<String> = serde_json::from_str(&t.features).unwrap_or_default();
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
    if is_store_under_maintenance(&pool).await || is_site_under_maintenance(&pool).await {
        if crate::handlers::check_auth(&headers).is_err() {
            return Err((StatusCode::SERVICE_UNAVAILABLE, "Store is under maintenance".to_string()));
        }
    }

    let db = sqlx::query_as::<_, ProductDb>("SELECT id, title, description, price, features, tags, thumbnail_url, photos, type, metadata FROM products WHERE id = ?")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    match db {
        Some(db) => {
            let tags: Vec<String> = serde_json::from_str(&db.tags).unwrap_or_default();
            let photos: Vec<String> = serde_json::from_str(db.photos.as_deref().unwrap_or("[]")).unwrap_or_default();

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
            }))
        },
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
        return Err((StatusCode::BAD_REQUEST, "At least one translation is required".to_string()));
    }
    for t in &payload.translations {
        if t.title.trim().is_empty() || t.description.trim().is_empty() {
            return Err((StatusCode::BAD_REQUEST, "Title and description are required".to_string()));
        }
        if t.price < 0.0 {
            return Err((StatusCode::BAD_REQUEST, "Price cannot be negative".to_string()));
        }
    }

    let id = payload.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let tags_json = serde_json::to_string(&payload.tags).unwrap_or_else(|_| "[]".to_string());
    let photos_json = serde_json::to_string(&payload.photos).unwrap_or_else(|_| "[]".to_string());
    let metadata_str = payload.metadata.as_ref().and_then(|m| serde_json::to_string(m).ok());
    
    // Insert dormant fields as empty/0.0 to satisfy NOT NULL constraints
    sqlx::query("INSERT INTO products (id, title, description, price, features, tags, thumbnail_url, photos, type, metadata) VALUES (?, '', '', 0.0, '[]', ?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&tags_json)
        .bind(&payload.thumbnail_url)
        .bind(&photos_json)
        .bind(&payload.type_name)
        .bind(&metadata_str)
        .execute(&pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.is_unique_violation() {
                    return (StatusCode::CONFLICT, "Product with this ID already exists".to_string());
                }
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
    let metadata_str = payload.metadata.as_ref().and_then(|m| serde_json::to_string(m).ok());

    let result = sqlx::query("UPDATE products SET tags = ?, thumbnail_url = ?, photos = ?, type = ?, metadata = ? WHERE id = ?")
        .bind(&tags_json)
        .bind(&payload.thumbnail_url)
        .bind(&photos_json)
        .bind(&payload.type_name)
        .bind(&metadata_str)
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
