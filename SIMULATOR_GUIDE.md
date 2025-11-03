# 📱 How to Use Africa's Talking USSD Simulator - Step by Step

## ⚠️ IMPORTANT: The Simulator is NOT a Phone!

**You don't "call" anything!** The simulator sends HTTP requests directly to your backend.

---

## ✅ Correct Way to Use the Simulator

### Step 1: Make Sure Backend is Running

**Check these 3 windows are open:**
1. ✅ **VOO-Backend** - Shows backend logs
2. ✅ **VOO-Frontend** - Shows frontend running
3. ✅ **VOO-Tunnel** - Shows Cloudflare URL

**If not open, run:**
```powershell
C:\Users\Admin\USSD\START_ALL_SERVERS.bat
```

**Wait 10 seconds** for all servers to start.

---

### Step 2: Verify Backend is Online

**Test with this command:**
```powershell
Invoke-RestMethod -Uri "https://site-accounts-exhibitions-oils.trycloudflare.com/health"
```

**Expected response:**
```json
{
  "ok": true,
  "ussd": "active",
  "counts": {
    "members": 2
  }
}
```

If you get an error, backend is not running!

---

### Step 3: Access the Simulator

**Go to:** https://simulator.africastalking.com:1555/

OR

**From AT Dashboard:**
1. Login: https://account.africastalking.com
2. Switch to **Sandbox** mode
3. Click **USSD** → **Simulator**

---

### Step 4: Configure Simulator Settings

**Fill in these fields:**

```
Username: sandbox (should be pre-filled)
Service Code: *384*8481#
Phone Number: +254712345678 (your registered number)
Callback URL: https://site-accounts-exhibitions-oils.trycloudflare.com/ussd
```

**Click "Save Configuration" or "Update"**

---

### Step 5: Start a USSD Session

**There are TWO ways to test:**

#### Method A: Type in the USSD Input Box
1. In the **"Type USSD string"** input box
2. Type: `*384*8481#`
3. Click **"Send"** (NOT "Call"!)
4. Watch the response appear below

#### Method B: Use the Interactive Menu
1. Click **"Launch Session"** or **"Start"**
2. The simulator shows a phone screen
3. A text input box appears
4. Type: `*384*8481#`
5. Click **"Send"**

---

### Step 6: What You Should See

**First Response:**
```
CON KYAMATU WARD - FREE SERVICE

Select Language:
1. English
2. Swahili
3. Kamba
```

**CON** means "Continue" - the session is active!

---

### Step 7: Navigate the Menu

**To select an option:**
1. Type the number in the input box: `1`
2. Click **"Send"**
3. See next menu
4. Continue typing and sending

**Example Flow:**
```
You type: *384*8481#
Response: Language menu

You type: 1
Response: Main menu (News, Report Issue, etc.)

You type: 5
Response: Registration menu

You type: 12345678
Response: Enter your name
```

---

## 🔧 Troubleshooting

### Problem: "No response" or "Timeout"

**Solutions:**
1. ✅ Check backend is running (see VOO-Backend window)
2. ✅ Check Cloudflare tunnel (see VOO-Tunnel window)
3. ✅ Verify callback URL is correct
4. ✅ Make sure URL has `/ussd` at the end

### Problem: "Invalid callback URL"

**Check:**
- URL must start with `https://`
- URL must end with `/ussd`
- No spaces in URL
- Correct format: `https://site-accounts-exhibitions-oils.trycloudflare.com/ussd`

### Problem: "403 Forbidden" or "401 Unauthorized"

**This means:**
- Your phone number is not registered in sandbox
- Add your number in: Sandbox Settings → Test Numbers

### Problem: Backend shows "404 Not Found"

**This means:**
- The `/ussd` endpoint doesn't exist
- Backend might not be running
- Check backend logs in VOO-Backend window

### Problem: "END Too many requests"

**This means:**
- You hit the rate limit (30 requests per 5 minutes)
- Wait 5 minutes and try again
- OR restart backend to reset counter

---

## 📊 Understanding the Response Format

### Response Types:

**CON (Continue):**
- Session is ongoing
- User can type more input
- Shows menu or prompt

**END (End):**
- Session is finished
- No more input expected
- Shows final message

**Example:**
```
CON Select option:     ← User can continue
1. Option A
2. Option B

END Thank you!         ← Session ends here
```

---

## 🎯 Full Test Flow Example

### Test Registration:

**Step 1:**
```
Type: *384*8481#
Response: CON Language menu
```

**Step 2:**
```
Type: 1
Response: CON Main menu
```

**Step 3:**
```
Type: 5
Response: CON Register - Enter ID
```

**Step 4:**
```
Type: 12345678
Response: CON Enter your full name
```

**Step 5:**
```
Type: John Doe Smith
Response: CON Enter area
```

**Step 6:**
```
Type: Kyamatu
Response: CON Enter village
```

**Step 7:**
```
Type: Nguutani
Response: END Registered! Dial again to access services
```

**Step 8: Check Admin Dashboard**
- Open: http://localhost:5173
- Login: PIN 827700
- See "John Doe Smith" in constituents list!

---

## 💡 Pro Tips

### Tip 1: Watch Backend Logs
The VOO-Backend window shows:
- Every request received
- User selections
- Database operations
- Any errors

### Tip 2: Use Request Inspector
In simulator, there's usually a "Request/Response" tab showing:
- Raw HTTP request sent
- Raw HTTP response received
- Headers
- Timing

### Tip 3: Test Multiple Users
Open simulator in multiple browser tabs with different phone numbers:
- Tab 1: +254712345671
- Tab 2: +254712345672
- Tab 3: +254712345673

### Tip 4: Keep Session Active
USSD sessions timeout after ~30 seconds of inactivity.
Type quickly or session will end!

---

## 🚀 Quick Check Commands

**Run these in PowerShell to verify everything:**

### Check Backend:
```powershell
Invoke-RestMethod -Uri "https://site-accounts-exhibitions-oils.trycloudflare.com/health"
```

### Test USSD Endpoint:
```powershell
$body = "sessionId=TEST123&phoneNumber=%2B254712345678&serviceCode=*384*8481%23&text="
Invoke-WebRequest -Uri "https://site-accounts-exhibitions-oils.trycloudflare.com/ussd" -Method POST -Body $body -ContentType "application/x-www-form-urlencoded"
```

### Check Database:
```powershell
# Login to admin dashboard: http://localhost:5173
# PIN: 827700
```

---

## ✅ Success Checklist

Before using simulator:
- [ ] VOO-Backend window is open and shows "Server listening"
- [ ] VOO-Tunnel window is open and shows public URL
- [ ] Health check returns OK
- [ ] Simulator configuration saved
- [ ] Phone number added to sandbox test numbers

---

**Now try the simulator again! Don't click "Call" - just type `*384*8481#` and click "Send"!**
