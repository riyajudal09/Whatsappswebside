const express = require('express');
const auth = require('../middleware/authMiddleware');
const upload = require('../config/multerMiddleware');
const c = require('../controllers/chatController');
const router = express.Router();

router.post('/send-message', auth, upload.single('media'), c.sendMessage);
router.get('/conversations', auth, c.getConversations);
router.get('/conversations/:conversationId/messages', auth, c.getMessages);
router.put('/messages/read', auth, c.markAsRead);
router.put('/messages/:messageId/reaction', auth, c.reactToMessage);
router.delete('/messages/:messageId', auth, c.deleteMessage);

module.exports = router;
