/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Keeps aspect ratio, limits max dimension to `maxSize` (default 600px),
 * and converts to JPEG with specified quality (default 0.75).
 * Results in ~30KB-70KB payload instead of 5MB-10MB raw photos.
 */
export const compressImage = (file, maxSize = 600, quality = 0.75) => {
    return new Promise((resolve, reject) => {
        if (!file) return resolve('');
        if (!file.type || !file.type.startsWith('image/')) {
            return reject(new Error('Selected file is not an image.'));
        }

        const reader = new FileReader();
        reader.onerror = (err) => reject(err);
        reader.onloadend = () => {
            const img = new Image();
            img.onerror = (err) => reject(err);
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxSize) {
                            height = Math.round((height * maxSize) / width);
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width = Math.round((width * maxSize) / height);
                            height = maxSize;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedBase64);
                } catch (err) {
                    console.warn('Canvas compression failed, returning raw base64 fallback:', err);
                    resolve(reader.result);
                }
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
};
