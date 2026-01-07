const router = require('express').Router();
const { protect } = require('./middleware/authMiddleware');
const {
  sendFriendRequest,
  respondFriendRequest,
  getFriendsList,
  getFriendRequests
} = require('../src/controllers/friendController');


router.post('/send', protect, sendFriendRequest);
router.post('/respond', protect, respondFriendRequest);


router.get('/:userId', protect, getFriendsList);
router.get('/requests/:userId', protect, getFriendRequests);

module.exports = router;
