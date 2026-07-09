use std::fs;
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let uploads_dir = Path::new("uploads");
    if !uploads_dir.exists() {
        println!("No uploads directory found.");
        return Ok(());
    }

    println!("Scanning uploads directory for images to optimize...");
    let entries = fs::read_dir(uploads_dir)?;

    let mut total_original_size = 0;
    let mut total_optimized_size = 0;
    let mut files_optimized = 0;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            // Skip hidden files
            if filename.starts_with('.') {
                continue;
            }

            let original_size = entry.metadata()?.len();
            let data = match fs::read(&path) {
                Ok(d) => d,
                Err(e) => {
                    println!("Failed to read {}: {}", filename, e);
                    continue;
                }
            };

            // Attempt to load as image
            let img = match image::load_from_memory(&data) {
                Ok(i) => i,
                Err(_) => {
                    // Skip files that aren't valid images (e.g. .html or directory)
                    continue;
                }
            };

            let original_width = img.width();
            let original_height = img.height();

            // Resize if width > 1000px
            let img = if original_width > 1000 {
                img.resize(1000, 1000, image::imageops::FilterType::Lanczos3)
            } else {
                img
            };

            let encoder = match webp::Encoder::from_image(&img) {
                Ok(e) => e,
                Err(e) => {
                    println!("Failed to create WebP encoder for {}: {}", filename, e);
                    continue;
                }
            };
            let webp_data = encoder.encode(75.0);
            let optimized_size = webp_data.len() as u64;

            if let Err(e) = fs::write(&path, &*webp_data) {
                println!("Failed to write optimized file {}: {}", filename, e);
                continue;
            }

            total_original_size += original_size;
            total_optimized_size += optimized_size;
            files_optimized += 1;

            let savings_percent = if original_size > 0 {
                ((original_size as f64 - optimized_size as f64) / original_size as f64) * 100.0
            } else {
                0.0
            };

            println!(
                "Optimized {}: {}x{} -> {}x{}, size: {:.1} KiB -> {:.1} KiB ({:.1}% saved)",
                filename,
                original_width,
                original_height,
                img.width(),
                img.height(),
                original_size as f64 / 1024.0,
                optimized_size as f64 / 1024.0,
                savings_percent
            );
        }
    }

    if files_optimized > 0 {
        let total_saved = total_original_size.saturating_sub(total_optimized_size);
        println!("\nOptimization complete!");
        println!("Total files optimized: {}", files_optimized);
        println!("Original total size: {:.1} MiB", total_original_size as f64 / (1024.0 * 1024.0));
        println!("Optimized total size: {:.1} MiB", total_optimized_size as f64 / (1024.0 * 1024.0));
        println!("Total space saved: {:.1} MiB ({:.1}% saved)", total_saved as f64 / (1024.0 * 1024.0), (total_saved as f64 / total_original_size as f64) * 100.0);
    } else {
        println!("\nNo images optimized.");
    }

    Ok(())
}
