// Notification worker removed
// Previous implementation polled a notifications collection and attempted delivery via Twilio.
// Notifications are deprecated for this deployment; keep a minimal placeholder to avoid accidental runs.
module.exports = {
  run: async function() {
    console.log('[worker] notification worker disabled in this deployment');
    return;
  }
};
