const { Server } = require('socket.io');
const mongoose = require('mongoose');
const User = require('./models/User');
const Game = require('./models/Game');

// Elo rating calculation
const elo = (playerMMR, opponentMMR, score) => {
  const expected = 1 / (1 + Math.pow(10, (opponentMMR - playerMMR) / 400));
  const k = 32;
  return Math.round(playerMMR + k * (score - expected));
};

// queues for matchmaking
let queues = { classical: [], blitz: [], bullet: [] };

// keep track of which socket belongs to which user
const userSockets = new Map();

module.exports = (server) => {
  const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true }
  });

  io.on('connection', async (socket) => {
    // user id sent from frontend
    const userId = socket.handshake.query.userId;

    // save socket id and mark user online
    if (userId && mongoose.isValidObjectId(userId)) {
      userSockets.set(userId.toString(), socket.id);
      try { await User.findByIdAndUpdate(userId, { status: 'online' }); } catch (e) {}
    }

    socket.on('sendFriendRequest', async (data) => {
      try {
        if (!data) return;

        if (!data.fromUserId || !data.toUserId) return;
        if (String(data.fromUserId) === String(data.toUserId)) return;

        const toUser = await User.findById(data.toUserId);
        if (!toUser) return;

        let exists = false;
        for (let i = 0; i < toUser.friendRequests.length; i++) {
          if (
            String(toUser.friendRequests[i].from) === String(data.fromUserId) &&
            toUser.friendRequests[i].status === 'pending'
          ) {
            exists = true;
            break;
          }
        }

        if (!exists) {
          toUser.friendRequests.push({ from: data.fromUserId });
          await toUser.save();
        }

        io.emit('friendRequestReceived', { from: data.fromUserId, to: data.toUserId });
      } catch (e) {}
    });

    socket.on('acceptFriendRequest', async (data) => {
      try {
        if (!data) return;
        const uid = data.userId;
        const requesterId = data.requesterId;

        if (!uid || !requesterId) return;

        const user = await User.findById(uid);
        if (!user) return;

        let idx = -1;
        for (let i = 0; i < user.friendRequests.length; i++) {
          const r = user.friendRequests[i];
          if (String(r.from) === String(requesterId) && r.status === 'pending') {
            idx = i;
            break;
          }
        }
        if (idx === -1) return;

        let alreadyFriend = false;
        for (let i = 0; i < user.friends.length; i++) {
          if (String(user.friends[i]) === String(requesterId)) {
            alreadyFriend = true;
            break;
          }
        }
        if (!alreadyFriend) user.friends.push(requesterId);

        const requester = await User.findById(requesterId);
        if (requester) {
          let hasUser = false;
          for (let i = 0; i < requester.friends.length; i++) {
            if (String(requester.friends[i]) === String(uid)) {
              hasUser = true;
              break;
            }
          }
          if (!hasUser) requester.friends.push(uid);
          try { await requester.save(); } catch (e) {}
        }

        user.friendRequests.splice(idx, 1);
        await user.save();

        io.emit('friendRequestAccepted', { by: uid, requesterId });
      } catch (e) {}
    });

    socket.on('declineFriendRequest', async (data) => {
      try {
        if (!data) return;

        const uid = data.userId;
        const requesterId = data.requesterId;
        if (!uid || !requesterId) return;

        const user = await User.findById(uid);
        if (!user) return;

        let idx = -1;
        for (let i = 0; i < user.friendRequests.length; i++) {
          const r = user.friendRequests[i];
          if (String(r.from) === String(requesterId) && r.status === 'pending') {
            idx = i;
            break;
          }
        }
        if (idx === -1) return;

        user.friendRequests.splice(idx, 1);
        await user.save();

        io.emit('friendRequestDeclined', { by: uid, requesterId });
      } catch (e) {}
    });

    socket.on('inviteFriendMatch', async (data) => {
      try {
        if (!data) return;
        if (!data.fromUserId || !data.toUserId) return;

        if (String(data.fromUserId) === String(data.toUserId)) return;

        const targetSocket = userSockets.get(String(data.toUserId));
        if (!targetSocket) return;

        const fromUser = await User.findById(data.fromUserId).select('username');
        if (!fromUser) return;

        io.to(targetSocket).emit('friendMatchInvite', {
          fromUserId: data.fromUserId,
          fromUsername: fromUser.username,
          mode: data.mode
        });
      } catch (e) {}
    });

    socket.on('acceptFriendMatch', async (data) => {
      try {
        if (!data) return;
        if (!data.fromUserId || !data.toUserId) return;
        if (String(data.fromUserId) === String(data.toUserId)) return;

        const fromSocket = userSockets.get(String(data.fromUserId));
        const toSocket = userSockets.get(String(data.toUserId));
        if (!fromSocket || !toSocket) return;

        const fromUser = await User.findById(data.fromUserId);
        const toUser = await User.findById(data.toUserId);
        if (!fromUser || !toUser) return;

        let white = null;
        let black = null;

        if (Math.random() > 0.5) {
          white = fromUser;
          black = toUser;
        } else {
          white = toUser;
          black = fromUser;
        }

        const game = await Game.create({
          mode: data.mode,
          status: 'in-progress',
          white: white._id,
          black: black._id,
          moves: []
        });

        const roomId = 'game-' + game._id.toString();

        const s1 = io.sockets.sockets.get(fromSocket);
        const s2 = io.sockets.sockets.get(toSocket);
        if (s1) s1.join(roomId);
        if (s2) s2.join(roomId);

        io.to(fromSocket).emit('matchFound', {
          roomId: roomId,
          mode: data.mode,
          color: String(white._id) === String(fromUser._id) ? 'white' : 'black',
          opponent: String(white._id) === String(fromUser._id) ? black.username : white.username
        });

        io.to(toSocket).emit('matchFound', {
          roomId: roomId,
          mode: data.mode,
          color: String(white._id) === String(toUser._id) ? 'white' : 'black',
          opponent: String(white._id) === String(toUser._id) ? black.username : white.username
        });
      } catch (e) {}
    });

    socket.on('declineFriendMatch', async (data) => {
      try {
        if (!data) return;
        const fromSocket = userSockets.get(String(data.fromUserId));
        if (!fromSocket) return;

        io.to(fromSocket).emit('friendMatchDeclined', { by: data.toUserId });
      } catch (e) {}
    });

    socket.on('joinMatch', (data) => {
      if (!data || !data.roomId) return;
      socket.join(data.roomId);
    });

    socket.on('findMatch', async (data) => {
      try {
        if (!data || !data.mode) return;

        const mode = data.mode;

        const user = await User.findById(userId);
        if (!user) return;

        if (!queues[mode]) queues[mode] = [];
        queues[mode].push({ socketId: socket.id, user: user });

        if (queues[mode].length >= 2) {
          const p1 = queues[mode].shift();
          const p2 = queues[mode].shift();

          let white = null;
          let black = null;

          if (Math.random() > 0.5) {
            white = p1.user;
            black = p2.user;
          } else {
            white = p2.user;
            black = p1.user;
          }

          const game = await Game.create({
            mode: mode,
            status: 'in-progress',
            white: white._id,
            black: black._id,
            moves: []
          });

          const roomId = 'game-' + game._id.toString();

          const sp1 = io.sockets.sockets.get(p1.socketId);
          const sp2 = io.sockets.sockets.get(p2.socketId);
          if (sp1) sp1.join(roomId);
          if (sp2) sp2.join(roomId);

          if (sp1) {
            sp1.emit('matchFound', {
              roomId,
              mode,
              color: String(white._id) === String(p1.user._id) ? 'white' : 'black',
              opponent: String(white._id) === String(p1.user._id) ? black.username : white.username
            });
          }

          if (sp2) {
            sp2.emit('matchFound', {
              roomId,
              mode,
              color: String(white._id) === String(p2.user._id) ? 'white' : 'black',
              opponent: String(white._id) === String(p2.user._id) ? black.username : white.username
            });
          }
        }
      } catch (e) {}
    });

    socket.on('playerMove', async (data) => {
      try {
        if (!data) return;
        if (!data.roomId || !data.move) return;

        const gameId = data.roomId.replace('game-', '');
        if (!mongoose.isValidObjectId(gameId)) return;

        await Game.findByIdAndUpdate(gameId, { $push: { moves: data.move } });

        io.to(data.roomId).emit('moveMade', data.move);
      } catch (e) {}
    });

    socket.on('gameEnd', async (data) => {
      try {
        if (!data) return;

        const roomId = data.roomId;
        const winner = data.winner;

        const gameId = roomId?.replace('game-', '');
        if (!mongoose.isValidObjectId(gameId)) return;

        const game = await Game.findById(gameId).populate('white black');
        if (!game) return;

        game.status = 'completed';
        game.winner = winner || 'draw';
        await game.save();

        const mode = game.mode;

        const user1 = await User.findById(game.white);
        const user2 = await User.findById(game.black);
        if (!user1 || !user2) return;

        let s1 = 0.5;
        let s2 = 0.5;

        if (winner === 'white') {
          s1 = 1;
          s2 = 0;
        }
        if (winner === 'black') {
          s1 = 0;
          s2 = 1;
        }

        const old1 = user1.mmr[mode];
        const old2 = user2.mmr[mode];

        user1.mmr[mode] = elo(old1, old2, s1);
        user2.mmr[mode] = elo(old2, old1, s2);

        await user1.save();
        await user2.save();

        io.to(roomId).emit('gameOver', { winner: winner });
      } catch (e) {}
    });

    socket.on('disconnect', async () => {
      if (userId && mongoose.isValidObjectId(userId)) {
        userSockets.delete(userId.toString());
        try { await User.findByIdAndUpdate(userId, { status: 'offline' }); } catch (e) {}
      }
    });
  });

  return io;
};
