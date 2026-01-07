const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const {
  sendFriendRequest,
  respondFriendRequest,
  getFriendsList,
  getFriendRequests
} = require('../controllers/friendControllers');


router.post('/send', protect, sendFriendRequest);
router.post('/respond', protect, respondFriendRequest);


router.get('/requests/:userId', protect, getFriendRequests);
router.get('/:userId', protect, getFriendsList);

module.exports = router;
