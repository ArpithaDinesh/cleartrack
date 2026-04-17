# CLEARTRACK - One-Click Deploy Script
# Run this script after making any changes to push to GitHub and redeploy Vercel

$GIT = ".\mingit\cmd\git.exe"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CLEARTRACK - Deploying Changes..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Push to GitHub ---
Write-Host "[1/2] Pushing to GitHub..." -ForegroundColor Yellow

Set-Location $ROOT

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
& $GIT add .
& $GIT commit -m "Update: $timestamp"
& $GIT push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: GitHub push failed!" -ForegroundColor Red
    exit 1
}

Write-Host "GitHub push successful!" -ForegroundColor Green
Write-Host ""

# --- Step 2: Deploy Backend to Vercel ---
Write-Host "[2/3] Deploying backend to Vercel..." -ForegroundColor Yellow

Set-Location "$ROOT\cleartrack-backend"
npx vercel --prod --yes

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backend Vercel deploy failed!" -ForegroundColor Red
    exit 1
}

# --- Step 3: Deploy Frontend to Vercel ---
Write-Host "[3/3] Deploying frontend to Vercel..." -ForegroundColor Yellow

Set-Location "$ROOT\cleartrack-react"
npx vercel --prod --yes

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Frontend Vercel deploy failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All Done! Changes are now LIVE." -ForegroundColor Green
Write-Host "  Backend:  (Check Vercel Dashboard for URL)" -ForegroundColor Green
Write-Host "  Frontend: https://cleartrack-react.vercel.app" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Set-Location $ROOT
