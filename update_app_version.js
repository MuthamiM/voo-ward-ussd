/**
 * Update App Version in Supabase
 * Run this after uploading a new APK to GitHub
 */

const supabaseService = require('./src/services/supabaseService');

const NEW_VERSION = '11.0.6';
const NEW_DOWNLOAD_URL = 'https://github.com/MuthamiM/voo-citizen-app/releases/download/v11.0.6/VOO-Citizen-App-v11.0.6.apk';

async function updateAppVersion() {
    console.log('Updating app_config in Supabase...\n');
    
    // Update min_version
    console.log(`Setting min_version to: ${NEW_VERSION}`);
    const versionResult = await supabaseService.updateAppConfig('min_version', NEW_VERSION);
    console.log('min_version result:', versionResult);
    
    // Update download_url
    console.log(`\nSetting download_url to: ${NEW_DOWNLOAD_URL}`);
    const urlResult = await supabaseService.updateAppConfig('download_url', NEW_DOWNLOAD_URL);
    console.log('download_url result:', urlResult);
    
    // Verify the update
    console.log('\nVerifying config...');
    const config = await supabaseService.getAppConfig();
    console.log('Current app_config:');
    console.log('  min_version:', config.min_version);
    console.log('  download_url:', config.download_url);
    
    console.log('\n✅ Done!');
}

updateAppVersion().catch(console.error);
