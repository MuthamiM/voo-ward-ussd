const axios = require('axios');
const fs = require('fs');

async function testUpload() {
    const url = 'https://voo-ward-ussd-1.onrender.com/api/citizen/mobile/issues';
    // Small transparent pixel
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    console.log(`Testing upload to ${url}...`);

    try {
        const response = await axios.post(url, {
            phoneNumber: '0700000000',
            title: 'Test Issue from Script',
            category: 'Roads',
            description: 'Testing Cloudinary upload from script',
            location: 'Nairobi',
            fullName: 'Test Script',
            images: [base64Image] // Send as array of strings
        });

        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
    }
}

testUpload();
