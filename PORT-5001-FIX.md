# Local port conflict fix

The previous local development setup used port 5000. If another Node process was already using it, Node returned `EADDRINUSE`.

This corrected project uses:
- Backend local port: `5001`
- Frontend API URL: `http://localhost:5001`

Render remains compatible because Render supplies `process.env.PORT`, which takes precedence over values loaded from `.env`.

If port 5001 is also occupied, choose another free port and change both `backend/.env` and `frontend/.env` to the same port.
