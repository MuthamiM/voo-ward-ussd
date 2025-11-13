# Admin Dashboard UI Cleanup — Summary

Date: 2025-11-13

Summary:
- Removed visible chatbot/help UI from the admin dashboard front-ends.
- Removed Chat History tab UI and export buttons from the admin HTML copies.
- Replaced client-side `exportData(type)` implementations with a harmless no-op stub that logs and shows a toast indicating export is disabled.
- Gated server-side chat history APIs behind an explicit feature flag `ENABLE_CHAT_HISTORY` (must be set to `true` to enable endpoints).

Files changed (high-level):
- `public/admin-dashboard.html` — removed chatbot UI, replaced export behaviour with stub
- `backend/public/admin-dashboard.html` — same as above
- `backend/backend/public/admin-dashboard.html` — same as above
- `src/admin-dashboard.js` and `backend/src/admin-dashboard.js` and `backend/backend/src/admin-dashboard.js` — added feature-flag and middleware `requireChatHistoryEnabled` and applied to chat endpoints

Notes:
- Export stubs are intentionally kept to avoid runtime errors from any remaining callers. If you want export re-enabled, implement a server-side, auth-protected CSV export and set the UI to call that endpoint.
- The chat-history server routes were not removed; they are feature-gated. To enable them in development, set `ENABLE_CHAT_HISTORY=true` in the environment before starting the server.

If you'd like, I can now:
- Consolidate the three admin HTML copies into a single template (recommended long-term), or
- Remove the server-side chat code entirely (destructive), or
- Open a PR and add a test to ensure `exportData` remains disabled unless explicitly re-enabled.
