# Starts Expo for a real phone on the same Wi-Fi, with the right LAN IP for BOTH Expo and the API.
# Run from the front folder:  powershell -ExecutionPolicy Bypass -File scripts\start-phone.ps1
param([switch]$DryRun)

Set-Location (Split-Path $PSScriptRoot -Parent)

# The real network adapter is the one that has a default gateway. Virtual adapters
# (VirtualBox, WSL, Hyper-V, VMware) have none, which is why Expo can show a wrong IP.
$cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
if (-not $cfg) { Write-Host "No active network with a gateway found. Connect to Wi-Fi first." -ForegroundColor Red; exit 1 }
$ip = $cfg.IPv4Address.IPAddress
Write-Host "Using $($cfg.InterfaceAlias): $ip" -ForegroundColor Green

Set-Content -Path ".env" -Value "EXPO_PUBLIC_BASE_URL=http://${ip}:8000" -Encoding ascii
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip   # makes the Expo QR code point at the real IP

try {
    Invoke-RestMethod "http://${ip}:8000/health" -TimeoutSec 4 | Out-Null
    Write-Host "Backend reachable at http://${ip}:8000" -ForegroundColor Green
} catch {
    Write-Host "WARNING: backend NOT reachable at http://${ip}:8000. Start it first (back\run-lan.cmd)." -ForegroundColor Yellow
}

if ($DryRun) { Write-Host "Dry run: not starting Expo."; exit 0 }
npx expo start --lan --clear
