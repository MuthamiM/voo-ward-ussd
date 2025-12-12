require('dotenv').config();
const { listImages } = require('./src/lib/cloudinaryService');

async function checkProductionImages() {
    console.log('Checking voo-ward/issues...');
    const result = await listImages('issues'); // this prefixes voo-ward/ inside the service

    if (result.success) {
        console.log(`Found ${result.images.length} images.`);
        result.images.forEach(img => {
            console.log(`- ${img.publicId} (${img.bytes} bytes)`);
        });
    } else {
        console.error('Error listing images:', result.error);
    }
}

checkProductionImages();
