# VOO KYAMATU - AUTO-RESTART DEVELOPMENT MODE

## ✅ SERVERS NOW CONFIGURED FOR AUTO-RESTART!

All servers will automatically restart when you make changes. **No need to manually restart anymore!**

---

## 🔄 What's Enabled

### 1. **Backend Auto-Restart (Nodemon)**
- **Watches:** `backend/src/` and `backend/db/` folders
- **Triggers:** When you save any `.js`, `.json`, or `.sql` file
- **Restart Time:** 1 second delay
- **Manual Restart:** Type `rs` + Enter in the backend window

**Example:**
```
You edit: backend/src/routes/admin.js
You save the file
→ Backend automatically restarts in 1 second
→ Your changes are live!
```

### 2. **Frontend Hot Module Replacement (Vite HMR)**
- **Watches:** `frontend/src/` folder
- **Triggers:** When you save any `.jsx`, `.js`, `.css` file
- **Update Time:** INSTANT (no restart needed!)
- **Browser:** Updates automatically without refresh

**Example:**
```
You edit: frontend/src/App.jsx
You save the file
→ Browser updates INSTANTLY
→ No page refresh needed!
```

### 3. **Ngrok Tunnel (Persistent)**
- **Status:** Always running
- **No restart needed:** Tunnel stays active
- **Public URL:** https://nonlegitimate-jay-feigningly.ngrok-free.dev

---

## 📝 How to Use

### Starting Development Mode

**Option 1: Using the Backend & Frontend Windows (Current)**
- Backend window is already running with nodemon
- Frontend window is already running with Vite
- Ngrok window is running with tunnel

**Just start coding! Changes apply automatically!**

---

### Making Changes

#### Backend Changes:
1. Open any file in `backend/src/` or `backend/db/`
2. Make your changes
3. **Save the file (Ctrl+S)**
4. Wait 1 second
5. ✓ Backend has restarted with your changes!

#### Frontend Changes:
1. Open any file in `frontend/src/`
2. Make your changes
3. **Save the file (Ctrl+S)**
4. ✓ Browser updates INSTANTLY!

---

## 🎯 Quick Reference

### Backend Window Commands:
- `rs` + Enter → Manually restart backend immediately
- `Ctrl+C` → Stop backend server

### What Files Trigger Auto-Restart:

**Backend (Auto-Restart):**
- `*.js` - All JavaScript files
- `*.json` - Config files
- `*.sql` - Database migrations
- In folders: `src/`, `db/`

**Frontend (Hot Reload):**
- `*.jsx` - React components
- `*.js` - JavaScript modules
- `*.css` - Stylesheets
- In folder: `src/`

---

## 📊 Current Status

```
✓ Backend:  http://localhost:4000  (Auto-restart enabled)
✓ Frontend: http://localhost:5173  (Hot reload enabled)
✓ Ngrok:    https://nonlegitimate-jay-feigningly.ngrok-free.dev/ussd
```

---

## 🔧 Configuration Files

### Backend: `nodemon.json`
```json
{
  "watch": ["src", "db"],
  "ext": "js,json,sql",
  "delay": 1000,
  "restartable": "rs"
}
```

### Backend: `package.json` scripts
```json
{
  "dev": "nodemon src/index.js",
  "watch": "nodemon --watch src --watch db src/index.js"
}
```

### Frontend: Uses Vite built-in HMR
- No configuration needed
- Automatically enabled in dev mode

---

## ⚠️ Important Notes

1. **Backend restarts take ~2-3 seconds**
   - Server stops, reloads code, starts again
   - Active USSD sessions may be interrupted
   - Test after each change

2. **Frontend updates are instant**
   - No server restart
   - React components hot-reload
   - State may be preserved (depending on changes)

3. **Database changes**
   - Editing `.sql` files triggers backend restart
   - Run migrations manually if needed

4. **Environment variables**
   - Changes to `.env` require manual restart
   - Stop backend (Ctrl+C) and restart window

---

## 🚀 Workflow Example

### Adding a New USSD Feature

1. **Edit backend handler:**
   ```
   Open: backend/src/routes/ussd.js
   Add new code
   Save (Ctrl+S)
   → Backend auto-restarts (1 second)
   ```

2. **Test USSD:**
   ```
   Use Africa's Talking Simulator
   Dial *340*75#
   Test your changes
   ```

3. **If you need to fix something:**
   ```
   Edit ussd.js again
   Save
   → Auto-restarts again
   Test again
   ```

**No manual restarts needed!**

---

### Updating Admin Dashboard

1. **Edit React component:**
   ```
   Open: frontend/src/App.jsx
   Make changes
   Save (Ctrl+S)
   → Browser updates INSTANTLY
   ```

2. **See changes immediately:**
   ```
   Look at http://localhost:5173
   Your changes are already visible!
   No refresh needed!
   ```

---

## 🛠️ Troubleshooting

### Backend not auto-restarting:
1. Check the backend window for errors
2. Make sure file is in `src/` or `db/` folder
3. Try manual restart: Type `rs` + Enter
4. Check `nodemon.json` configuration

### Frontend not hot-reloading:
1. Check the frontend window for errors
2. Refresh browser manually (F5)
3. Check Vite server is running on port 5173
4. Some changes require full page refresh

### Servers stopped:
```powershell
# Restart backend
cd C:\Users\Admin\USSD\backend
npm run dev

# Restart frontend  
cd C:\Users\Admin\USSD\frontend
npm run dev

# Restart ngrok
ngrok http 4000
```

---

## 📖 Additional Resources

- **Nodemon Docs:** https://nodemon.io/
- **Vite HMR Docs:** https://vitejs.dev/guide/features.html#hot-module-replacement
- **VS Code:** Use file watchers for instant feedback

---

## ✨ Benefits

✅ **No manual restarts** - Save time during development
✅ **Faster feedback** - See changes in 1 second (backend) or instantly (frontend)
✅ **Less context switching** - Stay in your code editor
✅ **Fewer errors** - No forgetting to restart after changes
✅ **Professional workflow** - Industry standard development setup

---

**Happy Coding! 🎉**

Your servers are now watching for changes and will auto-restart/reload automatically!
