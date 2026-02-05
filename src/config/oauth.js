const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const crypto = require('crypto');

// Load environment variables
require('dotenv').config();

/**
 * Production OAuth Configuration
 * 
 * Required Environment Variables:
 * - FACEBOOK_APP_ID
 * - FACEBOOK_APP_SECRET  
 * - TWITTER_CONSUMER_KEY
 * - TWITTER_CONSUMER_SECRET
 * - OAUTH_CALLBACK_URL (your production domain, e.g., https://yourdomain.com)
 */

// OAuth Configuration
const OAUTH_CONFIG = {
    facebook: {
        clientID: process.env.FACEBOOK_APP_ID || '',
        clientSecret: process.env.FACEBOOK_APP_SECRET || '',
        callbackURL: `${process.env.OAUTH_CALLBACK_URL || 'http://localhost:4000'}/admin/api/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'emails', 'photos']
    },
    twitter: {
        consumerKey: process.env.TWITTER_CONSUMER_KEY || '',
        consumerSecret: process.env.TWITTER_CONSUMER_SECRET || '',
        callbackURL: `${process.env.OAUTH_CALLBACK_URL || 'http://localhost:4000'}/admin/api/auth/twitter/callback`,
        includeEmail: true
    }
};

// Check if OAuth is configured
const isFacebookConfigured = () => OAUTH_CONFIG.facebook.clientID && OAUTH_CONFIG.facebook.clientSecret;
const isTwitterConfigured = () => OAUTH_CONFIG.twitter.consumerKey && OAUTH_CONFIG.twitter.consumerSecret;

// Facebook Strategy
if (isFacebookConfigured()) {
    passport.use(new FacebookStrategy(
        OAUTH_CONFIG.facebook,
        async (accessToken, refreshToken, profile, done) => {
            try {
                const userProfile = {
                    provider: 'facebook',
                    profile_id: profile.id,
                    name: profile.displayName,
                    email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
                    photo: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                    accessToken
                };
                return done(null, userProfile);
            } catch (error) {
                return done(error, null);
            }
        }
    ));
    console.log('✅ Facebook OAuth strategy configured');
} else {
    console.warn('⚠️  Facebook OAuth not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env');
}

// Twitter Strategy
if (isTwitterConfigured()) {
    passport.use(new TwitterStrategy(
        OAUTH_CONFIG.twitter,
        async (token, tokenSecret, profile, done) => {
            try {
                const userProfile = {
                    provider: 'twitter',
                    profile_id: profile.id,
                    name: profile.displayName,
                    email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
                    photo: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                    username: profile.username
                };
                return done(null, userProfile);
            } catch (error) {
                return done(error, null);
            }
        }
    ));
    console.log('✅ Twitter OAuth strategy configured');
} else {
    console.warn('⚠️  Twitter OAuth not configured. Set TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET in .env');
}

// Passport serialization (required for session support)
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

module.exports = {
    passport,
    isFacebookConfigured,
    isTwitterConfigured,
    OAUTH_CONFIG
};
