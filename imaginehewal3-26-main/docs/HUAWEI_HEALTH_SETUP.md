# Connect HUAWEI Health directly (Health Kit cloud API)

HEWAL3 already contains the whole integration: the sign-in, token storage, data pull, the Connect button and the status screen.
It stays switched off until HUAWEI gives you credentials, which only you can get. This is the checklist.

## Why the cloud (REST) API, not the Android SDK
Huawei's Health Kit has an on-device SDK (Android and HarmonyOS only) and a cloud REST API that works from any server. HEWAL3 is an
iPhone app, so the cloud API is the only direct route. The person signs in with their HUAWEI ID, HEWAL3's server receives a token,
and the server reads their Huawei Health data.

## What you do (one time)
1. **Register** at https://developer.huawei.com and complete identity verification.
2. In **AppGallery Connect**, create a project and an app. Choose the **Server app** type (this gives a Client ID and Client Secret).
3. Turn on the **HUAWEI ID** service, then apply for **Health Kit**. Huawei's published timings: the HUAWEI ID service about 3 working days,
   Health Kit review up to 15 working days. Until approved you get **test scopes, limited to 100 users**, which is enough to try it
   with your own account. Request only the scopes HEWAL3 uses (below), because unused ones appear on the consent screen.
4. In the HUAWEI ID settings, register this **redirect URL** exactly (HTTPS, no trailing slash difference):
   `https://extraprofessional-brendan-palest.ngrok-free.dev/huawei/callback`
5. Copy the **Client ID** and **Client Secret** into `back/.env`:
   ```
   HUAWEI_CLIENT_ID=your_client_id
   HUAWEI_CLIENT_SECRET=your_client_secret
   HUAWEI_REDIRECT_URI=https://extraprofessional-brendan-palest.ngrok-free.dev/huawei/callback
   ```
6. Restart the backend. In the app, **Devices > HUAWEI Health (direct connection) > Connect**.

## Scopes HEWAL3 asks for
`step.read`, `distance.read`, `calories.read`, `heartrate.read`, `bloodpressure.read`, `oxygensaturation.read`, each under
`https://www.huawei.com/healthkit/`. To change the list, set `HUAWEI_SCOPES` (space separated full URLs).

## Things that can still need adjusting (not verifiable without your credentials)
Huawei's reference pages were not reachable from the build environment, so the scope names, data type names and response field names
follow Huawei's documentation as far as it could be confirmed, and the reading code accepts the different time units and field names
Huawei uses. Every refusal from Huawei is stored and shown on the Devices screen with Huawei's own wording, so a wrong name is found
on the first attempt. Names live in `back/app/services/huawei_health.py` and can be overridden by environment variables
(`HUAWEI_TYPE_STEPS`, `HUAWEI_TYPE_HR`, `HUAWEI_TYPE_BP`, `HUAWEI_TYPE_SPO2`, `HUAWEI_TYPE_DISTANCE`, `HUAWEI_TYPE_CALORIES`).

| What you see | Meaning |
|---|---|
| "This server does not have its HUAWEI Health Kit credentials" | `HUAWEI_CLIENT_ID` / `HUAWEI_CLIENT_SECRET` are not set, or the backend was not restarted |
| Huawei error 20022 on the sign-in page | the redirect URL in `.env` differs from the one registered in AppGallery Connect |
| `missing_scopes` or "insufficient authentication scopes" | the scope is not granted to the app in the Huawei console (not the same as the person's consent) |
| Connected, but no numbers | HUAWEI Health has not uploaded data to Huawei's cloud, or the person did not allow that data type; open the HUAWEI Health app and let it sync |
| A page from ngrok asking you to "Visit Site" after signing in | normal on ngrok's free plan; tap Visit Site |

## What is stored and shared
Tokens are encrypted before they are stored (key derived from `SECRET_KEY`), only ever used for that one person, and deleted when they
tap Disconnect (HEWAL3 also asks Huawei to drop the consent; the person can remove it in the HUAWEI Health app too). Huawei data goes
through the same path as Apple Health data, so caregivers and doctors see it only for people who linked them.
