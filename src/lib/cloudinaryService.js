/**
 * Cloudinary Service
 * Handles image uploads to Cloudinary for issue images
 */

const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a base64 image to Cloudinary
 * @param {string} base64Image - Base64 encoded image (with or without data URL prefix)
 * @param {string} folder - Folder to store the image in (e.g., 'issues', 'bursaries')
 * @returns {Promise<{success: boolean, url?: string, publicId?: string, error?: string}>}
 */
async function uploadBase64Image(base64Image, folder = 'issues') {
    try {
        // Ensure the image has the data URL prefix for Cloudinary
        let imageData = base64Image;
        if (!imageData.startsWith('data:')) {
            imageData = `data:image/jpeg;base64,${base64Image}`;
        }

        const result = await cloudinary.uploader.upload(imageData, {
            folder: `voo-ward/${folder}`,
            resource_type: 'image',
            transformation: [
                { width: 1200, height: 1200, crop: 'limit' }, // Max size
                { quality: 'auto:good' }, // Optimize quality
                { fetch_format: 'auto' }  // Auto format (webp for browsers that support it)
            ]
        });

        logger.info(`Image uploaded to Cloudinary: ${result.public_id}`);

        return {
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            thumbnailUrl: cloudinary.url(result.public_id, {
                width: 200,
                height: 200,
                crop: 'fill',
                quality: 'auto'
            })
        };
    } catch (error) {
        logger.error('Cloudinary upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Upload multiple base64 images to Cloudinary
 * @param {string[]} images - Array of base64 encoded images
 * @param {string} folder - Folder to store images in
 * @returns {Promise<{urls: string[], thumbnails: string[]}>}
 */
async function uploadMultipleImages(images, folder = 'issues') {
    const urls = [];
    const thumbnails = [];

    for (let i = 0; i < Math.min(images.length, 5); i++) { // Max 5 images
        const result = await uploadBase64Image(images[i], folder);
        if (result.success) {
            urls.push(result.url);
            thumbnails.push(result.thumbnailUrl);
        }
    }

    return { urls, thumbnails };
}

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - The public ID of the image
 */
async function deleteImage(publicId) {
    try {
        await cloudinary.uploader.destroy(publicId);
        logger.info(`Image deleted from Cloudinary: ${publicId}`);
        return { success: true };
    } catch (error) {
        logger.error('Cloudinary delete error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * List all images from Cloudinary folder
 * @param {string} folder - Folder to list images from
 * @param {number} maxResults - Maximum number of images to return
 * @returns {Promise<{success: boolean, images?: array, error?: string}>}
 */
async function listImages(folder = 'issues', maxResults = 100) {
    try {
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: `voo-ward/${folder}`,
            max_results: maxResults,
            resource_type: 'image'
        });

        const images = result.resources.map(img => ({
            publicId: img.public_id,
            url: img.secure_url,
            thumbnailUrl: cloudinary.url(img.public_id, {
                width: 200,
                height: 200,
                crop: 'fill',
                quality: 'auto'
            }),
            format: img.format,
            createdAt: img.created_at,
            bytes: img.bytes
        }));

        return { success: true, images };
    } catch (error) {
        logger.error('Cloudinary list error:', error);
        return { success: false, error: error.message, images: [] };
    }
}

module.exports = {
    uploadBase64Image,
    uploadMultipleImages,
    deleteImage,
    listImages,
    cloudinary
};
