# Mobile Development Setup Guide

**Date:** December 31, 2025  
**Purpose:** Avoid common pitfalls when testing the mobile app with local backend

---

## TL;DR - Common Issues

When testing with **Expo Go on a physical device**, you **cannot** use `localhost` or `127.0.0.1` to connect to your local backend. You must use your computer's **actual IP address** on the local network.

---

## Correct Setup (Step-by-Step)

### 1. **Find Your Computer's IP Address**

#### Windows:

```powershell
ipconfig | Select-String -Pattern "IPv4"
```

#### macOS/Linux:

```bash
ifconfig | grep "inet "
```

Look for an IP like `10.x.x.x` or `192.168.x.x` (NOT `127.0.0.1`)

**Example output:** `IPv4 Address: 10.216.107.253`

---

### 2. **Update Frontend `.env` File**

Edit `front/.env`:

```bash
# WRONG - Won't work on mobile devices
EXPO_PUBLIC_BASE_URL=http://localhost:8000
EXPO_PUBLIC_BASE_URL=http://127.0.0.1:8000

# CORRECT - Use your computer's actual IP
EXPO_PUBLIC_BASE_URL=http://10.216.107.253:8000
```

> **Note:** Replace `10.216.107.253` with YOUR computer's IP address

---

### 3. **Start Backend with Correct Host Binding**

The backend must listen on **all network interfaces** (`0.0.0.0`), not just localhost:

```bash
cd back

# WRONG - Only accessible from localhost
uvicorn app.main:app --reload

# CORRECT - Accessible from network
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

### 4. **Verify Backend is Accessible**

#### Check backend is listening on all interfaces:

```powershell
netstat -an | Select-String "8000"
```

You should see:

```
TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING
```

#### Test from your phone's browser:

Open Safari/Chrome on your phone and visit:

```
http://YOUR_IP_HERE:8000/health
```

You should see JSON response like:

```json
{ "status": "healthy", "service": "HEWAL3 API", "database": "connected" }
```

If this **doesn't work**, check the firewall section below.

---

### 5. **Allow Firewall Access (Windows)**

If your phone can't reach the backend, Windows Firewall is likely blocking it.

#### Option A: PowerShell (Run as Administrator)

```powershell
New-NetFirewallRule -DisplayName "Python Dev Server" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private,Public
```

#### Option B: Windows Defender Firewall GUI

1. Press `Win + R`, type `wf.msc`, press Enter
2. Click **Inbound Rules** → **New Rule...**
3. Choose **Port** → Next
4. Choose **TCP**, type `8000` → Next
5. Choose **Allow the connection** → Next
6. Check all profiles → Next
7. Name: "Python Backend Dev" → Finish

---

### 6. **Restart Frontend Dev Server**

After updating `.env`, restart to load new environment variables:

```bash
cd front
npm run dev
```

---

### 7. **Restart Expo Go App**

- Completely close Expo Go (swipe up to kill)
- Reopen and scan QR code
- Check console output for: `Backend URL: http://10.216.107.253:8000`

---

## Troubleshooting

### Issue: "Network request failed" or "Network request timed out"

**Causes:**

1. Using `localhost` or `127.0.0.1` in `.env`
2. Backend not running with `--host 0.0.0.0`
3. Windows Firewall blocking port 8000
4. Phone and computer on different WiFi networks
5. IP address changed (disconnected/reconnected to WiFi)

**Solutions:**

1. Use computer's actual IP in `.env`
2. Start backend with `--host 0.0.0.0`
3. Add firewall rule (see above)
4. Ensure both devices on same WiFi
5. Re-check IP with `ipconfig` and update `.env`

---

### Issue: Console shows wrong URL

Add this to `front/services/api.ts` line 6:

```typescript
console.log("Backend URL:", BASE_URL);
```

This helps debug what URL the app is actually using.

---

### Issue: IP address keeps changing

Your IP can change when you:

- Disconnect/reconnect to WiFi
- Switch between WiFi networks
- Restart your computer

**Solution:** Check your IP before each dev session:

```powershell
ipconfig | Select-String -Pattern "IPv4"
```

---

## Environment Variable Naming

In Expo/React Native, environment variables **must** be prefixed with `EXPO_PUBLIC_` to be accessible in client-side code:

```bash
# Won't work
BASE_URL=http://10.216.107.253:8000

# Correct
EXPO_PUBLIC_BASE_URL=http://10.216.107.253:8000
```

In code:

```typescript
const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || "http://localhost:8000";
```

---

## Quick Setup Checklist

Before starting development:

- [ ] Find computer's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- [ ] Update `front/.env` with IP address
- [ ] Start backend with `--host 0.0.0.0 --port 8000`
- [ ] Verify backend responds at `http://YOUR_IP:8000/health` in phone browser
- [ ] Add firewall rule if needed
- [ ] Restart frontend: `npm run dev`
- [ ] Restart Expo Go app
- [ ] Check console for correct backend URL

---

## Network Requirements

**Both devices MUST be:**

- On the **same WiFi network**
- Have network discovery enabled
- Not blocked by router/firewall

---

## Additional Resources

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/manually/)
- [Windows Firewall Rules](https://learn.microsoft.com/en-us/windows/security/threat-protection/windows-firewall/)

---

## Production Deployment

For production, update `.env` to use the deployed backend:

```bash
# Production
EXPO_PUBLIC_BASE_URL=https://hewal3-backend-api-aya3dzgefte4b3c3.southafricanorth-01.azurewebsites.net

# Development (commented out)
# EXPO_PUBLIC_BASE_URL=http://10.216.107.253:8000
```

---

**Questions?** Ask in the team chat or check the troubleshooting section above.
