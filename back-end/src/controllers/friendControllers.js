const User = require('../models/User');

// POST /api/friends/send
exports.sendFriendRequest = async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.body;
    if (!fromUserId || !toUserId) return res.status(400).json({ message: 'Invalid params' });
    if (fromUserId === toUserId) return res.status(400).json({ message: "Can't add yourself" });

    const toUser = await User.findById(toUserId);
    if (!toUser) return res.status(404).json({ message: 'User not found' });

    // prevent duplicates
    const exists = toUser.friendRequests.find(fr => fr.from.toString() === fromUserId && fr.status === 'pending');
    if (exists) return res.json({ message: 'Friend request already pending' });

    toUser.friendRequests.push({ from: fromUserId });
    await toUser.save();

    res.json({ message: 'Friend request sent' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending friend request' });
  }
};

// POST /api/friends/respond
exports.respondFriendRequest = async (req, res) => {
  try {
    const { userId, requesterId, action } = req.body;
    if (!['accept', 'decline'].includes(action)) return res.status(400).json({ message: 'Invalid action' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const request = user.friendRequests.find(r => r.from.toString() === requesterId && r.status === 'pending');
    if (!request) return res.status(404).json({ message: 'Friend request not found' });

    if (action === 'accept') {
      request.status = 'accepted';
      // mutual friendship
      if (!user.friends.some(id => id.toString() === requesterId)) user.friends.push(requesterId);
      const requester = await User.findById(requesterId);
      if (requester && !requester.friends.some(id => id.toString() === userId)) {
        requester.friends.push(userId);
        await requester.save();
      }
    } else {
      request.status = 'declined';
    }

    await user.save();
    res.json({ message: `Friend request ${action}` });
  } catch (err) {
    res.status(500).json({ message: 'Error responding to friend request' });
  }
};

// GET /api/friends/:userId
exports.getFriendsList = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('friends', 'username status');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.friends || []);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching friends' });
  }
};

// GET /api/friends/requests/:userId
exports.getFriendRequests = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('friendRequests.from', 'username');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.friendRequests || []);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching friend requests' });
  }
};
