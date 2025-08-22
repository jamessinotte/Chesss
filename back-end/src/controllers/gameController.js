const Game = require('../models/Game');
const User = require('../models/User');

const elo = (playerMMR, opponentMMR, score) => {
  const expected = 1 / (1 + Math.pow(10, (opponentMMR - playerMMR) / 400));
  const k = 32;
  return Math.round(playerMMR + k * (score - expected));
};

exports.createGame = async (req, res) => {
  try {
    const { mode } = req.body;
    const game = await Game.create({
      mode,
      status: 'waiting',
      white: req.user._id, // provisional; actual assigned in socket when matched
      moves: []
    });
    res.json(game);
  } catch (error) {
    res.status(500).json({ message: 'Error creating game' });
  }
};

exports.joinGame = async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    if (game.white && game.black) return res.status(400).json({ message: 'Game already full' });

    if (!game.white && String(game.black) !== String(req.user._id)) game.white = req.user._id;
    else if (!game.black && String(game.white) !== String(req.user._id)) game.black = req.user._id;

    game.status = (game.white && game.black) ? 'in-progress' : 'waiting';
    await game.save();

    res.json(game);
  } catch (error) {
    res.status(500).json({ message: 'Error joining game' });
  }
};

exports.makeMove = async (req, res) => {
  try {
    const { gameId, move } = req.body;
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    game.moves.push(move);
    await game.save();

    res.json({ message: 'Move recorded', game });
  } catch (error) {
    res.status(500).json({ message: 'Error making move' });
  }
};

exports.getGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId).populate('white black');
    if (!game) return res.status(404).json({ message: 'Game not found' });
    res.json(game);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching game' });
  }
};

exports.endGame = async (req, res) => {
  try {
    const { gameId, winnerId, mode } = req.body;
    const game = await Game.findById(gameId).populate('white black');
    if (!game) return res.status(404).json({ message: 'Game not found' });

    game.status = 'completed';
    let result = 'draw';
    if (winnerId) {
      result = String(winnerId) === String(game.white?._id) ? 'white' : 'black';
    }
    game.winner = result;
    await game.save();

    const user1 = await User.findById(game.white);
    const user2 = await User.findById(game.black);
    const m = mode || game.mode;

    const u1mmr = user1.mmr[m];
    const u2mmr = user2.mmr[m];

    let s1 = 0.5, s2 = 0.5;
    if (result === 'white') { s1 = 1; s2 = 0; }
    if (result === 'black') { s1 = 0; s2 = 1; }

    user1.mmr[m] = elo(u1mmr, u2mmr, s1);
    user2.mmr[m] = elo(u2mmr, u1mmr, s2);

    await user1.save();
    await user2.save();

    res.json({ message: 'Game ended, MMR updated', game });
  } catch (error) {
    res.status(500).json({ message: 'Error ending game' });
  }
};
