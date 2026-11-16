"""A small, honest load test with the standard library only. Run from back/:

    py scripts/load_test.py http://127.0.0.1:8000 --users 20 --seconds 20
    py scripts/load_test.py https://your-service.onrender.com --users 5 --seconds 10     (go gently on a free tier)

Each virtual user signs in as a demo patient once, then repeatedly calls a few read endpoints. Reports requests per second and the 50th,
95th and 99th percentile response times per endpoint, and any errors. It writes nothing to health data (guest sign-in only).
"""
import argparse
import json
import statistics
import threading
import time
import urllib.request

ENDPOINTS = ["/ping", "/behavior/context", "/behavior/plans", "/health/dashboard"]


def req(base, path, token=None, data=None, timeout=30):
    r = urllib.request.Request(base + path, data=json.dumps(data).encode() if data is not None else None,
                               headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    t = time.perf_counter()
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            body = resp.read()
            return resp.status, time.perf_counter() - t, body
    except urllib.error.HTTPError as e:
        return e.code, time.perf_counter() - t, b""
    except Exception:
        return 0, time.perf_counter() - t, b""


def user(base, stop_at, results, lock):
    st, _, body = req(base, "/auth/guest", data={"role": "patient"})
    token = json.loads(body)["access_token"] if st == 200 else None
    i = 0
    while time.time() < stop_at:
        path = ENDPOINTS[i % len(ENDPOINTS)]
        i += 1
        st, dt, _ = req(base, path, None if path == "/ping" else token)
        with lock:
            results.setdefault(path, []).append((st, dt))


def pctl(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(len(xs) * p))] if xs else float("nan")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("--users", type=int, default=10)
    ap.add_argument("--seconds", type=int, default=15)
    a = ap.parse_args()
    results, lock = {}, threading.Lock()
    stop = time.time() + a.seconds
    threads = [threading.Thread(target=user, args=(a.base.rstrip("/"), stop, results, lock)) for _ in range(a.users)]
    t0 = time.time()
    [t.start() for t in threads]
    [t.join() for t in threads]
    el = time.time() - t0
    total = sum(len(v) for v in results.values())
    errs = sum(1 for v in results.values() for s, _ in v if s != 200)
    print(f"{a.users} users, {el:.0f} s: {total} requests, {total / el:.1f} req/s, errors {errs} ({100 * errs / max(1, total):.1f}%)")
    print("| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Errors |\n|---|---|---|---|---|---|")
    for path, v in results.items():
        ok = [dt * 1000 for s, dt in v if s == 200]
        print(f"| {path} | {len(v)} | {pctl(ok, .5):.0f} | {pctl(ok, .95):.0f} | {pctl(ok, .99):.0f} | {sum(1 for s, _ in v if s != 200)} |")


if __name__ == "__main__":
    main()
