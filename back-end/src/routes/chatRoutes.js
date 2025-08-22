const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const chat = require('../controllers/chatController');

router.post('/send', protect, chat.sendMessage);
router.get('/messages/:userId', protect, chat.getMessages);

module.exports = router;
