// Optional: a Cloudflare Worker that wakes the Render free server every 5 minutes (free plan, no card).
// Cloudflare dashboard > Workers & Pages > Create > Worker > paste this > Deploy.
// Then Settings > Triggers > Cron Triggers > add:  */5 * * * *
// Change URL to your Render address.
const URL = "https://YOUR-SERVICE.onrender.com/ping";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch(URL, { headers: { "User-Agent": "keepalive" } }).catch(() => {}));
  },
  async fetch() {
    return new Response("keepalive worker: runs on a schedule");
  },
};
