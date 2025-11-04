const BACKEND_URL = 'http://localhost:4000';
let sessionActive = false;
let currentText = '';
let phoneNumber = '';

// Update time
function updateTime() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
    document.getElementById('time').textContent = time;
}
setInterval(updateTime, 1000);
updateTime();

// Check backend health
async function checkBackend() {
    try {
        const response = await fetch(`${BACKEND_URL}/health`);
        const data = await response.json();
        
        if (data.ok) {
            document.getElementById('backend-light').textContent = '🟢';
            document.getElementById('backend-text').textContent = 'Connected';
        }
    } catch (error) {
        document.getElementById('backend-light').textContent = '🔴';
        document.getElementById('backend-text').textContent = 'Disconnected';
    }
}
checkBackend();
setInterval(checkBackend, 10000);

// Press keypad key
function pressKey(key) {
    const input = document.getElementById('response-input');
    if (!input.disabled) {
        input.value += key;
    } else if (!sessionActive) {
        const phoneInput = document.getElementById('phone-input');
        if (phoneInput === document.activeElement) {
            phoneInput.value += key;
        }
    }
}

// Start USSD session
async function startSession() {
    phoneNumber = document.getElementById('phone-input').value.trim();
    
    if (!phoneNumber) {
        alert('[WARNING] Please enter your phone number first!');
        return;
    }
    
    if (!phoneNumber.startsWith('254') || phoneNumber.length < 12) {
        alert('[WARNING] Phone number must start with 254 and be 12 digits (e.g., 254712345678)');
        return;
    }
    
    sessionActive = true;
    currentText = '';
    
    // Update UI
    document.getElementById('phone-input').disabled = true;
    document.getElementById('response-input').disabled = false;
    document.querySelector('.start-btn').disabled = true;
    document.querySelector('.send-btn').disabled = false;
    document.getElementById('session-status').textContent = '🟢 Session Active';
    
    // Call backend
    await sendUSSD('');
}

// Send USSD request
async function sendUSSD(text) {
    try {
        const response = await fetch(`${BACKEND_URL}/ussd`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phoneNumber: phoneNumber,
                text: text,
                sessionId: `web_${phoneNumber}`
            })
        });
        
        const data = await response.json();
        displayResponse(data);
        
    } catch (error) {
        console.error('USSD Error:', error);
        displayError('[ERROR] Connection error. Check if backend is running.');
    }
}

// Display USSD response
function displayResponse(response) {
    const content = document.getElementById('ussd-content');
    const lines = response.split('\n');
    
    let html = '';
    lines.forEach(line => {
        if (line.trim()) {
            html += `<p>${escapeHtml(line)}</p>`;
        }
    });
    
    content.innerHTML = html;
    
    // Check if session ended
    if (response.startsWith('END')) {
        endSession();
    }
    
    // Clear input
    document.getElementById('response-input').value = '';
}

// Display error
function displayError(message) {
    const content = document.getElementById('ussd-content');
    content.innerHTML = `<p style="color: #ff4444;">${escapeHtml(message)}</p>`;
}

// Send user response
async function sendResponse() {
    const input = document.getElementById('response-input');
    const userInput = input.value.trim();
    
    if (!userInput) {
        alert('[WARNING] Please enter your response first!');
        return;
    }
    
    // Build USSD path
    if (currentText === '') {
        currentText = userInput;
    } else {
        currentText += '*' + userInput;
    }
    
    // Send to backend
    await sendUSSD(currentText);
}

// End session
function endSession() {
    sessionActive = false;
    currentText = '';
    
    // Reset UI
    document.getElementById('phone-input').disabled = false;
    document.getElementById('response-input').disabled = true;
    document.getElementById('response-input').value = '';
    document.querySelector('.start-btn').disabled = false;
    document.querySelector('.send-btn').disabled = true;
    document.getElementById('session-status').textContent = '⚪ Not Connected';
    
    // Show restart message
    const content = document.getElementById('ussd-content');
    content.innerHTML = '<p>[SUCCESS] Session ended</p><p>Click START to begin new session</p>';
}

// Escape HTML for security
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Enter key handler
document.getElementById('response-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendResponse();
    }
});

document.getElementById('phone-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        startSession();
    }
});

console.log('📱 USSD Simulator loaded');
console.log('[GLOBAL] Backend:', BACKEND_URL);
