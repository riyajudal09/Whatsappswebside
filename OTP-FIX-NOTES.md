# OTP Fix Notes

This build fixes the local-login problem shown by a Twilio Trial `403 Forbidden` response.

## What changed

- Added `PHONE_OTP_PROVIDER=auto` mode.
- The app still tries **real Twilio Verify SMS first**.
- If Twilio Trial refuses an unverified destination number, the backend automatically switches to a **development OTP** while `NODE_ENV` is not `production`.
- The development OTP is stored as a SHA-256 hash with a short expiry, not as plain text in MongoDB.
- The OTP is shown on the login page only in local development, so any new phone number can be used to test the full login/profile/chat flow.
- Production mode never exposes the development OTP.

## Important limitation

No code can bypass Twilio Trial's destination-number restriction. To send a real SMS OTP to arbitrary phone numbers, upgrade/configure Twilio (or plug in another production SMS provider). The development fallback is for local project testing only.

## Modes

In `backend/.env`:

```env
PHONE_OTP_PROVIDER=auto
ALLOW_DEV_OTP_FALLBACK=true
DEV_OTP_TTL_MINUTES=5
```

- `auto`: Twilio SMS first, development fallback locally if Trial blocks the number.
- `twilio`: real SMS only. A Trial account still requires verified destination numbers.
- `development`: always generate a local development OTP. Never use this in production.

## Production

Use:

```env
NODE_ENV=production
PHONE_OTP_PROVIDER=twilio
ALLOW_DEV_OTP_FALLBACK=false
```

and use a production-ready Twilio account/Verify Service with the required destination countries enabled.
