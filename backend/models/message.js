const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, trim: true, default: '' },
  mediaUrl: { type: String, default: '' },
  contentType: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
  reactions: { type: [reactionSchema], default: [] },
  messageStatus: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  deletedForEveryone: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
