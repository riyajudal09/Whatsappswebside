@echo off
set ROOT=%~dp0
start "WhatsApp Backend" cmd /k "cd /d %ROOT%backend && npm install && npm run dev"
start "WhatsApp Frontend" cmd /k "cd /d %ROOT%frontend && npm install && npm start"
echo Two terminals have been opened. Complete any npm install prompts there.
pause
