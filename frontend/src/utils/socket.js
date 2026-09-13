let socketPromise = null;
let socket = null;

export function getSocket() {
  if (socket) return Promise.resolve(socket);
  if (socketPromise) return socketPromise;

  socketPromise = new Promise((resolve, reject) => {
    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const connect = () => {
      try {
        socket = window.io(apiBase, { withCredentials: true, transports: ['websocket', 'polling'] });
        resolve(socket);
      } catch (error) { reject(error); }
    };
    if (window.io) return connect();

    const script = document.createElement('script');
    script.src = `${apiBase}/socket.io/socket.io.js`;
    script.async = true;
    script.onload = connect;
    script.onerror = () => reject(new Error('Unable to load realtime client from backend'));
    document.head.appendChild(script);
  });
  return socketPromise;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
  socketPromise = null;
}
