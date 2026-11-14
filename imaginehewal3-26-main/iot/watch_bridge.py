"""
Bluetooth bridge: reads live heart rate from a BLE watch and pushes it to the HEWAL3 backend.

Install:   pip install bleak requests
Step 1:    python watch_bridge.py scan                      # is the watch visible?
Step 2:    python watch_bridge.py probe 78:02:B7:16:91:F5    # which services does it expose?
Step 3:    python watch_bridge.py run 78:02:B7:16:91:F5 --email you@x.com --password '...'

IMPORTANT: most watches allow ONE Bluetooth connection. Close the oraimo Health app (or turn the
phone's Bluetooth off / unpair) before step 2 or 3, otherwise the laptop cannot connect.
This only works if the watch exposes the standard Heart Rate service (0x180D). `probe` tells you.
"""
import argparse
import asyncio
import time

import requests
from bleak import BleakClient, BleakScanner

HR_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb"
HR_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb"


def parse_hr(data: bytearray) -> int:
    """Bluetooth Heart Rate Measurement: bit0 of flags = 16-bit value."""
    return int.from_bytes(data[1:3], "little") if data[0] & 0x01 else data[1]


async def scan():
    print("Scanning 10s... (watch screen on, not connected to the phone app)")
    found = await BleakScanner.discover(timeout=10, return_adv=True)
    for addr, (dev, adv) in sorted(found.items(), key=lambda kv: -kv[1][1].rssi):
        mark = "  <-- LIKELY" if "nova" in (dev.name or "").lower() or "oraimo" in (dev.name or "").lower() else ""
        print(f"{addr}  rssi={adv.rssi:4}  {dev.name!r}{mark}")


async def probe(addr: str):
    async with BleakClient(addr, timeout=20) as c:
        print("Connected. Services:")
        for s in c.services:
            tag = "  <-- STANDARD HEART RATE" if s.uuid == HR_SERVICE else ""
            print(f"- {s.uuid}{tag}")
            for ch in s.characteristics:
                print(f"    {ch.uuid}  {','.join(ch.properties)}")
        print("\nHeart Rate service present:", any(s.uuid == HR_SERVICE for s in c.services))


def login(base: str, email: str, password: str) -> str:
    r = requests.post(f"{base}/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


async def run(addr: str, base: str, token: str):
    headers = {"Authorization": f"Bearer {token}"}
    last_sent = 0.0

    def on_hr(_, data: bytearray):
        nonlocal last_sent
        hr = parse_hr(data)
        print(f"HR {hr} bpm")
        if hr and time.time() - last_sent >= 2:  # at most one POST per 2 seconds
            last_sent = time.time()
            try:
                requests.post(f"{base}/vitals/ingest", headers=headers, timeout=5, json={
                    "device_id": addr, "device_name": "oraimo Watch Nova AM", "heart_rate": hr})
            except requests.RequestException as e:
                print("POST failed:", e)

    while True:  # reconnect forever
        try:
            async with BleakClient(addr, timeout=20) as c:
                await c.start_notify(HR_MEASUREMENT, on_hr)
                print("Streaming. Ctrl+C to stop.")
                while c.is_connected:
                    await asyncio.sleep(1)
        except Exception as e:
            print("Connection lost:", e, "- retrying in 5s")
            await asyncio.sleep(5)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["scan", "probe", "run"])
    ap.add_argument("address", nargs="?")
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--email")
    ap.add_argument("--password")
    a = ap.parse_args()
    if a.mode == "scan":
        asyncio.run(scan())
    elif not a.address:
        ap.error("address required")
    elif a.mode == "probe":
        asyncio.run(probe(a.address))
    else:
        asyncio.run(run(a.address, a.base, login(a.base, a.email, a.password)))
