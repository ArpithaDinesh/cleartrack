$body = @{
    email = "test@test.com"
    password = "test123"
    role = "student"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Method POST -Uri "https://cleartrack-backend.vercel.app/api/auth/login" -ContentType "application/json" -Body $body
    Write-Host "SUCCESS: $($response | ConvertTo-Json)"
} catch {
    Write-Host "ERROR: $($_.ErrorDetails.Message)"
}
