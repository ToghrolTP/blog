export function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // If browser does not support FileReader or Canvas, fallback to original file
    if (typeof FileReader === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // Fallback to original
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file); // Fallback
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file); // Fallback
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file); // Fallback
    reader.readAsDataURL(file);
  });
}
