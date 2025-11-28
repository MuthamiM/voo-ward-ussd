import re

# Read the file
with open('public/admin-dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the broken login form section
# The broken section starts at line ~1089 and ends at ~1102
broken_pattern = r'(<form id="loginForm">.*?<div class="form-group">.*?<label class="form-label" for="username">Username</label>.*?<input type="text" id="username"[^>]*>.*?</div>)\s*Create New Account\s*</a>\s*</div>\s*</form>\s*</div>\s*</div>'

fixed_form = r'''\1

                <div class="form-group">
                    <label class="form-label" for="password">Password</label>
                    <input type="password" id="password" class="form-input" placeholder="Enter your password" required>
                </div>

                <button type="submit" class="btn btn-primary" id="loginBtn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);" onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.boxShadow='0 8px 25px rgba(99, 102, 241, 0.6)'; this.style.background='linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 15px rgba(99, 102, 241, 0.4)'; this.style.background='linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'">
                    <span>Sign In</span>
                </button>

                <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);">
                    <p style="color: var(--text-secondary); margin-bottom: 10px;">Don't have an account?</p>
                    <a href="signup.html" style="color: var(--primary); text-decoration: none; font-weight: 500; padding: 10px 20px; border: 2px solid var(--primary); border-radius: 10px; display: inline-block; transition: all 0.3s ease; background: rgba(99, 102, 241, 0.1);" onmouseover="this.style.transform='translateY(-2px) scale(1.05)'; this.style.background='var(--primary)'; this.style.color='white'; this.style.boxShadow='0 6px 20px rgba(99, 102, 241, 0.5)'" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.background='rgba(99, 102, 241, 0.1)'; this.style.color='var(--primary)'; this.style.boxShadow='none'">
                        Create New Account
                    </a>
                </div>
            </form>
        </div>
    </div>'''

# Replace
content_fixed = re.sub(broken_pattern, fixed_form, content, flags=re.DOTALL)

# Write back
with open('public/admin-dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content_fixed)

print("✅ Login form fixed successfully!")
