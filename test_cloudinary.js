
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

async function testUpload() {
    console.log('Testing Cloudinary Configuration...');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
    console.log('API Key present:', !!process.env.CLOUDINARY_API_KEY);

    // Configure (usually done in lib/cloudinaryService but doing here for isolation)
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    try {
        console.log('Attempting to upload a small base64 image...');
        // A small 1x1 red pixel
        const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

        const result = await cloudinary.uploader.upload(base64Image, {
            folder: 'voo_citizen_tests',
            resource_type: 'image'
        });

        console.log('✅ Upload SUCCESS!');
        console.log('Secure URL:', result.secure_url);
        console.log('Public ID:', result.public_id);
    } catch (error) {
        console.error('❌ Upload FAILED:', error.message);
        if (error.error) console.error('Details:', error.error);
    }
}

testUpload();
