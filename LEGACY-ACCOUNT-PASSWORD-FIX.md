# Legacy OTP account password fix

## Problem fixed
Older users created by the OTP version already exist in MongoDB but have no `passwordHash`.
That caused:
- `/api/auth/login` -> 409 because no password existed.
- `/api/auth/register` -> 409 because the email/phone already existed.

## New behavior
1. User enters the old email/phone and a desired password on **Log in**.
2. Backend recognizes the old OTP-only account and returns an expected migration state.
3. The UI automatically changes to **Set password**.
4. Clicking **Set password** updates the SAME MongoDB user document with a secure salted password hash.
5. The existing user id, profile and chat relationships are preserved.
6. Future logins use email/phone + password only; no OTP is used.

## Important security note
The compatibility path exists to migrate accounts from this demo project's previous OTP schema. For a real production app, legacy-account password setup should verify ownership (for example with a reset link or another trusted verification method) before allowing a password to be attached to an old account.
