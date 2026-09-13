# Render login / OTP fix

## What was wrong

1. The browser API timeout was 20 seconds. A Render Free backend can take about a minute to wake after 15 minutes of inactivity.
2. Gmail/Nodemailer uses SMTP. Render Free blocks outbound SMTP ports 25, 465, and 587, so email OTP can hang/fail even though it works locally.
3. `/api/auth/check-auth` returned HTTP 401 for a logged-out visitor. That 401 is normal, but it looked like an app error in Chrome DevTools.

## Code changes in this ZIP

- Frontend API timeout changed from 20 seconds to 75 seconds.
- Email OTP now supports Resend over HTTPS (`EMAIL_PROVIDER=resend`).
- Gmail SMTP is retained for local development or a paid host, with short connection timeouts and a useful error message.
- Logged-out `/api/auth/check-auth` now returns HTTP 200 with `authenticated: false`, so the console is not filled with a harmless 401.

## Render backend environment variables

Keep your existing MongoDB/JWT/Twilio variables and set these:

```env
NODE_ENV=production
FRONTEND_URL=https://whatsapps-webside.onrender.com
BACKEND_URL=https://YOUR-BACKEND-SERVICE.onrender.com
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=WhatsApp Clone <onboarding@resend.dev>
```

`onboarding@resend.dev` is intended for Resend testing. To send to arbitrary users, configure a verified sender/domain in Resend and put that sender in `EMAIL_FROM`.

## Render frontend environment variable

```env
REACT_APP_API_URL=https://YOUR-BACKEND-SERVICE.onrender.com
```

After changing a `REACT_APP_*` value, rebuild/redeploy the frontend because Create React App embeds it at build time.

## Render commands

Backend Web Service (root directory `backend`):

```text
Build Command: npm install
Start Command: npm start
```

Frontend Static Site (root directory `frontend`):

```text
Build Command: npm install && npm run build
Publish Directory: build
```
