use axum::{
    extract::{OriginalUri, Path, State},
    http::StatusCode,
    response::Html,
};
use sqlx::SqlitePool;
use std::env;

fn escape_html(s: &str) -> String {
    s.replace("&", "&amp;")
     .replace("<", "&lt;")
     .replace(">", "&gt;")
     .replace("\"", "&quot;")
     .replace("'", "&#x27;")
}

fn load_base_html(target_lang: &str, dir: &str, meta: &str, body_html: &str) -> String {
    let mut html = std::fs::read_to_string("../frontend/dist/index.html")
        .or_else(|_| std::fs::read_to_string("../frontend/index.html"))
        .unwrap_or_else(|_| "<html><head></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>".to_string());

    html = html.replace("<title>Log40</title>", "");
    html = html.replace("<title>Vite App</title>", "");
    html = html.replace("<meta name=\"description\" content=\"Personal blog sharing insights on software engineering, web development, and technology.\" />", "");

    html = html.replace("<html lang=\"en\">", &format!("<html lang=\"{}\" dir=\"{}\">", target_lang, dir));
    html = html.replace("<div id=\"root\"></div>", body_html);
    html.replace("</head>", &format!("{}\n</head>", meta))
}

pub async fn serve_seo_post(
    uri: OriginalUri,
    Path(id): Path<String>,
    State(pool): State<SqlitePool>,
) -> Result<Html<String>, StatusCode> {
    let base_html = std::fs::read_to_string("../frontend/dist/index.html")
        .or_else(|_| std::fs::read_to_string("../frontend/index.html"))
        .unwrap_or_else(|_| "<html><head></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>".to_string());
        
    let post = sqlx::query_as::<_, crate::models::PostDb>("SELECT * FROM posts WHERE id = ?").bind(&id).fetch_optional(&pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if let Some(post) = post {
        let is_fa = uri.path().starts_with("/fa/");
        let target_lang = if is_fa { "fa" } else { "en" };
        
        let translations = sqlx::query_as::<_, crate::models::PostTranslationDb>(
            "SELECT post_id, language, title, summary, content, read_time, is_machine_translated FROM post_translations WHERE post_id = ?"
        ).bind(&id).fetch_all(&pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        if let Some(trans) = translations.iter().find(|t| t.language == target_lang) {
            let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://log40.liara.run".to_string());
            let current_url = format!("{}{}", base_url, uri.path());
            let thumb = post.thumbnail_url.unwrap_or_default();
            let absolute_thumb = if thumb.is_empty() {
                format!("{}/og-image.png", base_url)
            } else if thumb.starts_with('/') {
                format!("{}{}", base_url, thumb)
            } else {
                thumb.clone()
            };
            
            let mut meta = format!(
                r#"<title>{} | Log40</title>
                <meta name="description" content="{}" />
                <link rel="canonical" href="{}" />
                <meta property="og:title" content="{}" />
                <meta property="og:description" content="{}" />
                <meta property="og:url" content="{}" />
                <meta property="og:type" content="article" />
                <meta property="og:site_name" content="Log40" />
                <meta property="og:image" content="{}" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="{}" />
                <meta name="twitter:description" content="{}" />
                <meta name="twitter:image" content="{}" />"#,
                escape_html(&trans.title), escape_html(&trans.summary), escape_html(&current_url),
                escape_html(&trans.title), escape_html(&trans.summary), escape_html(&current_url),
                escape_html(&absolute_thumb),
                escape_html(&trans.title), escape_html(&trans.summary),
                escape_html(&absolute_thumb)
            );
            
            for t in &translations {
                let alt_url = if t.language == "fa" {
                    format!("{}/fa/post/{}", base_url, id)
                } else {
                    format!("{}/post/{}", base_url, id)
                };
                meta.push_str(&format!(
                    r#"<link rel="alternate" hreflang="{}" href="{}" />"#,
                    t.language, alt_url
                ));
            }

            if !absolute_thumb.is_empty() {
                meta.push_str(&format!(
                    r#"<link rel="preload" as="image" href="{}" fetchpriority="high" />"#,
                    escape_html(&absolute_thumb)
                ));
            }
            
            let dir = if is_fa { "rtl" } else { "ltr" };
            
            let mut article_html = String::new();
            let parser = pulldown_cmark::Parser::new(&trans.content);
            pulldown_cmark::html::push_html(&mut article_html, parser);

            let img_html = if thumb.is_empty() {
                String::new()
            } else {
                format!(
                    r#"<img src="{}" alt="{}" fetchpriority="high" />"#,
                    escape_html(&thumb),
                    escape_html(&trans.title)
                )
            };

            // Build body HTML containing full post contents for SEO/GEO crawlers
            // ponytail: hide SEO pre-render from visual FOUC, React replaces it on mount
            let body_html = format!(
                r#"<div id="root"><div style="display:none">
                <article dir="{}">
                    <header>
                        <h1>{}</h1>
                        <time datetime="{}">{}</time>
                        <p><strong>{}</strong></p>
                        {}
                    </header>
                    <section>{}</section>
                </article>
                </div></div>"#,
                dir, escape_html(&trans.title), escape_html(&post.date), escape_html(&post.date), escape_html(&trans.summary), img_html, article_html
            );

            // Add schema markup
            let person_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"Person","@id":"{}/#person","name":"Toghrol","url":"https://github.com/toghrol","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"],"image":"{}/avatar.png","knowsAbout":["Rust (Programming Language)","Software Engineering","Linux","Backend Development"]}}"#,
                base_url, base_url
            );
            let organization_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"Organization","@id":"{}/#organization","name":"Log40","url":"{}/","logo":"{}/favicon.png","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"]}}"#,
                base_url, base_url, base_url
            );
            let blogposting_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"BlogPosting","@id":"{}#blogposting","headline":"{}","description":"{}","url":"{}","mainEntityOfPage":{{"@type":"WebPage","@id":"{}"}},"datePublished":"{}","dateModified":"{}","author":{{"@id":"{}/#person"}},"publisher":{{"@id":"{}/#organization"}},"keywords":{}}}"#,
                current_url, escape_html(&trans.title), escape_html(&trans.summary), current_url, current_url, escape_html(&post.date), escape_html(&post.date), base_url, base_url, post.tags
            );

            meta.push_str(&format!(
                r#"<script type="application/ld+json">{}</script>
                <script type="application/ld+json">{}</script>
                <script type="application/ld+json">{}</script>"#,
                person_schema, organization_schema, blogposting_schema
            ));

            return Ok(Html(load_base_html(target_lang, dir, &meta, &body_html)));
        }
    }
    
    Ok(Html(base_html))
}

pub async fn serve_seo_product(
    uri: OriginalUri,
    Path(id): Path<String>,
    State(pool): State<SqlitePool>,
) -> Result<Html<String>, StatusCode> {
    let product = sqlx::query_as::<_, crate::models::ProductDb>("SELECT * FROM products WHERE id = ?").bind(&id).fetch_optional(&pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if let Some(product) = product {
        let is_fa = uri.path().starts_with("/fa/");
        let target_lang = if is_fa { "fa" } else { "en" };
        let dir = if is_fa { "rtl" } else { "ltr" };
        let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://log40.liara.run".to_string());
        let current_url = format!("{}{}", base_url, uri.path());
        
        let translations = sqlx::query_as::<_, crate::models::ProductTranslationDb>(
            "SELECT product_id, language, title, description, features, price FROM product_translations WHERE product_id = ?"
        ).bind(&id).fetch_all(&pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        if let Some(trans) = translations.iter().find(|t| t.language == target_lang) {
            let thumb = product.thumbnail_url.clone().unwrap_or_default();
            let absolute_thumb = if thumb.is_empty() {
                format!("{}/og-image.png", base_url)
            } else if thumb.starts_with('/') {
                format!("{}{}", base_url, thumb)
            } else {
                thumb.clone()
            };
            
            let mut meta = format!(
                r#"<title>{} | Log40</title>
                <meta name="description" content="{}" />
                <link rel="canonical" href="{}" />
                <meta property="og:title" content="{}" />
                <meta property="og:description" content="{}" />
                <meta property="og:url" content="{}" />
                <meta property="og:type" content="product" />
                <meta property="og:site_name" content="Log40" />
                <meta property="og:image" content="{}" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="{}" />
                <meta name="twitter:description" content="{}" />
                <meta name="twitter:image" content="{}" />"#,
                escape_html(&trans.title), escape_html(&trans.description), escape_html(&current_url),
                escape_html(&trans.title), escape_html(&trans.description), escape_html(&current_url),
                escape_html(&absolute_thumb),
                escape_html(&trans.title), escape_html(&trans.description),
                escape_html(&absolute_thumb)
            );
            
            for t in &translations {
                let alt_url = if t.language == "fa" {
                    format!("{}/fa/store/product/{}", base_url, id)
                } else {
                    format!("{}/store/product/{}", base_url, id)
                };
                meta.push_str(&format!(
                    r#"<link rel="alternate" hreflang="{}" href="{}" />"#,
                    t.language, alt_url
                ));
            }

            if !absolute_thumb.is_empty() {
                meta.push_str(&format!(
                    r#"<link rel="preload" as="image" href="{}" fetchpriority="high" />"#,
                    escape_html(&absolute_thumb)
                ));
            }
            
            let person_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"Person","@id":"{}/#person","name":"Toghrol","url":"https://github.com/toghrol","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"],"image":"{}/avatar.png","knowsAbout":["Rust (Programming Language)","Software Engineering","Linux","Backend Development"]}}"#,
                base_url, base_url
            );

            let organization_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"Organization","@id":"{}/#organization","name":"Log40","url":"{}/","logo":"{}/favicon.png","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"]}}"#,
                base_url, base_url, base_url
            );

            let product_schema = format!(
                r#"{{"@context":"https://schema.org","@type":"Product","@id":"{}#product","name":"{}","image":"{}","description":"{}","offers":{{"@type":"Offer","priceCurrency":"USD","price":{},"availability":"https://schema.org/InStock","seller":{{"@id":"{}/#organization"}}}}}}"#,
                current_url, escape_html(&trans.title), escape_html(&absolute_thumb), escape_html(&trans.description), trans.price, base_url
            );

            meta.push_str(&format!(
                r#"<script type="application/ld+json">{}</script>
                <script type="application/ld+json">{}</script>
                <script type="application/ld+json">{}</script>"#,
                person_schema, organization_schema, product_schema
            ));

            let img_html = if thumb.is_empty() {
                String::new()
            } else {
                format!(
                    r#"<img src="{}" alt="{}" fetchpriority="high" />"#,
                    escape_html(&thumb),
                    escape_html(&trans.title)
                )
            };

            // Inject body product contents inside #root
            let features: Vec<String> = serde_json::from_str(&trans.features).unwrap_or_default();
            // ponytail: hide SEO pre-render from visual FOUC, React replaces it on mount
            let mut body_html = format!(
                r#"<div id="root"><div style="display:none">
                <article dir="{}">
                    <header>
                        <h1>{}</h1>
                        <p><strong>Price:</strong> ${:.2}</p>
                        {}
                    </header>
                    <section>
                        <h2>Description</h2>
                        <p>{}</p>
                        <h2>Features</h2>
                        <ul>"#,
                dir, escape_html(&trans.title), trans.price, img_html, escape_html(&trans.description)
            );
            for feat in features {
                body_html.push_str(&format!("<li>{}</li>\n", escape_html(&feat)));
            }
            body_html.push_str(
                r#"</ul>
                    </section>
                </article>
                </div></div>"#
            );

            return Ok(Html(load_base_html(target_lang, dir, &meta, &body_html)));
        }
    }
    
    Err(StatusCode::NOT_FOUND)
}

pub async fn serve_seo_store(
    uri: OriginalUri,
    State(pool): State<SqlitePool>,
) -> Result<Html<String>, StatusCode> {
    let products_db = sqlx::query_as::<_, crate::models::ProductDb>("SELECT * FROM products")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let is_fa = uri.path().starts_with("/fa/");
    let target_lang = if is_fa { "fa" } else { "en" };
    let dir = if is_fa { "rtl" } else { "ltr" };
    
    let description = if is_fa {
        format!("دانلود قالب‌های LaTeX، کتاب‌های فنی و ابزارهای مهندسی. گردآوری شده توسط طغرل برای مهندسان نرم‌افزار و پژوهشگران. شامل {} محصول دیجیتال.", products_db.len())
    } else {
        format!("Download LaTeX templates, technical books, and engineering tools. Curated by Toghrol for software engineers and researchers. Explore {} digital products.", products_db.len())
    };
    
    let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://log40.liara.run".to_string());
    let current_url = format!("{}{}", base_url, uri.path());
    let store_title = if is_fa {
        "فروشگاه Log40 — قالب‌های لاتک، کتاب‌ها و ابزارهای فنی"
    } else {
        "Log40 Store — LaTeX Templates, Tech Books & Tools"
    };

    let translations_db = sqlx::query_as::<_, crate::models::ProductTranslationDb>(
        "SELECT product_id, language, title, description, features, price FROM product_translations"
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let person_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Person","@id":"{}/#person","name":"Toghrol","url":"https://github.com/toghrol","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"],"image":"{}/avatar.png","knowsAbout":["Rust (Programming Language)","Software Engineering","Linux","Backend Development"]}}"#,
        base_url, base_url
    );
    let organization_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Organization","@id":"{}/#organization","name":"Log40","url":"{}/","logo":"{}/favicon.png","description":"{}","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"]}}"#,
        base_url, base_url, base_url, escape_html(&description)
    );

    let mut list_items_json = Vec::new();
    for (idx, prod) in products_db.iter().enumerate() {
        if let Some(trans) = translations_db.iter()
            .find(|t| t.product_id == prod.id && t.language == target_lang)
            .or_else(|| translations_db.iter().find(|t| t.product_id == prod.id && t.language == "en"))
        {
            let prod_url = if is_fa {
                format!("{}/fa/store/product/{}", base_url, prod.id)
            } else {
                format!("{}/store/product/{}", base_url, prod.id)
            };
            list_items_json.push(format!(
                r#"{{"@type":"ListItem","position":{},"name":"{}","url":"{}"}}"#,
                idx + 1, escape_html(&trans.title), prod_url
            ));
        }
    }
    let list_items_str = list_items_json.join(",");
    let item_list_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"ItemList","name":"Log40 Store","description":"{}","itemListElement":[{}]}}"#,
        escape_html(&description), list_items_str
    );

    let meta = format!(
        r#"<title>{}</title>
        <meta name="description" content="{}" />
        <link rel="canonical" href="{}" />
        <link rel="alternate" hreflang="en" href="{}/store" />
        <link rel="alternate" hreflang="fa" href="{}/fa/store" />
        <meta property="og:title" content="{}" />
        <meta property="og:description" content="{}" />
        <meta property="og:url" content="{}" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Log40" />
        <meta property="og:image" content="{}/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{}" />
        <meta name="twitter:description" content="{}" />
        <meta name="twitter:image" content="{}/og-image.png" />
        <script type="application/ld+json">{}</script>
        <script type="application/ld+json">{}</script>
        <script type="application/ld+json">{}</script>"#,
        escape_html(store_title), escape_html(&description), escape_html(&current_url),
        base_url, base_url,
        escape_html(store_title), escape_html(&description), escape_html(&current_url),
        base_url,
        escape_html(store_title), escape_html(&description),
        base_url,
        person_schema, organization_schema, item_list_schema
    );
    
    // Fetch translations for pre-rendering store contents inside #root
    // ponytail: hide SEO pre-render from visual FOUC, React replaces it on mount
    let mut body_html = format!(
        r#"<div id="root"><div style="display:none">
        <header>
            <h1>Store</h1>
            <p>{}</p>
        </header>
        <main>
            <ul>"#,
        escape_html(&description)
    );

    for prod in products_db {
        if let Some(trans) = translations_db.iter()
            .find(|t| t.product_id == prod.id && t.language == target_lang)
            .or_else(|| translations_db.iter().find(|t| t.product_id == prod.id && t.language == "en"))
        {
            let prod_url = if is_fa {
                format!("/fa/store/product/{}", prod.id)
            } else {
                format!("/store/product/{}", prod.id)
            };
            body_html.push_str(&format!(
                r#"<li>
                    <h3><a href="{}">{}</a></h3>
                    <p>{}</p>
                    <span>Price: ${:.2}</span>
                </li>"#,
                escape_html(&prod_url),
                escape_html(&trans.title),
                escape_html(&trans.description),
                trans.price
            ));
        }
    }

    body_html.push_str(
        r#"</ul>
        </main>
        </div></div>"#
    );

    Ok(Html(load_base_html(target_lang, dir, &meta, &body_html)))
}

pub async fn serve_seo_home(
    uri: OriginalUri,
    State(pool): State<SqlitePool>,
) -> Result<Html<String>, StatusCode> {
    let path = uri.path();
    let is_fa = path.starts_with("/fa");
    let target_lang = if is_fa { "fa" } else { "en" };
    let dir = if is_fa { "rtl" } else { "ltr" };
    
    // Fetch top 10 posts
    let posts_db = sqlx::query_as::<_, crate::models::PostDb>(
        "SELECT id, date, tags, upvotes, thumbnail_url, type FROM posts ORDER BY date DESC LIMIT 10"
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let translations_db = sqlx::query_as::<_, crate::models::PostTranslationDb>(
        "SELECT post_id, language, title, summary, content, read_time, is_machine_translated FROM post_translations"
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://log40.liara.run".to_string());
    let current_url = format!("{}{}", base_url, path);

    let title = if is_fa {
        "لاگ۴۰ — وبلاگ مهندسی نرم‌افزار و راست"
    } else {
        "Log40 — Software Engineering & Rust Dev Blog"
    };

    let description = if is_fa {
        "وبلاگ تخصصی مهندسی نرم‌افزار، برنامه‌نویسی راست (Rust)، کرنل لینوکس و معماری سیستم‌ها توسط طغرل در Log40. مقالات عمیق و کاربردی."
    } else {
        "Explore deep-dive software engineering tutorials, Rust programming, Linux kernel internals, and backend architecture insights by Toghrol at Log40."
    };

    let person_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Person","@id":"{}/#person","name":"Toghrol","url":"https://github.com/toghrol","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"],"image":"{}/avatar.png","knowsAbout":["Rust (Programming Language)","Software Engineering","Linux","Backend Development"]}}"#,
        base_url, base_url
    );

    let organization_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Organization","@id":"{}/#organization","name":"Log40","url":"{}/","logo":"{}/favicon.png","description":"{}","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"]}}"#,
        base_url, base_url, base_url, escape_html(description)
    );

    let website_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"WebSite","@id":"{}/#website","url":"{}/","name":"Log40","description":"{}","publisher":{{"@id":"{}/#organization"}},"potentialAction":{{"@type":"SearchAction","target":{{"@type":"EntryPoint","urlTemplate":"{}/?q={{search_term_string}}"}},"query-input":"required name=search_term_string"}}}}"#,
        base_url, base_url, escape_html(description), base_url, base_url
    );

    let mut blog_posts_json = Vec::new();
    for db_post in &posts_db {
        let post_url = if is_fa {
            format!("{}/fa/post/{}", base_url, db_post.id)
        } else {
            format!("{}/post/{}", base_url, db_post.id)
        };
        blog_posts_json.push(format!(r#"{{"@type":"BlogPosting","@id":"{}#blogposting"}}"#, post_url));
    }
    let blog_posts_str = blog_posts_json.join(",");

    let blog_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Blog","@id":"{}/#blog","name":"Log40 Blog","description":"{}","publisher":{{"@id":"{}/#organization"}},"inLanguage":["en","fa"],"url":"{}","author":{{"@id":"{}/#person"}},"blogPost":[{}]}}"#,
        base_url, escape_html(description), base_url, current_url, base_url, blog_posts_str
    );

    let meta = format!(
        r#"<title>{}</title>
        <meta name="description" content="{}" />
        <link rel="canonical" href="{}" />
        <link rel="alternate" hreflang="en" href="{}/" />
        <link rel="alternate" hreflang="fa" href="{}/fa" />
        <meta property="og:title" content="{}" />
        <meta property="og:description" content="{}" />
        <meta property="og:url" content="{}" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Log40" />
        <meta property="og:image" content="{}/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{}" />
        <meta name="twitter:description" content="{}" />
        <meta name="twitter:image" content="{}/og-image.png" />
        <script type="application/ld+json">{}</script>
        <script type="application/ld+json">{}</script>
        <script type="application/ld+json">{}</script>
        <script type="application/ld+json">{}</script>"#,
        escape_html(title), escape_html(description), escape_html(&current_url),
        base_url, base_url,
        escape_html(title), escape_html(description), escape_html(&current_url),
        base_url,
        escape_html(title), escape_html(description),
        base_url,
        person_schema, organization_schema, website_schema, blog_schema
    );

    // ponytail: hide SEO pre-render from visual FOUC, React replaces it on mount
    let mut body_html = format!(
        r#"<div id="root"><div style="display:none">
        <header>
            <h1>Software Engineering, Linux & Rust — Log40</h1>
            <p>{}</p>
        </header>
        <main>
            <h2>{}</h2>
            <ul>"#,
        escape_html(description),
        if is_fa { "آخرین نوشته‌ها" } else { "Latest Posts" }
    );

    for db_post in posts_db {
        if let Some(trans) = translations_db.iter().find(|t| t.post_id == db_post.id && t.language == target_lang) {
            let post_url = if is_fa {
                format!("/fa/post/{}", db_post.id)
            } else {
                format!("/post/{}", db_post.id)
            };
            body_html.push_str(&format!(
                r#"<li>
                    <h3><a href="{}">{}</a></h3>
                    <p>{}</p>
                    <time datetime="{}">{}</time>
                </li>"#,
                escape_html(&post_url),
                escape_html(&trans.title),
                escape_html(&trans.summary),
                escape_html(&db_post.date),
                escape_html(&db_post.date)
            ));
        }
    }

    body_html.push_str(
        r#"</ul>
        </main>
        </div></div>"#
    );

    Ok(Html(load_base_html(target_lang, dir, &meta, &body_html)))
}

pub async fn serve_seo_about(
    uri: OriginalUri,
) -> Result<Html<String>, StatusCode> {
    let path = uri.path();
    let is_fa = path.starts_with("/fa");
    let target_lang = if is_fa { "fa" } else { "en" };
    let dir = if is_fa { "rtl" } else { "ltr" };
    
    let base_url = env::var("BASE_URL").unwrap_or_else(|_| "https://log40.liara.run".to_string());
    let current_url = format!("{}{}", base_url, path);

    let title = if is_fa {
        "طغرل — مهندس سیستم و توسعه‌دهنده راست | Log40"
    } else {
        "Toghrol — Systems Engineer & Rust Developer | Log40"
    };

    let description = if is_fa {
        "طغرل مهندس سیستم و توسعه‌دهنده راست است که مقالاتی عمیق درباره لینوکس، مهندسی بک‌اند و ابزارهای متن‌باز می‌نویسد. بیوگرافی و مهارت‌ها را بخوانید."
    } else {
        "Toghrol is a systems engineer and Rust developer writing in-depth guides on Linux, backend engineering, and open-source tooling. Explore my bio and skills."
    };

    let person_schema = format!(
        r#"{{"@context":"https://schema.org","@type":"Person","@id":"{}/#person","name":"Toghrol","url":"https://github.com/toghrol","sameAs":["https://github.com/toghrol","https://www.linkedin.com/in/toghrol/"],"jobTitle":"Systems & Rust Software Engineer","description":"{}","image":"{}/avatar.png","knowsAbout":["Rust (Programming Language)","Software Engineering","Linux","Backend Development"]}}"#,
        base_url, escape_html(description), base_url
    );

    let meta = format!(
        r#"<title>{}</title>
        <meta name="description" content="{}" />
        <link rel="canonical" href="{}" />
        <link rel="alternate" hreflang="en" href="{}/about" />
        <link rel="alternate" hreflang="fa" href="{}/fa/about" />
        <meta property="og:title" content="{}" />
        <meta property="og:description" content="{}" />
        <meta property="og:url" content="{}" />
        <meta property="og:type" content="profile" />
        <meta property="og:site_name" content="Log40" />
        <meta property="og:image" content="{}/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{}" />
        <meta name="twitter:description" content="{}" />
        <meta name="twitter:image" content="{}/og-image.png" />
        <script type="application/ld+json">{}</script>"#,
        escape_html(title), escape_html(description), escape_html(&current_url),
        base_url, base_url,
        escape_html(title), escape_html(description), escape_html(&current_url),
        base_url,
        escape_html(title), escape_html(description),
        base_url,
        person_schema
    );

    // ponytail: hide SEO pre-render from visual FOUC, React replaces it on mount
    let body_html = if is_fa {
        format!(
            r#"<div id="root"><div style="display:none">
            <article dir="rtl">
                <header>
                    <img src="/avatar.png" alt="طغرل - مهندس سیستم و توسعه‌دهنده راست" />
                    <h1>درباره من</h1>
                </header>
                <section>
                    <p>سلام! من <strong>طغرل</strong> هستم، مهندس سیستم و توسعه‌دهنده راست. تخصص من توسعه سیستم‌های بک‌اند با کارایی بالا، ابزارهای کم‌حجم سیستمی لینوکس و رابط‌های کاربری متنی ترمینال (TUI) است. در طول سال‌ها، پروژه‌های مختلفی را توسعه داده و منتشر کرده‌ام؛ از جمله <em>porg</em> (ابزار مدیریت آرشیو و بسته‌بندی در راست)، <em>Log40</em> (همین وبلاگ و فروشگاه با کارایی بالا)، و ابزارهای خط فرمان مختلف شامل داشبورد ترمینالی با کتابخانه <em>ratatui</em> و بازی تتریس متنی ترمینال با پوسته‌های سفارشی.</p>
                    <p>من وبلاگ لاگ۴۰ را به عنوان پایگاهی برای انتشار مقالات تخصصی، تحلیل‌های عمیق روی مدل مالکیت و مدیریت حافظه در راست، معماری‌های سیستم و لینوکس راه‌اندازی کردم. تمامی ابزارها و قالب‌های موجود در فروشگاه به صورت متن‌باز یا اختصاصی برای توسعه‌دهندگانی طراحی شده‌اند که به دنبال بهبود فرآیندهای مهندسی خود هستند.</p>
                    <h2>مهارت‌های اصلی</h2>
                    <ul>
                        <li>زبان برنامه‌نویسی راست (Rust)</li>
                        <li>سیستم‌های لینوکس و ابزارهای ترمینال</li>
                        <li>توسعه بک‌اند و پایگاه‌داده (Axum, SQLite, PostgreSQL)</li>
                        <li>داکر و استقرار ابری (Docker, Liara)</li>
                    </ul>
                </section>
            </article>
            </div></div>"#
        )
    } else {
        format!(
            r#"<div id="root"><div style="display:none">
            <article dir="ltr">
                <header>
                    <img src="/avatar.png" alt="Toghrol - Systems & Rust Software Engineer" />
                    <h1 >About Me</h1>
                </header>
                <section>
                    <p>Hello! I'm <strong>Toghrol</strong>, a systems engineer and Rust developer. I specialize in building high-performance backend systems, low-level Linux utilities, and terminal user interfaces (TUIs). Over the years, I have built and shipped projects like <em>porg</em> (a lightweight Rust packer and archive manager), <em>Log40</em> (this high-performance blogging & digital product store platform), and various command-line applications including a custom <em>ratatui</em>-based TUI dashboard and a themed terminal Tetris game.</p>
                    <p>I started Log40 as a hub for publishing technical articles, deep dives into Rust ownership and memory management models, Linux system internals, and backend architectural design. All the tools and templates featured in my store are fully open-source or curated for engineers looking to level up their development workflow.</p>
                    <h2>Core Skills</h2>
                    <ul>
                        <li>Rust Programming Language</li>
                        <li>Linux Systems & Terminal Utilities</li>
                        <li>Backend & Database Development (Axum, SQLite, PostgreSQL)</li>
                        <li>Docker & Cloud Deployment (Docker, Liara)</li>
                    </ul>
                </section>
            </article>
            </div></div>"#
        )
    };

    Ok(Html(load_base_html(target_lang, dir, &meta, &body_html)))
}
