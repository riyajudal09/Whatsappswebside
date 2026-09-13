const mongoose = require('mongoose');
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const User = require('../models/user');
const { uploadFileToCloudinary } = require('../config/cloudinaryConfig');
const response = require('../utils/responseHandler');

const populateMessage = (query) => query
  .populate('sender', 'username profilepicture')
  .populate('receiver', 'username profilepicture')
  .populate('reactions.user', 'username profilepicture');

exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user?.userId;
    const receiverId = String(req.body?.receiverId || '').trim();
    const content = String(req.body?.content || '').trim();

    if (!senderId) return response(res, 401, 'Unauthorized');
    if (!receiverId) {
      return response(res, 400, 'Receiver is required. Please select a contact and try again.');
    }
    if (!mongoose.isValidObjectId(receiverId)) {
      return response(res, 400, 'Invalid receiver id');
    }
    if (String(receiverId) === String(senderId)) {
      return response(res, 400, 'You cannot message yourself');
    }

    const receiver = await User.findOne({ _id: receiverId, isverified: true }).select('_id');
    if (!receiver) return response(res, 404, 'Receiver account was not found');

    let mediaUrl = '';
    let contentType = 'text';
    if (req.file) {
      const uploaded = await uploadFileToCloudinary(req.file, req);
      mediaUrl = uploaded?.secure_url || '';
      if (!mediaUrl) return response(res, 500, 'Unable to save uploaded media');
      contentType = req.file.mimetype?.startsWith('video/') ? 'video' : 'image';
    } else if (!content) {
      return response(res, 400, 'Message cannot be empty');
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId], $size: 2 },
    });

    if (!conversation) {
      conversation = await Conversation.create({ participants: [senderId, receiverId] });
    }

    const receiverSocketId = req.socketUserMap?.get(String(receiverId));
    const message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      receiver: receiverId,
      content,
      mediaUrl,
      contentType,
      messageStatus: receiverSocketId ? 'delivered' : 'sent',
    });

    conversation.lastMessage = message._id;
    await conversation.save();

    const populated = await populateMessage(Message.findById(message._id));
    if (!populated) return response(res, 500, 'Message was created but could not be loaded');

    // Each connected user joins a room named with their MongoDB user id.
    // Emitting to the room works even if that user has reconnected and their
    // socket id has changed.
    if (receiverSocketId) {
      req.io?.to(String(receiverId)).emit('receive_message', populated);
    }
    req.io?.to(String(senderId)).emit('conversation_updated', {
      conversationId: conversation._id.toString(),
    });
    req.io?.to(String(receiverId)).emit('conversation_updated', {
      conversationId: conversation._id.toString(),
    });

    return response(res, 201, 'Message sent', {
      message: populated,
      conversationId: conversation._id.toString(),
    });
  } catch (error) {
    console.error('sendMessage:', error);

    if (error?.name === 'ValidationError' || error?.name === 'CastError') {
      return response(res, 400, error.message || 'Invalid message data');
    }
    if (Number(error?.code) === 11000) {
      return response(res, 409, 'A database conflict occurred while sending the message');
    }
    return response(res, 500, error.message || 'Unable to send message');
  }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'username profilepicture about isOnline lastSeen fullPhoneNumber')
      .populate({
        path: 'lastMessage',
        populate: [
          { path: 'sender', select: 'username profilepicture' },
          { path: 'receiver', select: 'username profilepicture' },
        ],
      })
      .sort({ updatedAt: -1 })
      .lean();

    const withUnread = await Promise.all(conversations.map(async (conv) => ({
      ...conv,
      unreadCount: await Message.countDocuments({
        conversation: conv._id,
        receiver: userId,
        messageStatus: { $ne: 'read' },
        deletedForEveryone: false,
      }),
    })));
    return response(res, 200, 'Conversations retrieved', withUnread);
  } catch (error) {
    console.error('getConversations:', error);
    return response(res, 500, 'Unable to retrieve conversations');
  }
};

exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return response(res, 404, 'Conversation not found');
    if (!conversation.participants.some((p) => String(p) === String(userId))) {
      return response(res, 403, 'Not allowed to view this conversation');
    }

    const messages = await populateMessage(
      Message.find({ conversation: conversationId }).sort({ createdAt: 1 })
    );

    const unread = messages.filter((m) => String(m.receiver?._id || m.receiver) === String(userId) && m.messageStatus !== 'read');
    if (unread.length) {
      const ids = unread.map((m) => m._id);
      await Message.updateMany({ _id: { $in: ids } }, { $set: { messageStatus: 'read' } });
      const senderIds = [...new Set(unread.map((m) => String(m.sender?._id || m.sender)))];
      senderIds.forEach((senderId) => req.io?.to(senderId).emit('message_status_update', { messageIds: ids, messageStatus: 'read' }));
      unread.forEach((m) => { m.messageStatus = 'read'; });
    }

    return response(res, 200, 'Messages retrieved', messages);
  } catch (error) {
    console.error('getMessages:', error);
    return response(res, 500, 'Unable to retrieve messages');
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const ids = Array.isArray(req.body.messageIds) ? req.body.messageIds : [];
    const messages = await Message.find({ _id: { $in: ids }, receiver: userId });
    await Message.updateMany({ _id: { $in: ids }, receiver: userId }, { $set: { messageStatus: 'read' } });
    const senderIds = [...new Set(messages.map((m) => String(m.sender)))];
    senderIds.forEach((senderId) => req.io?.to(senderId).emit('message_status_update', { messageIds: ids, messageStatus: 'read' }));
    return response(res, 200, 'Messages marked as read');
  } catch (error) {
    return response(res, 500, 'Unable to mark messages as read');
  }
};

exports.reactToMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.params;
    const { emoji } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return response(res, 404, 'Message not found');
    const allowed = [String(message.sender), String(message.receiver)].includes(String(userId));
    if (!allowed) return response(res, 403, 'Not allowed');

    const existing = message.reactions.findIndex((r) => String(r.user) === String(userId));
    if (!emoji) {
      if (existing >= 0) message.reactions.splice(existing, 1);
    } else if (existing >= 0) {
      if (message.reactions[existing].emoji === emoji) message.reactions.splice(existing, 1);
      else message.reactions[existing].emoji = emoji;
    } else {
      message.reactions.push({ user: userId, emoji });
    }
    await message.save();
    const populated = await populateMessage(Message.findById(messageId));
    req.io?.to(String(message.sender)).emit('reaction_update', populated);
    req.io?.to(String(message.receiver)).emit('reaction_update', populated);
    return response(res, 200, 'Reaction updated', populated);
  } catch (error) {
    return response(res, 500, 'Unable to update reaction');
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const message = await Message.findById(req.params.messageId);
    if (!message) return response(res, 404, 'Message not found');
    if (String(message.sender) !== String(userId)) return response(res, 403, 'Only the sender can delete this message');

    message.deletedForEveryone = true;
    message.content = '';
    message.mediaUrl = '';
    message.contentType = 'text';
    message.reactions = [];
    await message.save();
    req.io?.to(String(message.receiver)).emit('message_deleted', { messageId: message._id.toString() });
    req.io?.to(String(message.sender)).emit('message_deleted', { messageId: message._id.toString() });
    return response(res, 200, 'Message deleted');
  } catch (error) {
    return response(res, 500, 'Unable to delete message');
  }
};
