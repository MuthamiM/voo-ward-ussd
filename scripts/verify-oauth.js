require('dotenv').config();
const oauth = require('../src/config/oauth');

console.log('--- OAuth Configuration Verification ---');
console.log(`Facebook Configured: ${oauth.isFacebookConfigured() ? '✅ Yes' : '❌ No'}`);
if (oauth.isFacebookConfigured()) {
    console.log(`  App ID: ${process.env.FACEBOOK_APP_ID ? 'Set (Hidden)' : 'Missing'}`);
    console.log(`  App Secret: ${process.env.FACEBOOK_APP_SECRET ? 'Set (Hidden)' : 'Missing'}`);
    console.log(`  Callback URL: ${oauth.OAUTH_CONFIG.facebook.callbackURL}`);
}

console.log(`Twitter Configured: ${oauth.isTwitterConfigured() ? '✅ Yes' : '❌ No'}`);
if (oauth.isTwitterConfigured()) {
    console.log(`  Consumer Key: ${process.env.TWITTER_CONSUMER_KEY ? 'Set (Hidden)' : 'Missing'}`);
    console.log(`  Consumer Secret: ${process.env.TWITTER_CONSUMER_SECRET ? 'Set (Hidden)' : 'Missing'}`);
    console.log(`  Callback URL: ${oauth.OAUTH_CONFIG.twitter.callbackURL}`);
}

console.log(`Base Callback URL: ${process.env.OAUTH_CALLBACK_URL || 'Defaulting to http://localhost:4000'}`);
console.log('----------------------------------------');
