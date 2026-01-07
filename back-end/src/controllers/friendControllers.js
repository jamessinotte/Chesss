const User = require('../models/User');

exports.sendFriendRequest = async (req, res) => {
  try {
    const fromUserId = req.body.fromUserId;
    const toUserId = req.body.toUserId;

    if (!fromUserId || !toUserId) {
      return res.status(400).json({ message: 'Invalid params' });
    }

    if (String(fromUserId) === String(toUserId)) {
      return res.status(400).json({ message: "Can't add yourself" });
    }

    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // check if request already exists
    let exists = false;
    for (let i = 0; i < toUser.friendRequests.length; i++) {
      const fr = toUser.friendRequests[i];
      if (String(fr.from) === String(fromUserId) && fr.status === 'pending') {
        exists = true;
        break;
      }
    }

    if (exists) {
      return res.json({ message: 'Friend request already pending' });
    }

    toUser.friendRequests.push({ from: fromUserId });
    await toUser.save();

    res.json({ message: 'Friend request sent' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending friend request' });
  }
};

exports.respondFriendRequest = async (req, res) => {
  try {
    const userId = req.body.userId;
    const requesterId = req.body.requesterId;
    const action = req.body.action;

    if (action !== 'accept' && action !== 'decline') {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let requestIndex = -1;
    for (let i = 0; i < user.friendRequests.length; i++) {
      const r = user.friendRequests[i];
      if (String(r.from) === String(requesterId) && r.status === 'pending') {
        requestIndex = i;
        break;
      }
    }

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (action === 'accept') {
      // add requester to user friends
      let already = false;
      for (let i = 0; i < user.friends.length; i++) {
        if (String(user.friends[i]) === String(requesterId)) {
          already = true;
          break;
        }
      }
      if (!already) user.friends.push(requesterId);

      // add user to requester friends
      const requester = await User.findById(requesterId);
      if (requester) {
        let hasUser = false;
        for (let i = 0; i < requester.friends.length; i++) {
          if (String(requester.friends[i]) === String(userId)) {
            hasUser = true;
            break;
          }
        }
        if (!hasUser) {
          requester.friends.push(userId);
          await requester.save();
        }
      }
    }

    user.friendRequests.splice(requestIndex, 1);
    await user.save();

    res.json({ message: `Friend request ${action}` });
  } catch (err) {
    res.status(500).json({ message: 'Error responding to friend request' });
  }
};

exports.getFriendsList = async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId).populate('friends', 'username status');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user.friends || []);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching friends' });
  }
};

exports.getFriendRequests = async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId).populate('friendRequests.from', 'username');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const pendingRequests = (user.friendRequests || []).filter((r) => r.status === 'pending');
    res.json(pendingRequests);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching friend requests' });
  }
};
