const router = require('express').Router();
const { protect } = require('./middleware/authMiddleware');
const {
  sendFriendRequest,
  respondFriendRequest,
  getFriendsList,
  getFriendRequests
} = require('../src/controllers/friendController');

// REST (frontend mainly uses sockets to create/respond; but we keep these)
router.post('/send', protect, sendFriendRequest);
router.post('/respond', protect, respondFriendRequest);

// Lists (match your Home.jsx)
router.get('/:userId', protect, getFriendsList);
router.get('/requests/:userId', protect, getFriendRequests);

module.exports = router;
