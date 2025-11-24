#!/usr/bin/env python3
# Fix HTML issues in admin-dashboard.html

with open('public/admin-dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Already done - removed extra closing brace at line 370

# Fix 2: Rename duplicate ID from issueTitle to updateIssueTitle (in the update modal)
# Find the readonly input and change its ID
content = content.replace(
    '<input type="text" id="issueTitle" readonly style="background: rgba(255,255,255,0.05);">',
    '<input type="text" id="updateIssueTitle" readonly style="background: rgba(255,255,255,0.05);">'
)

# Fix 3: Update avatar path references (if any exist)
content = content.replace('/api/admin/default-avatar.png', '/uploads/avatars/default-avatar.png')

with open('public/admin-dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed duplicate ID and avatar paths in admin-dashboard.html")
