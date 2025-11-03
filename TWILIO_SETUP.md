# 🚀 Twilio USSD Setup - Get Live in 30 Minutes!

## ✅ Your Backend is Ready for Twilio!

**Cloudflare URL:** https://site-accounts-exhibitions-oils.trycloudflare.com/ussd
**Status:** ✅ Already configured to support Twilio format

---

## 📱 Step 1: Sign Up for Twilio (5 minutes)

1. **Go to:** https://www.twilio.com/try-twilio
2. **Sign up** with your email
3. **Verify your phone number** (they'll send SMS code)
4. **Get $15 FREE credit** - No credit card required!
5. **Skip the tutorial** (or complete it quickly)

---

## 🇰🇪 Step 2: Get a Kenya Phone Number (5 minutes)

### In Twilio Console:

1. **Click:** Phone Numbers → Manage → Buy a number
2. **Select Country:** Kenya (+254)
3. **Capabilities:** Check "Voice" and "SMS" (USSD uses Voice)
4. **Search** for available numbers
5. **Buy Number** (Uses your free credit - about $1-2/month)

### Your Number Will Look Like:
```
+254 XXX XXX XXX
```

---

## ⚙️ Step 3: Configure USSD Service (5 minutes)

### In Your Twilio Number Settings:

1. **Go to:** Phone Numbers → Manage → Active Numbers
2. **Click on** your Kenya number
3. **Scroll to:** "Voice & Fax" section
4. **Configure as follows:**

```
A CALL COMES IN:
Webhook: https://site-accounts-exhibitions-oils.trycloudflare.com/ussd
HTTP: POST
```

5. **Click "Save"**

---

## 🧪 Step 4: Test USSD Code (2 minutes)

### On Your Phone:
Dial your Twilio number: **`+254XXXXXXXXX`**

You should hear or see:
```
KYAMATU WARD - FREE SERVICE

Select Language:
1. English
2. Swahili
3. Kamba
```

### Using Twilio Console:
1. Go to: **Monitor → Logs → Calls**
2. You'll see your test call
3. Click on it to see request/response details

---

## 🎯 Step 5: Get Shortcode (Optional - Takes 2-4 weeks)

For a real shortcode like `*384*8481#`:

1. **In Twilio Console:** Programmable Voice → USSD → Get Started
2. **Fill application:**
   - Service Name: "Kyamatu Ward Services"
   - Description: "Citizen services for Kyamatu Ward - registration, bursaries, issue reporting"
   - Country: Kenya
   - Target audience: Ward constituents
3. **Submit application**
4. **Wait for approval** (2-4 weeks)

### Meanwhile: Use your phone number!
Citizens can call your Twilio number and get the same USSD experience.

---

## 💰 Twilio Pricing (Very Affordable)

### Monthly Costs:
- **Phone Number:** ~$1-2/month
- **Voice calls (USSD):** ~$0.015/minute (1.5 cents)
- **SMS (if you add notifications):** ~$0.05/message (5 cents)

### Example Usage:
- 100 USSD sessions/day = ~$45/month
- 500 USSD sessions/day = ~$225/month
- **Your free $15 = ~1000 USSD sessions!**

---

## 🔄 How It Works with Your System

### Africa's Talking Format:
```
sessionId=ATUid_123
phoneNumber=+254712345678
serviceCode=*384*8481#
text=1*2*Kyamatu
```

### Twilio Format:
```
From=+254712345678
Body=1*2*Kyamatu
CallSid=CAxxxx...
```

### Your Backend Automatically Converts Both! ✅

---

## 🎉 Advantages of Twilio

✅ **Instant activation** (no waiting for account approval)  
✅ **Free $15 credit** (test everything before paying)  
✅ **Better documentation** and support  
✅ **Global reach** (works worldwide)  
✅ **Reliable infrastructure** (99.95% uptime SLA)  
✅ **Easy testing** (web-based console)  
✅ **SMS integration** ready (same account)  
✅ **Voice calls** (for IVR menu later)  

---

## 📊 What Your Citizens Will Experience

### Option A: Using Shortcode (After Approval)
Citizens dial: **`*384*8481#`**
- Same experience as Africa's Talking
- Free for citizens
- Professional shortcode

### Option B: Using Phone Number (Immediate)
Citizens call: **`+254XXXXXXXXX`**
- IVR-style menu navigation
- Press 1, 2, 3 for options
- Small airtime cost for citizens (~$0.01)

---

## 🔧 Troubleshooting

### Issue: "Number not available in Kenya"
**Solution:** 
- Try different number search
- Or buy US number first, then request Kenya number from support
- Kenya numbers sometimes limited - contact Twilio support

### Issue: "Webhook unreachable"
**Solution:**
- Verify Cloudflare tunnel is running (VOO-Tunnel window)
- Test health check: https://site-accounts-exhibitions-oils.trycloudflare.com/health
- Check URL spelling in Twilio console

### Issue: "Call connects but no menu"
**Solution:**
- Check backend logs in VOO-Backend window
- Verify webhook is POST (not GET)
- Test with PowerShell script (see below)

---

## 🧪 Test Your Twilio Integration

Run this in PowerShell:

```powershell
# Test Twilio format request
$body = @{
    From = "+254712345678"
    Body = ""
    CallSid = "CA_test_123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://site-accounts-exhibitions-oils.trycloudflare.com/ussd" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

Expected response:
```
CON KYAMATU WARD - FREE SERVICE

Select Language:
1. English
2. Swahili
3. Kamba
```

---

## 📞 Next Steps After Setup

1. ✅ **Test registration** flow with real phone
2. ✅ **Share phone number** with test users
3. ✅ **Monitor usage** in Twilio console
4. ✅ **Apply for shortcode** (parallel track)
5. ✅ **Add SMS notifications** (later)

---

## 🔄 Switching Back to Africa's Talking Later

When AT activates, just:
1. Update AT callback URL to your Cloudflare tunnel
2. Citizens dial `*384*8481#` instead of phone number
3. **No code changes needed** - your backend supports both! ✅

---

## 🆘 Need Help?

**Twilio Support:**
- Help Center: https://support.twilio.com
- Console: https://console.twilio.com
- Phone: Check your console for support number
- Community: https://stackoverflow.com/questions/tagged/twilio

**Response Time:**
- Free tier: 24-48 hours
- Paid tier: 4-6 hours
- Critical issues: 1 hour (paid)

---

## 🎯 Quick Start Checklist

- [ ] Sign up for Twilio account
- [ ] Verify your phone number
- [ ] Buy a Kenya phone number (+254)
- [ ] Configure webhook URL to Cloudflare tunnel
- [ ] Test call from your phone
- [ ] Share number with 2-3 test users
- [ ] Monitor calls in Twilio console
- [ ] Apply for shortcode (optional, later)

---

**🚀 Your system is ready! Just sign up for Twilio and configure the webhook! 🚀**

**Start here:** https://www.twilio.com/try-twilio
