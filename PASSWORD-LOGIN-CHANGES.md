# Password Login Update

This version removes OTP authentication from the active application flow.

## New authentication
- Log in with **phone number + password** or **email + password**.
- New users can create an account from the **Sign up** tab.
- Passwords are stored only as salted `scrypt` hashes (`passwordHash`), never as plaintext.
- Phone/email registration and login use `/api/auth/register` and `/api/auth/login`.
- OTP routes and OTP services are removed.

## Existing OTP-created database users
Old accounts created before this update do not have a password hash. They cannot sign in with a password automatically. For testing, create a new account through **Sign up**. If you want to keep an old account, add a password-reset/migration flow later rather than storing a plaintext password in MongoDB.

## UI updates
- WhatsApp-style white login card with green header/branding.
- Log in / Sign up tabs.
- Phone / Email tabs.
- Show/hide password control.
- Improved circular profile image picker with camera badge.
- Refined in-app profile icon and profile modal.
