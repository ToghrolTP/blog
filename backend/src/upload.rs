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
                
            let new_filename = format!("{}.{}", Uuid::new_v4(), ext);
            let filepath = uploads_dir.join(&new_filename);

            let data = field.bytes().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
            fs::write(&filepath, data).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write file: {}", e)))?;

            let response = UploadResponse {
                url: format!("/uploads/{}", new_filename),
            };

            return Ok(Json(response));
        }
    }

    Err((StatusCode::BAD_REQUEST, "No image found in request".to_string()))
}
