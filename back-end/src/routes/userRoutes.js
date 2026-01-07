const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect, userController.updateProfile);
router.put('/change-password', protect, userController.changePassword);


router.get('/leaderboard', userController.getLeaderboard);

router.get('/search', userController.searchUsers);


router.get('/friends/:userId', protect, userController.getFriends);


router.get('/:userId', protect, userController.getProfile);

module.exports = router;
