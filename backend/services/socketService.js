const { Server } = require('socket.io');
const User = require('../models/user');

const onlineUsers = new Map();

module.exports = function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'https://whatsappswebside-backendf.onrender.com',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    let currentUserId = null;

    socket.on('user_connected', async (userId) => {
      if (!userId) return;
      currentUserId = String(userId);
      onlineUsers.set(currentUserId, socket.id);
      socket.join(currentUserId);
      try {
        await User.findByIdAndUpdate(currentUserId, { isOnline: true, lastSeen: new Date() });
      } catch (_) {}
      io.emit('user_status', { userId: currentUserId, isOnline: true, lastSeen: new Date() });
    });

    socket.on('typing_start', ({ receiverId, conversationId }) => {
      if (!receiverId || !currentUserId) return;
      io.to(String(receiverId)).emit('user_typing', {
        userId: currentUserId,
        conversationId,
        isTyping: true,
      });
    });

    socket.on('typing_stop', ({ receiverId, conversationId }) => {
      if (!receiverId || !currentUserId) return;
      io.to(String(receiverId)).emit('user_typing', {
        userId: currentUserId,
        conversationId,
        isTyping: false,
      });
    });

    socket.on('disconnect', async () => {
      if (!currentUserId) return;
      if (onlineUsers.get(currentUserId) === socket.id) onlineUsers.delete(currentUserId);
      const lastSeen = new Date();
      try {
        await User.findByIdAndUpdate(currentUserId, { isOnline: false, lastSeen });
      } catch (_) {}
      io.emit('user_status', { userId: currentUserId, isOnline: false, lastSeen });
    });
  });

  io.socketUserMap = onlineUsers;
  return io;
};
