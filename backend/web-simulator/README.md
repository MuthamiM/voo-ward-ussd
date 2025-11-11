# [NETWORK] Kyamatu Ward Web USSD Simulator

## Overview

Browser-based USSD simulator. No external service needed - works 100% in the browser!

## Features

- [SUCCESS] **No App Required:** Works in any web browser
- [SUCCESS] **Realistic USSD UI:** Looks like real phone USSD screen
- [SUCCESS] **Virtual Keypad:** Click buttons like real phone
- [SUCCESS] **3 Languages:** English, Swahili, Kamba
- [SUCCESS] **All Services:** Issues, Announcements, Bursary, Projects
- [SUCCESS] **100% FREE:** No hosting costs (GitHub Pages/Vercel)

## Quick Start

### Option 1: Open Directly (Fastest)

```bash
# Just open in browser
start index.html
```

### Option 2: Serve via HTTP (Better)

```bash
# Using Python
python -m http.server 8080

# Using Node
npx http-server -p 8080

# Using PHP
php -S localhost:8080
```

Then open: http://localhost:8080

## Usage

1. Enter phone number: `254712345678`
2. Click **START**
3. Use keypad to enter choices (1, 2, 3...)
4. Click **SEND** after each choice
5. Follow menu prompts
6. Click **END** to exit

## Features

### Realistic USSD Screen
- 280px height display
- Monospace font (Courier New)
- Scrollable content
- Session status indicator

### Virtual Keypad
- 12 buttons (0-9, *, #)
- Click or type to input
- Enter key sends response

### Backend Integration
- Auto-connects to http://localhost:4000
- Real-time health check (green/red indicator)
- Same PostgreSQL database
- Ticket generation works

## File Structure

```
web-simulator/
├── index.html       # Main UI
├── simulator.js     # Logic
├── styles.css       # Styling
└── README.md        # This file
```

## Architecture

```
Browser
    ↓ (JavaScript Fetch API)
Backend /ussd endpoint (Port 4000)
    ↓ (PostgreSQL)
Database (voo_db)
```

## Deployment Options

### GitHub Pages (FREE)

```bash
# Create repo
git init
git add .
git commit -m "Add web simulator"
git remote add origin https://github.com/yourusername/kyamatu-ussd.git
git push -u origin main

# Enable GitHub Pages in repo settings
# URL: https://yourusername.github.io/kyamatu-ussd/
```

### Vercel (FREE)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Production
vercel --prod
```

### Netlify (FREE)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy

# Production
netlify deploy --prod
```

### Railway (FREE $5 credit)

1. Create account at railway.app
2. New Project > Deploy from GitHub
3. Select repo
4. Auto-deploy on push

## Configuration

### Change Backend URL

Edit `simulator.js`:
```javascript
const BACKEND_URL = 'https://your-backend.com';
```

### Custom Styling

Edit `styles.css` to change:
- Colors
- Phone dimensions
- Fonts
- Animations

## Troubleshooting

**Backend Status Shows Red?**

- Check backend is running: `curl http://localhost:4000/health`
- Verify BACKEND_URL in simulator.js
- Check browser console (F12) for errors

**CORS Errors?**

Backend needs CORS headers. Add to backend:
```javascript
fastify.register(require('@fastify/cors'), {
  origin: '*'
});
```

**Session Timeout?**

Default 5 minutes. Extend in backend if needed.

## Browser Compatibility

| Browser | Supported | Notes |
|---------|-----------|-------|
| Chrome | [SUCCESS] | Full support |
| Firefox | [SUCCESS] | Full support |
| Safari | [SUCCESS] | Full support |
| Edge | [SUCCESS] | Full support |
| Mobile | [SUCCESS] | Responsive design |

## Mobile Responsive

Works on all screen sizes:
- Desktop: Side-by-side layout
- Tablet: Stacked layout
- Mobile: Phone-only view

## Features Demo

### Language Selection
```
KYAMATU WARD - FREE SERVICE
Select Language:
1. English
2. Swahili
3. Kamba
```

### Main Menu
```
KYAMATU WARD - FREE USSD

1. News & Announcements
2. Report Issue
3. Bursary Application
4. Ward Projects
5. Exit
```

### Issue Categories
```
Select Issue Category:

1. 💧 Water Problem
2. 🛣️ Road/Pothole
3. 🏥 Health Center
4. 🚨 Security Issue
5. ⚡ Electricity
6. [CLEANUP] Waste Management
```

## Cost

- Development: **FREE**
- Hosting: **FREE** (GitHub/Vercel/Netlify)
- Maintenance: **FREE**
- Total: **$0 forever** ✅

## Advantages

vs **Telegram:**
- ✅ No app installation
- ✅ Works on any device
- ❌ No offline support

vs **WhatsApp:**
- ✅ No external service
- ✅ No user limits
- ❌ Less familiar interface

vs **Africa's Talking:**
- ✅ FREE ($0 vs $290/year)
- ✅ Visual interface
- ❌ Requires internet

## Use Cases

**Perfect for:**
- 📊 Demos and presentations
- 🎓 Training sessions
- 🧪 Testing without real phone
- 💻 Desktop access

**Not ideal for:**
- Citizens without smartphones
- Areas with no internet
- Users preferring SMS/USSD

## Security

- ✅ Input sanitization via backend
- ✅ Session management (5 min timeout)
- ✅ HTTPS recommended for production
- ✅ No sensitive data stored locally

## Customization

### Change Phone Colors

```css
.phone-frame {
  background: #your-color;
  border: 8px solid #your-border;
}
```

### Change Button Style

```css
.action-btn {
  background: linear-gradient(145deg, #color1, #color2);
}
```

### Add Logo

```html
<div class="phone-header">
  <img src="logo.png" alt="Kyamatu Ward" />
</div>
```

## Analytics (Optional)

Track usage with Google Analytics:

```html
<!-- Add to index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

## Support

For issues:
1. Check backend connection (green/red light)
2. Open browser console (F12)
3. Verify phone number format (254...)
4. Check session status

## Future Enhancements

- [ ] PWA (Progressive Web App) support
- [ ] Offline mode with service workers
- [ ] Push notifications
- [ ] Multiple sessions (tabs)
- [ ] Session history
- [ ] Export conversation

## License

Made for Kyamatu Ward, Kitui County, Kenya 🇰🇪
