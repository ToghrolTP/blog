use axum::response::IntoResponse;
use axum::{Json, extract::Multipart, http::StatusCode};
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::Path;
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
pub struct UploadResponse {
    pub url: String,
}

pub async fn upload_image(
    headers: axum::http::HeaderMap,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    crate::handlers::check_auth(&headers)?;
    let uploads_dir = Path::new("uploads");
    if !uploads_dir.exists() {
        fs::create_dir_all(uploads_dir).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to create uploads dir: {}", e),
            )
        })?;
    }

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let name = field.name().unwrap_or("").to_string();
        if name == "image" || name == "file" {
            let data = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

            let img = image::load_from_memory(&data).map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    format!("Invalid image format: {}", e),
                )
            })?;

            let img = if img.width() > 1000 {
                img.resize(1000, 1000, image::imageops::FilterType::Lanczos3)
            } else {
                img
            };

            let encoder = webp::Encoder::from_image(&img).map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to create WebP encoder".to_string(),
                )
            })?;
            let webp_data = encoder.encode(75.0);

            let new_filename = format!("{}.webp", Uuid::new_v4());
            let filepath = uploads_dir.join(&new_filename);

            fs::write(&filepath, &*webp_data).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to write file: {}", e),
                )
            })?;

            let response = UploadResponse {
                url: format!("/uploads/{}", new_filename),
            };

            return Ok(Json(response));
        }
    }

    Err((
        StatusCode::BAD_REQUEST,
        "No image found in request".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        routing::post,
        Router,
    };
    use tower::util::ServiceExt;
    use std::io::Cursor;
    use image::{ImageBuffer, Rgb, Rgba, ImageFormat};

    fn build_multipart_body(field_name: &str, file_name: &str, mime_type: &str, data: &[u8]) -> Vec<u8> {
        let mut body = Vec::new();
        body.extend_from_slice(b"--boundary\r\n");
        body.extend_from_slice(
            format!(
                "Content-Disposition: form-data; name=\"{}\"; filename=\"{}\"\r\n",
                field_name, file_name
            )
            .as_bytes(),
        );
        body.extend_from_slice(format!("Content-Type: {}\r\n\r\n", mime_type).as_bytes());
        body.extend_from_slice(data);
        body.extend_from_slice(b"\r\n--boundary--\r\n");
        body
    }

    fn create_test_image(width: u32, height: u32, format: ImageFormat) -> Vec<u8> {
        let mut buffer = Vec::new();
        let mut cursor = Cursor::new(&mut buffer);

        match format {
            ImageFormat::Png => {
                let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(width, height);
                img.write_to(&mut cursor, ImageFormat::Png).unwrap();
            }
            ImageFormat::Jpeg => {
                let img: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::new(width, height);
                img.write_to(&mut cursor, ImageFormat::Jpeg).unwrap();
            }
            _ => panic!("Unsupported test image format"),
        }
        buffer
    }

    fn test_app() -> Router {
        Router::new().route("/api/upload", post(upload_image))
    }

    #[tokio::test]
    async fn test_upload_unauthorized() {
        let app = test_app();
        let body = build_multipart_body("image", "test.png", "image/png", &create_test_image(10, 10, ImageFormat::Png));

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/upload")
                    .header("Content-Type", "multipart/form-data; boundary=boundary")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_upload_invalid_image_format() {
        let app = test_app();
        let body = build_multipart_body("image", "test.png", "image/png", b"invalid-binary-data");
        let secret = std::env::var("ADMIN_SECRET").unwrap_or_else(|_| "secret".to_string());

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/upload")
                    .header("Authorization", format!("Bearer {}", secret))
                    .header("Content-Type", "multipart/form-data; boundary=boundary")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_upload_compression_rgb_small() {
        let app = test_app();
        let test_data = create_test_image(500, 400, ImageFormat::Jpeg);
        let body = build_multipart_body("image", "test.jpg", "image/jpeg", &test_data);
        let secret = std::env::var("ADMIN_SECRET").unwrap_or_else(|_| "secret".to_string());
        
        let _ = fs::create_dir_all("uploads");

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/upload")
                    .header("Authorization", format!("Bearer {}", secret))
                    .header("Content-Type", "multipart/form-data; boundary=boundary")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let upload_res: UploadResponse = serde_json::from_slice(&body_bytes).unwrap();
        let relative_path = upload_res.url.trim_start_matches('/');
        let file_path = Path::new(relative_path);
        
        assert!(file_path.exists());
        
        // Read file back and check sizes
        let file_bytes = fs::read(file_path).unwrap();
        let img = image::load_from_memory(&file_bytes).unwrap();
        assert_eq!(img.width(), 500); // Small, kept original width
        assert_eq!(img.height(), 400);

        let _ = fs::remove_file(file_path);
    }

    #[tokio::test]
    async fn test_upload_compression_rgba_large() {
        let app = test_app();
        let test_data = create_test_image(1500, 1000, ImageFormat::Png);
        let body = build_multipart_body("image", "test.png", "image/png", &test_data);
        let secret = std::env::var("ADMIN_SECRET").unwrap_or_else(|_| "secret".to_string());
        
        let _ = fs::create_dir_all("uploads");

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/upload")
                    .header("Authorization", format!("Bearer {}", secret))
                    .header("Content-Type", "multipart/form-data; boundary=boundary")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let upload_res: UploadResponse = serde_json::from_slice(&body_bytes).unwrap();
        let relative_path = upload_res.url.trim_start_matches('/');
        let file_path = Path::new(relative_path);
        
        assert!(file_path.exists());
        
        // Read file back and check sizes
        let file_bytes = fs::read(file_path).unwrap();
        let img = image::load_from_memory(&file_bytes).unwrap();
        assert_eq!(img.width(), 1000); // Resized to max 1000 width
        assert!(img.height() == 666 || img.height() == 667); 

        let _ = fs::remove_file(file_path);
    }
}
