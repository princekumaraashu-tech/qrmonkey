/**
 * Compress an image file to a base64 string using Canvas API.
 * @param {File} file - The image file to compress
 * @param {number} maxWidth - Maximum width of the compressed image (default: 200)
 * @param {number} maxHeight - Maximum height of the compressed image (default: 200)
 * @param {number} quality - JPEG compression quality 0.0 - 1.0 (default: 0.5)
 * @returns {Promise<string>} - The base64 data URL of the compressed image
 */
export const compressImage = (file, maxWidth = 200, maxHeight = 200, quality = 0.5) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height *= maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width *= maxHeight / height));
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG Base64
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = (err) => {
                reject(err);
            };
        };
        reader.onerror = (err) => {
            reject(err);
        };
    });
};

/**
 * Dummy function for decompression logic if ever needed,
 * but since we store as Base64 Data URL, browsers render it directly.
 */
export const decompressImage = (base64String) => {
    return base64String;
};
