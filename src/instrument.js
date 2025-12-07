// Sentry Instrumentation - Import this at top of entry point
const Sentry = require("@sentry/node");

Sentry.init({
    dsn: "https://8801540c331f45f5c9d457be5f3129d6@o4510493292560384.ingest.de.sentry.io/4510493334569040",

    // Environment
    environment: process.env.NODE_ENV || 'production',

    // Send default PII data (IP address, etc)
    sendDefaultPii: true,

    // Performance monitoring - 10% of transactions
    tracesSampleRate: 0.1,

    // Profiling sample rate
    profilesSampleRate: 0.1,

    // Don't send errors in development
    beforeSend(event) {
        if (process.env.NODE_ENV === 'development') {
            console.log('Sentry event (dev mode - not sent):', event.exception?.values?.[0]?.type);
            return null;
        }
        return event;
    }
});

console.log('Sentry error tracking initialized');

module.exports = Sentry;
