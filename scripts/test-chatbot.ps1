# PowerShell helper to test admin chatbot endpoint locally or against deployed app
# Usage:
# 1) Update $base to your app URL (e.g., https://localhost:3000 or https://myapp.example)
# 2) Run: .\scripts\test-chatbot.ps1

param()

$base = Read-Host "Enter app base URL (e.g. http://localhost:3000)"
if (-not $base) { Write-Host "No base provided, exiting"; exit 1 }

# Login (env-backed default admin)
$loginBody = @{ username = 'admin'; password = 'admin123' } | ConvertTo-Json
try {
    $login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -Body $loginBody -ContentType 'application/json'
} catch {
    Write-Host "Login failed: $_" -ForegroundColor Red
    exit 1
}
$token = $login.token
Write-Host "Got token: $token" -ForegroundColor Green

# Call chatbot without setting OPENAI_API_KEY on server (fallback)
$body = @{ message = 'Give a short system summary' } | ConvertTo-Json
try {
    $res = Invoke-RestMethod -Method Post -Uri "$base/api/admin/chatbot" -Body $body -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" }
    Write-Host "Chatbot response (fallback or OpenAI):" -ForegroundColor Cyan
    $res | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "Chatbot call failed: $_" -ForegroundColor Red
}

Write-Host "\nDone. If you want to test with OpenAI, set the env var OPENAI_API_KEY in your deployment and re-run this script against the deployed URL."