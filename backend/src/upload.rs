use axum::{
    extract::Multipart,
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::fs;
use std::path::Path;
use uuid::Uuid;
use axum::response::IntoResponse;

#[derive(Serialize)]
pub struct UploadResponse {
    pub url: String,
}

pub async fn upload_image(mut multipart: Multipart) -> Result<impl IntoResponse, (StatusCode, String)> {
    let uploads_dir = Path::new("uploads");
    if !uploads_dir.exists() {
        fs::create_dir_all(uploads_dir)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create uploads dir: {}", e)))?;
    }

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let name = field.name().unwrap_or("").to_string();
        if name == "image" || name == "file" {
            let data = field.bytes().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

            let img = image::load_from_memory(&data)
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid image format: {}", e)))?;

            let img = if img.width() > 1000 {
                img.resize(1000, 1000, image::imageops::FilterType::Lanczos3)
            } else {
                img
            };

            let encoder = webp::Encoder::from_image(&img)
                .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create WebP encoder".to_string()))?;
            let webp_data = encoder.encode(75.0);

            let new_filename = format!("{}.webp", Uuid::new_v4());
            let filepath = uploads_dir.join(&new_filename);

            fs::write(&filepath, &*webp_data).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write file: {}", e)))?;

            let response = UploadResponse {
                url: format!("/uploads/{}", new_filename),
            };

            return Ok(Json(response));
        }
    }

    Err((StatusCode::BAD_REQUEST, "No image found in request".to_string()))
}
