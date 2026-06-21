use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostTranslationResponse {
    pub language: String,
    pub title: String,
    pub summary: String,
    #[serde(rename = "readTime")]
    pub read_time: i32,
    pub content: String,
    #[serde(rename = "isMachineTranslated")]
    pub is_machine_translated: bool,
}

fn default_post_type_name() -> String { "linux".to_string() }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostResponse {
    pub id: String,
    pub date: String,
    pub tags: Vec<String>,
    pub upvotes: i32,
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail_url: Option<String>,
    pub translations: Vec<PostTranslationResponse>,
    #[serde(rename = "type", default = "default_post_type_name")]
    pub type_name: String,
}

#[derive(Debug, FromRow)]
pub struct PostDb {
    pub id: String,
    pub date: String,
    pub tags: String,
    pub upvotes: i64,
    pub thumbnail_url: Option<String>,
    #[sqlx(rename = "type")]
    pub type_name: String,
}

#[derive(Debug, FromRow)]
pub struct PostTranslationDb {
    pub post_id: String,
    pub language: String,
    pub title: String,
    pub summary: String,
    pub read_time: i64,
    pub content: String,
    pub is_machine_translated: bool,
}

#[derive(Debug, Deserialize)]
pub struct PostTranslationRequest {
    pub language: String,
    pub title: String,
    pub summary: String,
    #[serde(rename = "readTime")]
    pub read_time: i32,
    pub content: String,
    #[serde(rename = "isMachineTranslated", default)]
    pub is_machine_translated: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub id: Option<String>,
    pub date: String,
    pub tags: Vec<String>,
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail_url: Option<String>,
    pub translations: Vec<PostTranslationRequest>,
    #[serde(rename = "type", default = "default_post_type_name")]
    pub type_name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePostRequest {
    pub id: String,
    pub date: String,
    pub tags: Vec<String>,
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail_url: Option<String>,
    pub translations: Vec<PostTranslationRequest>,
    #[serde(rename = "type", default = "default_post_type_name")]
    pub type_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub avatar_url: String,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct CommentDb {
    pub id: i64,
    pub post_id: String,
    pub user_id: i64,
    pub parent_id: Option<i64>,
    pub content: String,
    pub created_at: String,
    pub upvotes: i64,
}

#[derive(Debug, FromRow)]
pub struct CommentAndUserDb {
    pub id: i64,
    pub post_id: String,
    pub parent_id: Option<i64>,
    pub content: String,
    pub created_at: String,
    pub upvotes: i64,
    pub user_id: i64,
    pub username: String,
    pub avatar_url: String,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommentResponse {
    pub id: i64,
    pub post_id: String,
    pub parent_id: Option<i64>,
    pub content: String,
    pub created_at: String,
    pub user: User,
    pub upvotes: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommentRequest {
    pub content: String,
    pub parent_id: Option<i64>,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductTranslationResponse {
    pub language: String,
    pub title: String,
    pub description: String,
    pub features: Vec<String>,
    pub price: f64,
}

#[derive(Debug, FromRow)]
pub struct ProductTranslationDb {
    pub product_id: String,
    pub language: String,
    pub title: String,
    pub description: String,
    pub features: String,
    pub price: f64,
}

#[derive(Debug, Deserialize)]
pub struct ProductTranslationRequest {
    pub language: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub features: Vec<String>,
    pub price: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductResponse {
    pub id: String,
    pub tags: Vec<String>,
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail_url: Option<String>,
    pub photos: Vec<String>,
    pub translations: Vec<ProductTranslationResponse>,
    #[serde(rename = "type", default = "default_type_name")]
    pub type_name: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, FromRow)]
pub struct ProductDb {
    pub id: String,
    pub title: String, // Keeping old fields as dormant columns
    pub description: String,
    pub price: f64,
    pub features: String,
    pub tags: String,
    pub thumbnail_url: Option<String>,
    pub photos: Option<String>,
    #[sqlx(rename = "type")]
    pub type_name: String,
    pub metadata: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductRequest {
    pub id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub photos: Vec<String>,
    pub translations: Vec<ProductTranslationRequest>,
    #[serde(rename = "type", default = "default_type_name")]
    pub type_name: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductRequest {
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub photos: Vec<String>,
    pub translations: Vec<ProductTranslationRequest>,
    #[serde(rename = "type", default = "default_type_name")]
    pub type_name: String,
    pub metadata: Option<serde_json::Value>,
}
fn default_type_name() -> String { "latex".to_string() }
