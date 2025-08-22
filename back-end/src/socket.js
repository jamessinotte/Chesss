const { Server } = require('socket.io');
const mongoose = require('mongoose');
const User = require('./models/User');
const Game = require('./models/Game');

const elo = (playerMMR, opponentMMR, score) => {
  const expected = 1 / (1 + Math.pow(10, (opponentMMR - playerMMR) / 400));
  const k = 32;
  return Math.round(playerMMR + k * (score - expected));
};

const queues = { classical: [], blitz: [], bullet: [] };

module.exports = (server) => {
  const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true } });

  io.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId && mongoose.isValidObjectId(userId)) {
      try { await User.findByIdAndUpdate(userId, { status: 'online' }); } catch {}
    }

    // ==== FRIENDS via sockets (matches Home.jsx) ====
    socket.on('sendFriendRequest', async ({ fromUserId, toUserId }) => {
      try {
        if (!fromUserId || !toUserId || fromUserId === toUserId) return;
        const toUser = await User.findById(toUserId);
        if (!toUser) return;

        const exists = toUser.friendRequests.find(fr => String(fr.from) === String(fromUserId) && fr.status === 'pending');
        if (!exists) {
          toUser.friendRequests.push({ from: fromUserId });
          await toUser.save();
        }
        // Notify receiver
        io.emit('friendRequestReceived', { from: fromUserId, to: toUserId });
      } catch (e) {}
    });

    socket.on('acceptFriendRequest', async ({ userId, requesterId }) => {
      try {
        const user = await User.findById(userId);
        const fr = user.friendRequests.find(r => String(r.from) === String(requesterId) && r.status === 'pending');
        if (!fr) return;
        fr.status = 'accepted';
        if (!user.friends.some(id => String(id) === String(requesterId))) user.friends.push(requesterId);
        await user.save();

        const requester = await User.findById(requesterId);
        if (requester && !requester.friends.some(id => String(id) === String(userId))) {
          requester.friends.push(userId);
          await requester.save();
        }
        io.emit('friendRequestAccepted', { by: userId, requesterId });
      } catch (e) {}
    });

    socket.on('declineFriendRequest', async ({ userId, requesterId }) => {
      try {
        const user = await User.findById(userId);
        const fr = user.friendRequests.find(r => String(r.from) === String(requesterId) && r.status === 'pending');
        if (!fr) return;
        fr.status = 'declined';
        await user.save();
        io.emit('friendRequestDeclined', { by: userId, requesterId });
      } catch (e) {}
    });

    // ==== MATCHMAKING ====
    socket.on('findMatch', async ({ mode }) => {
      try {
        const user = await User.findById(userId);
        if (!user) return;

        queues[mode] = queues[mode] || [];
        queues[mode].push({ socketId: socket.id, user });

        if (queues[mode].length >= 2) {
          const p1 = queues[mode].shift();
          const p2 = queues[mode].shift();

          // Assign colors randomly
          const white = Math.random() > 0.5 ? p1.user : p2.user;
          const black = white._id.toString() === p1.user._id.toString() ? p2.user : p1.user;

          const game = await Game.create({
            mode,
            status: 'in-progress',
            white: white._id,
            black: black._id,
            moves: []
          });

          const roomId = `game-${game._id.toString()}`;
          io.sockets.sockets.get(p1.socketId)?.join(roomId);
          io.sockets.sockets.get(p2.socketId)?.join(roomId);

          io.sockets.sockets.get(p1.socketId)?.emit('matchFound', {
            roomId,
            color: (white._id.toString() === p1.user._id.toString()) ? 'white' : 'black',
            opponent: (white._id.toString() === p1.user._id.toString()) ? black.username : white.username
          });

          io.sockets.sockets.get(p2.socketId)?.emit('matchFound', {
            roomId,
            color: (white._id.toString() === p2.user._id.toString()) ? 'white' : 'black',
            opponent: (white._id.toString() === p2.user._id.toString()) ? black.username : white.username
          });
        }
      } catch (e) {}
    });

    // Moves
    socket.on('playerMove', async ({ roomId, move }) => {
      try {
        const gameId = roomId?.replace('game-', '');
        if (!mongoose.isValidObjectId(gameId)) return;
        await Game.findByIdAndUpdate(gameId, { $push: { moves: move } });
        io.to(roomId).emit('moveMade', move);
      } catch (e) {}
    });

    // Game end (+ ELO)
    socket.on('gameEnd', async ({ roomId, winner }) => {
      try {
        const gameId = roomId?.replace('game-', '');
        if (!mongoose.isValidObjectId(gameId)) return;

        const game = await Game.findById(gameId).populate('white black');
        if (!game) return;

        game.status = 'completed';
        game.winner = winner || 'draw';
        await game.save();

        const m = game.mode;
        const user1 = await User.findById(game.white);
        const user2 = await User.findById(game.black);

        const u1mmr = user1.mmr[m];
        const u2mmr = user2.mmr[m];

        let s1 = 0.5, s2 = 0.5;
        if (winner === 'white') { s1 = 1; s2 = 0; }
        if (winner === 'black') { s1 = 0; s2 = 1; }

        user1.mmr[m] = elo(u1mmr, u2mmr, s1);
        user2.mmr[m] = elo(u2mmr, u1mmr, s2);
        await user1.save();
        await user2.save();

        io.to(roomId).emit('gameOver', { winner });
      } catch (e) {}
    });

    socket.on('disconnect', async () => {
      if (userId && mongoose.isValidObjectId(userId)) {
        try { await User.findByIdAndUpdate(userId, { status: 'offline' }); } catch {}
      }
    });
  });

  return io;
};
