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
            let file_name = field.file_name().unwrap_or("image.png").to_string();
            let ext = Path::new(&file_name)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("png");
                
            let data = field.bytes().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

            let (final_data, new_filename) = if let Ok(img) = image::load_from_memory(&data) {
                let width = img.width();
                let height = img.height();
                let img = if width > 1200 {
                    let new_height = (height as f64 * (1200.0 / width as f64)) as u32;
                    img.resize(1200, new_height, image::imageops::FilterType::Triangle)
                } else {
                    img
                };

                let mut webp_bytes = Vec::new();
                if img.write_to(&mut std::io::Cursor::new(&mut webp_bytes), image::ImageFormat::WebP).is_ok() {
                    (webp_bytes, format!("{}.webp", Uuid::new_v4()))
                } else {
                    (data.to_vec(), format!("{}.{}", Uuid::new_v4(), ext))
                }
            } else {
                (data.to_vec(), format!("{}.{}", Uuid::new_v4(), ext))
            };

            let filepath = uploads_dir.join(&new_filename);
            fs::write(&filepath, final_data).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write file: {}", e)))?;

            let response = UploadResponse {
                url: format!("/uploads/{}", new_filename),
            };

            return Ok(Json(response));
        }
    }

    Err((StatusCode::BAD_REQUEST, "No image found in request".to_string()))
}
