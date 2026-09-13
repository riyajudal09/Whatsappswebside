# Message Send Fix

The previous build could fail to send messages because every message request used `FormData` and manually forced `Content-Type: multipart/form-data`.

For multipart requests the browser/Axios must add a `boundary` value to the Content-Type header. Manually overriding the header can make the server receive an unparsed/empty body, which means `receiverId` or `content` may be missing.

## Changes in this build

- Text-only messages are sent as normal JSON.
- Image/video messages use FormData only when a file is attached.
- Multipart Content-Type is no longer manually forced; Axios/browser supplies the correct boundary.
- Profile photo and status uploads use the same safe multipart behavior.
- Backend message handling now validates the receiver id, checks that the receiver exists, and returns clearer errors.
- Existing OTP, profile-photo, status, Socket.IO, and MongoDB logic is retained.

## Setup reminder

Dependencies are intentionally not stored in the ZIP. Run `npm install` once in both `backend` and `frontend`, or use `start-windows.bat` which does that automatically.
