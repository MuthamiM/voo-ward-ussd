require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function checkRecentUploads() {
    console.log('Checking most recent uploads (global)...');
    try {
        const result = await cloudinary.api.resources({
            type: 'upload',
            resource_type: 'image',
            max_results: 10,
            direction: 'desc' // Newest first
        });

        console.log(`Found ${result.resources.length} recent images:`);
        result.resources.forEach(img => {
            console.log(`- ${img.public_id} (Folder: ${img.folder}) - ${img.created_at}`);
        });
    } catch (e) {
        console.error('Error:', e);
    }
}

checkRecentUploads();
