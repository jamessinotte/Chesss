const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

// Profile
router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect, userController.updateProfile);
router.put('/change-password', protect, userController.changePassword);

// Leaderboard & Search
router.get('/leaderboard', userController.getLeaderboard);
// NOTE: public search to match your frontend call
router.get('/search', userController.searchUsers);

// Friend list mirror (frontend mainly uses /api/friends)
router.get('/friends/:userId', protect, userController.getFriends);

// Specific user
router.get('/:userId', protect, userController.getProfile);

module.exports = router;
