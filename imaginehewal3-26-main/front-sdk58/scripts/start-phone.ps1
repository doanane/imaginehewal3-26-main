# Starts Expo for a real phone on the same network (home Wi-Fi OR your phone's hotspot).
# Run from the front-sdk58 folder:  powershell -ExecutionPolicy Bypass -File scripts\start-phone.ps1
# Nothing is hard-coded: the app finds the laptop's current address from Expo itself, so changing network needs no edits.
param([switch]$DryRun)

Set-Location (Split-Path $PSScriptRoot -Parent)

# The real adapter is the one with a default gateway (virtual adapters from VirtualBox, WSL, Hyper-V have none).
$cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
if (-not $cfg) { Write-Host "No active network with a gateway found. Connect to Wi-Fi or the hotspot first." -ForegroundColor Red; exit 1 }
$ip = $cfg.IPv4Address.IPAddress
Write-Host "Network: $($cfg.InterfaceAlias)  Laptop address: $ip" -ForegroundColor Green

# A stale fixed address in .env was the cause of 'Network request was canceled'. Make sure none is set for local development.
if (Test-Path ".env") {
    $lines = Get-Content ".env" | Where-Object { $_ -notmatch '^\s*EXPO_PUBLIC_BASE_URL=http://' }
    Set-Content -Path ".env" -Value $lines -Encoding ascii
}
Remove-Item Env:EXPO_PUBLIC_BASE_URL -ErrorAction SilentlyContinue
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip   # the Expo QR code points at this address, and so does the app's API address

# Windows blocks incoming connections from the phone unless these ports are open (needs Administrator, done once).
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not (Get-NetFirewallRule -DisplayName "HEWAL3 dev" -ErrorAction SilentlyContinue)) {
    if ($isAdmin) {
        New-NetFirewallRule -DisplayName "HEWAL3 dev" -Direction Inbound -Protocol TCP -LocalPort 8000,8081 -Action Allow -Profile Any | Out-Null
        Write-Host "Opened ports 8000 and 8081 in Windows Firewall." -ForegroundColor Green
    } else {
        Write-Host "TIP: run this script once as Administrator so Windows lets your phone reach ports 8000 and 8081." -ForegroundColor Yellow
    }
}

try {
    Invoke-RestMethod "http://${ip}:8000/health" -TimeoutSec 4 | Out-Null
    Write-Host "Backend reachable at http://${ip}:8000" -ForegroundColor Green
} catch {
    Write-Host "WARNING: backend NOT reachable at http://${ip}:8000. Start it first (back\run-lan.cmd)." -ForegroundColor Yellow
}
Write-Host "Check from the phone: open Safari and go to http://${ip}:8000/health  (it should show a status message)." -ForegroundColor Cyan

if ($DryRun) { Write-Host "Dry run: not starting Expo."; exit 0 }
npx expo start --lan --clear
