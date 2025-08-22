const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const game = require('../controllers/gameController');

router.post('/create', protect, game.createGame);
router.post('/join', protect, game.joinGame);
router.post('/move', protect, game.makeMove);
router.post('/end', protect, game.endGame);
router.get('/:gameId', protect, game.getGame);

module.exports = router;
