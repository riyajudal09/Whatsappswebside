# WhatsApp Clone — Full MERN Project

A complete learning project built from the uploaded project structure and the referenced tutorial functionality.

## Included features

- Mobile-number login with **real SMS OTP using Twilio Verify** plus a safe local-development fallback for Twilio Trial restrictions
- Optional email OTP login
- 6-digit OTP verification
- First-login profile setup (name, about, avatar/photo)
- User/contact list and search
- One-to-one text chat
- Image and video messages
- Conversation history in MongoDB
- Realtime messages using Socket.IO
- Online/offline presence and last seen
- Typing indicator
- Sent / delivered / read ticks
- Emoji message reactions
- Delete message for everyone
- Unread-message counts
- 24-hour status/story feature (text, image, video)
- Status views and deletion
- Profile editing
- Light / dark theme
- Responsive desktop/mobile layout
- Local upload fallback when Cloudinary is not configured
- Cloudinary support when credentials are provided

## Important: mobile OTP

The default `PHONE_OTP_PROVIDER=auto` flow is:

1. User enters country code + mobile number.
2. Backend tries Twilio Verify first.
3. If Twilio sends successfully, the user receives a real SMS OTP and verification stays fully provider-backed.
4. If a **Twilio Trial** account blocks an unverified destination while running locally, the app generates a short-lived development OTP and shows it only on the local login page.
5. The development OTP is stored as a hash with an expiry and is never enabled in production.
6. A login cookie is created only after successful OTP verification.

### Twilio Trial restriction

Twilio Trial accounts normally send SMS only to destination numbers that have been verified in the Twilio console. That restriction cannot be removed with JavaScript/Node logic. This build therefore lets you test **any new mobile number locally** without getting stuck on a 403. To let arbitrary users receive **real SMS OTPs**, use an upgraded/configured Twilio account (or another production SMS provider) and enable the destination countries you need.

See `OTP-FIX-NOTES.md` for the available OTP modes.

## Project structure

```
whatsapp-full-project/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── uploads/
│   ├── .env.example
│   ├── index.js
│   └── package.json
└── frontend/
    ├── public/
    ├── src/
    │   ├── api/
    │   ├── pages/
    │   ├── services/
    │   ├── store/
    │   └── utils/
    ├── .env.example
    └── package.json
```

## Requirements

- Node.js 18+ (Node 20/22 recommended)
- MongoDB local installation or MongoDB Atlas
- Twilio account + Verify Service for real mobile OTP
- Optional: Gmail App Password for email OTP
- Optional: Cloudinary account for cloud media storage

## 1. Backend setup

Open a terminal:

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` if you do not already have a configured `.env`, then enter your credentials.

Minimum configuration:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/whatsapp_clone
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_SERVICE_SID=...
```

Start backend:

```bash
npm run dev
```

Expected messages:

```text
MongoDB connected
WhatsApp Clone API running on http://localhost:5000
```

## 2. Frontend setup

Open a second terminal:

```bash
cd frontend
npm install
npm start
```

Frontend `.env`:

```env
REACT_APP_API_URL=http://localhost:5000
```

Then open `http://localhost:3000`.

## 3. Test with two users

For a true two-phone test:

1. Open the app in normal Chrome and log in with phone A.
2. Open an Incognito window or another browser and log in with phone B.
3. Both numbers must be allowed by your Twilio account.
4. Finish profile setup on both accounts.
5. Each account should appear in the other's contact list.
6. Send messages between the two windows.

If phone B produces a Twilio Trial/unverified-number error, the application code is working but Twilio is refusing that destination. Verify phone B in Twilio Trial or upgrade the account.

## Media uploads

If Cloudinary credentials are supplied, media is uploaded to Cloudinary. If they are blank, the backend keeps files in `backend/uploads/` and serves them from `/uploads/...`, which is convenient for local development.

## Existing database compatibility

At startup the backend performs a small migration for older versions of this project that used `Conversation` instead of `conversation`, `imageOrVideoUrl` instead of `mediaUrl`, and `send` instead of `sent` in message documents.

## Tutorial reference

Reference supplied by the project owner:
`https://www.youtube.com/watch?v=fgaGVHLH2kY&t=27434s`

This ZIP is a cleaned, original implementation of the same kind of application and feature set, rather than a verbatim copy of tutorial source code.

## MongoDB Atlas `querySrv ECONNREFUSED` fix

This build automatically handles the common Windows/network error:

`querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net`

The backend now tries, in order:

1. the normal `mongodb+srv://` Atlas connection;
2. a retry using public DNS (`8.8.8.8` and `1.1.1.1` by default);
3. a DNS-over-HTTPS lookup and a direct Atlas host connection.

If all three fail, the remaining problem is outside the application code. Check that the PC has internet access, a VPN/firewall is not blocking MongoDB, and your MongoDB Atlas project allows your current public IP under **Network Access**. For temporary development testing, Atlas can be configured to allow access from anywhere (`0.0.0.0/0`), but a restricted IP allow-list is safer.

You can change the fallback behavior in `backend/.env`:

```env
MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1
MONGO_DOH_FALLBACK=true
MONGO_SERVER_SELECTION_TIMEOUT_MS=12000
```

## Render Free email OTP note

Render Free blocks outbound SMTP ports 25, 465 and 587. Therefore Gmail/Nodemailer email OTP should not be used from a Free Render backend. This project now supports Resend's HTTPS API. See `RENDER-LOGIN-FIX.md` for the exact Render environment variables and deployment settings.
