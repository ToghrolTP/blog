use sqlx::SqlitePool;

pub async fn init_db(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Create posts table if not exists (with legacy fields for fresh start if needed)
    // To handle migration cleanly, we first ensure the base table exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            tags TEXT NOT NULL,
            summary TEXT,
            read_time INTEGER,
            content TEXT,
            upvotes INTEGER NOT NULL DEFAULT 0,
            thumbnail_url TEXT,
            type TEXT DEFAULT 'linux'
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            price REAL NOT NULL,
            features TEXT NOT NULL,
            tags TEXT NOT NULL,
            thumbnail_url TEXT,
            photos TEXT,
            type TEXT DEFAULT 'latex',
            metadata TEXT
        )
        "#
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query("ALTER TABLE posts ADD COLUMN type TEXT DEFAULT 'linux'")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE posts ADD COLUMN thumbnail_url TEXT")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE products ADD COLUMN thumbnail_url TEXT")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE products ADD COLUMN photos TEXT")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE products ADD COLUMN type TEXT DEFAULT 'latex'")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE products ADD COLUMN metadata TEXT")
        .execute(pool)
        .await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_translations (
            product_id TEXT NOT NULL,
            language TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            features TEXT NOT NULL,
            price REAL NOT NULL DEFAULT 0.0,
            PRIMARY KEY (product_id, language),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
        "#
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query("ALTER TABLE product_translations ADD COLUMN price REAL DEFAULT 0.0")
        .execute(pool)
        .await;

    // Migrate existing products into the english variant to prevent data loss
    sqlx::query(
        r#"
        INSERT OR IGNORE INTO product_translations (product_id, language, title, description, features, price)
        SELECT id, 'en', title, description, features, price FROM products
        "#
    )
    .execute(pool)
    .await?;

    // Also update existing english variants to have the original price just in case the migration above was already run
    let _ = sqlx::query(
        r#"
        UPDATE product_translations 
        SET price = (SELECT price FROM products WHERE products.id = product_translations.product_id)
        WHERE language = 'en' AND price = 0.0
        "#
    )
    .execute(pool)
    .await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS post_translations (
            post_id TEXT NOT NULL,
            language TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            content TEXT NOT NULL,
            read_time INTEGER NOT NULL,
            is_machine_translated BOOLEAN NOT NULL DEFAULT 0,
            PRIMARY KEY (post_id, language),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        )
        "#
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query("ALTER TABLE post_translations ADD COLUMN is_machine_translated BOOLEAN NOT NULL DEFAULT 0")
        .execute(pool)
        .await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            avatar_url TEXT NOT NULL
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT OR IGNORE INTO settings (key, value) VALUES 
        ('store_maintenance', 'false'),
        ('blog_maintenance', 'false'),
        ('comments_maintenance', 'false'),
        ('site_maintenance', 'false'),
        ('feedback_enabled', 'true'),
        ('feedback_allowed_paths', '*')
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            parent_id INTEGER,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (parent_id) REFERENCES comments(id)
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS feedbacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route TEXT NOT NULL,
            content TEXT NOT NULL,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
        "#
    )
    .execute(pool)
    .await?;

    // Create orders table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            email TEXT NOT NULL,
            product_id TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            gateway TEXT NOT NULL,
            status TEXT NOT NULL,
            ref_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
        "#
    )
    .execute(pool)
    .await?;

    // Add file_path to products table
    let _ = sqlx::query("ALTER TABLE products ADD COLUMN file_path TEXT")
        .execute(pool)
        .await;

    // Migrations to add upvotes safely
    let _ = sqlx::query("ALTER TABLE posts ADD COLUMN upvotes INTEGER NOT NULL DEFAULT 0")
        .execute(pool)
        .await; // Ignore error if column exists

    let _ = sqlx::query("ALTER TABLE comments ADD COLUMN upvotes INTEGER NOT NULL DEFAULT 0")
        .execute(pool)
        .await;
        
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN email TEXT")
        .execute(pool)
        .await;
    let _ = sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN password_hash TEXT")
        .execute(pool)
        .await;
        
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN display_name TEXT")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE users ADD COLUMN bio TEXT")
        .execute(pool)
        .await;
        
    // Perform data migration from old posts structure to new
    let legacy_rows = sqlx::query_as::<_, (String, String, String, String, i64)>("SELECT id, title, summary, content, read_time FROM posts WHERE title IS NOT NULL")
        .fetch_all(pool)
        .await;
        
    if let Ok(rows) = legacy_rows {
        for (id, title, summary, content, read_time) in rows {
            let _ = sqlx::query("INSERT OR IGNORE INTO post_translations (post_id, language, title, summary, content, read_time) VALUES (?, 'en', ?, ?, ?, ?)")
                .bind(&id)
                .bind(title)
                .bind(summary)
                .bind(content)
                .bind(read_time)
                .execute(pool)
                .await;
            
            // Set the legacy columns to NULL to indicate migration complete for this row
            let _ = sqlx::query("UPDATE posts SET title = NULL, summary = NULL, content = NULL, read_time = NULL WHERE id = ?")
                .bind(&id)
                .execute(pool)
                .await;
        }
    }

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS post_upvotes (
            post_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS comment_upvotes (
            comment_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (comment_id, user_id),
            FOREIGN KEY (comment_id) REFERENCES comments(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        "#
    )
    .execute(pool)
    .await?;

    // Create categories table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            meta_domain TEXT NOT NULL,
            icon TEXT NOT NULL,
            description TEXT NOT NULL
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS saved_posts (
            post_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        "#
    )
    .execute(pool)
    .await?;

    // Seed categories if empty
    let cat_count: (i64,) = sqlx::query_as("SELECT count(*) FROM categories")
        .fetch_one(pool)
        .await?;

    if cat_count.0 == 0 {
        let default_categories = vec![
            ("linux", "Operating Systems", "SYSTEMS & INFRASTRUCTURE", "linux-logo", "Linux kernel, shell, and OS internals"),
            ("cybersecurity", "Cybersecurity", "SYSTEMS & INFRASTRUCTURE", "shield-check", "Security analysis, cryptography, and audits"),
            ("terminal", "Terminal", "SYSTEMS & INFRASTRUCTURE", "terminal", "Shell scripting and command-line efficiency"),
            ("backend", "Backend Engineering", "SOFTWARE DEVELOPMENT", "cpu", "Database design, microservices, and APIs"),
            ("devops", "DevOps", "SOFTWARE DEVELOPMENT", "gear", "CI/CD pipelines, Docker, and automation"),
            ("academic", "Academic", "SOFTWARE DEVELOPMENT", "book-open", "Computer science papers and research topics"),
            ("ai", "AI", "AI & DATA SCIENCE", "brain", "Artificial intelligence and neural networks"),
            ("book", "Books", "RESOURCES & DIGITAL PRODUCTS", "book", "E-books and manuals"),
            ("latex", "LaTeX Templates", "RESOURCES & DIGITAL PRODUCTS", "file-text", "LaTeX CVs and resumes"),
        ];

        for (id, name, meta_domain, icon, desc) in default_categories {
            sqlx::query(
                "INSERT INTO categories (id, name, meta_domain, icon, description) VALUES (?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(name)
            .bind(meta_domain)
            .bind(icon)
            .bind(desc)
            .execute(pool)
            .await?;
        }
    }

    // Check if empty, if so, seed
    let count: (i64,) = sqlx::query_as("SELECT count(*) FROM posts")
        .fetch_one(pool)
        .await?;

    if count.0 == 0 {
        println!("Seeding database...");
        seed_db(pool).await?;
    }

    Ok(())
}

async fn seed_db(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    let posts = vec![
        (
            "rust-ownership-model",
            "Demystifying the Rust Ownership Model",
            "2026-05-28",
            r#"["Rust", "Memory Safety", "Systems Programming"]"#,
            "A deep dive into how Rust guarantees memory safety without a garbage collector through its unique ownership and borrowing system.",
            8,
            "Rust's ownership model is its most distinct and compelling feature. For developers coming from garbage-collected languages (like Java or Python) or manually-managed languages (like C or C++), it requires a fundamental shift in thinking.\n\n### The Problem it Solves\nIn systems programming, memory management is notoriously difficult. You either pay the runtime cost of a garbage collector (GC), pausing execution to clean up unreferenced memory, or you manually allocate and free memory, leading to notorious bugs like use-after-free, double-free, and memory leaks.\n\nRust says: *Why not neither?*\n\n### The Rules of Ownership\nRust enforces memory safety at compile time using a set of rules:\n1. Each value in Rust has a variable that's called its *owner*.\n2. There can only be one owner at a time.\n3. When the owner goes out of scope, the value will be dropped.\n\nThis simple set of rules eliminates a massive class of bugs before your code even runs.\n\n### Borrowing: Letting Others Peek\nOwnership alone would be restrictive. If I pass a variable to a function, I don't always want that function to take ownership and consume it. This is where *borrowing* comes in.\n\nUsing references (`&T`), you can allow other parts of your code to access a value without taking ownership. But there's a catch: you can have either one mutable reference (`&mut T`) OR any number of immutable references (`&T`), but not both simultaneously. This prevents data races at compile time.\n\nUnderstanding these concepts is the key to unlocking the full power of Rust. It's not just about safety; it's about shifting the cognitive load of memory management from the programmer to the compiler."
        ),
        (
            "linux-kernel-contribution",
            "My First Journey into the Linux Kernel",
            "2026-05-15",
            r#"["Linux", "Kernel", "Open Source", "C"]"#,
            "Navigating the mailing lists, understanding the workflow, and finally getting my first patch merged into the Linux kernel.",
            12,
            "Contributing to the Linux kernel is often seen as this mythical, insurmountable mountain for new developers. The codebase is massive, the workflow is seemingly antiquated (email? really?), and the maintainers are notoriously strict. \n\nHowever, my recent experience proved that while it's challenging, it's also incredibly rewarding and surprisingly accessible if you approach it the right way.\n\n### Finding a Starting Point\nDon't try to rewrite the scheduler on your first try. My approach was to use a static analysis tool (like Smatch or Coccinelle) to find minor bugs in peripheral drivers. The staging tree (`drivers/staging`) is explicitly designed for code that needs cleanup, making it a perfect playground for newcomers.\n\n### The Mighty Email Workflow\nGit was built for the Linux kernel, and the kernel relies heavily on patch series sent via email using `git send-email`. This felt like stepping back in time, but it forces a level of discipline. You can't just push a broken commit to a branch and fix it later; every patch you submit must compile and (mostly) make sense on its own.\n\n### Lessons Learned\n1.  **Read the documentation:** Specifically `Documentation/process/`. It's all there.\n2.  **Lurk before you leap:** Spend a few weeks reading the mailing list for the subsystem you want to contribute to. Get a feel for the rhythm and expectations.\n3.  **Accept criticism gracefully:** Your code will be critiqued. It's not personal. Embrace the feedback; you are learning from some of the best systems engineers in the world.\n\nMy first patch was tiny—just fixing a memory leak in an obscure network driver context path—but seeing my name in the mainline tree was an unparalleled thrill."
        ),
        (
            "why-i-use-arch-btw",
            "Yes, I Use Arch, and Here is Why",
            "2026-04-10",
            r#"["Linux", "Arch", "Dotfiles", "Productivity"]"#,
            "Cutting through the meme: A practical look at why a rolling release, DIY distribution genuinely improves my workflow.",
            6,
            "We all know the meme. But beyond the elitism, there are very practical reasons why Arch Linux remains my daily driver for software development.\n\n### The Pacman Ecosystem and AUR\nThe magic of Arch isn't just the rolling release model; it's the package manager (`pacman`) and the Arch User Repository (AUR). \n\nIf a piece of software exists for Linux, it is invariably in the AUR. On Debian or Ubuntu, I constantly found myself adding PPAs, downloading `.deb` files manually, or compiling from source. With an AUR helper (like `yay` or `paru`), installing almost anything is a single, unified command.\n\n### Zero Bloat, Complete Control\nWhen you install Ubuntu, you get Ubuntu's idea of a good desktop. When you install Arch, you get a command prompt. \n\nYou build the system up, not tear it down. For me, this means a custom Wayland compositor (Sway), exactly the terminal emulator I want (Alacritty), and precisely zero background services that I didn't explicitly enable. This creates a remarkably lean and snappy environment.\n\n### The Bleeding Edge\nAs a developer, especially when working with newer languages like Rust or modern container runtimes, having up-to-date packages is critical. On LTS distributions, I often felt constrained by years-old library versions. Arch guarantees I'm interacting with the latest upstream releases.\n\nIt requires discipline—you must read the news before upgrading—but the trade-off for a customized, frictionless development environment is entirely worth it."
        ),
        (
            "building-tui-rust",
            "Building Terminal UIs in Rust with Ratatui",
            "2026-03-22",
            r#"["Rust", "TUI", "Open Source"]"#,
            "A tutorial on creating rich, interactive command-line applications using the Ratatui library.",
            10,
            "The terminal isn't just for running sed and awk scripts; it's a Canvas for user interfaces. Rust, with its focus on performance and safety, is arguably the best language today for building Terminal User Interfaces (TUIs).\n\n### Enter Ratatui\nWhile `termion` and `crossterm` handle the low-level interactions (raw mode, event parsing), `ratatui` (a community fork of the original `tui-rs`) provides the widget rendering logic.\n\n### The Architecture of a TUI\nA typical TUI application operates in a loop:\n1.  **Poll for events:** (Keyboard input, mouse clicks, resize events).\n2.  **Update application state:** React to the inputs.\n3.  **Draw the UI:** Render widgets based on the current state.\n\nRatatui utilizes an immediate mode rendering paradigm. You don't create stateful UI objects (`Button`, `List`) and mutate them. Instead, on every frame, you declare down the entire UI tree based on your application's state.\n\n### Why I Love This Paradigm\nThis approach fits beautifully with Rust's ownership model. Because the UI is declared transiently on every frame, you don't have to worry about complex referencing or lifetimes between your data model and long-lived UI components.\n\nBuilding an interactive, responsive dashboard for a command-line tool has never been more enjoyable. The era of the sophisticated TUI is definitely here."
        )
    ];

    for (id, title, date, tags, summary, read_time, content) in posts {
        sqlx::query(
            "INSERT INTO posts (id, date, tags, summary, content, read_time, upvotes) VALUES (?, ?, ?, '', '', 0, 0)"
        )
        .bind(id)
        .bind(date)
        .bind(tags)
        .execute(pool)
        .await?;
        
        sqlx::query(
            "INSERT INTO post_translations (post_id, language, title, summary, content, read_time) VALUES (?, 'en', ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(title)
        .bind(summary)
        .bind(content)
        .bind(read_time)
        .execute(pool)
        .await?;
    }

    Ok(())
}
