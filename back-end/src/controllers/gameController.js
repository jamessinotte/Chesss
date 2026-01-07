const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.getProfile = async (req, res) => {
  try {
    // use param id if it exists, otherwise use the logged in user
    let userId = null;
    if (req.params && req.params.userId) userId = req.params.userId;
    else userId = req.user ? req.user.id : null;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;

    // don’t let people update password from this route
    if (updates && updates.password) {
      delete updates.password;
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    // hash and save new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error changing password' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    // default mode is blitz if nothing is passed in
    let mode = 'blitz';
    if (req.query && req.query.mode) mode = req.query.mode;

    const key = `mmr.${mode}`;

    const leaderboard = await User.find()
      .select('username mmr')
      .sort({ [key]: -1 })
      .limit(20);

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    let query = '';
    if (req.query && req.query.username) query = req.query.username;
    else if (req.query && req.query.query) query = req.query.query;

    query = (query || '').trim();
    console.log('[searchUsers] query:', query);

    if (!query) {
      return res.json([]);
    }

    // case-insensitive username match
    const users = await User.find(
      { username: new RegExp(query, 'i') },
      'username status'
    );

    console.log('[searchUsers] results:', users.length);
    res.json(users);
  } catch (err) {
    console.error('[searchUsers] error:', err);
    res.status(500).json({ message: 'Error searching users' });
  }
};

exports.getFriends = async (req, res) => {
  try {
    // can fetch using param or the logged in user
    let userId = null;
    if (req.params && req.params.userId) userId = req.params.userId;
    else userId = req.user.id;

    const user = await User.findById(userId)
      .populate('friends', 'username status')
      .select('friends');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const friends = user.friends ? user.friends : [];
    res.json(friends);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching friends list' });
  }
};

exports.addFriend = async (req, res) => {
  try {
    const friendId = req.body.friendId;

    // quick check so you can't add yourself
    if (String(friendId) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot add yourself.' });
    }

    const user = await User.findById(req.user.id);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ message: 'Friend not found' });
    }

    // don’t add duplicates
    let already = false;
    for (let i = 0; i < user.friends.length; i++) {
      if (String(user.friends[i]) === String(friendId)) {
        already = true;
        break;
      }
    }
    if (already) {
      return res.status(400).json({ message: 'Already friends' });
    }

    user.friends.push(friendId);
    friend.friends.push(user._id);

    await user.save();
    await friend.save();

    res.json({ message: 'Friend added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding friend' });
  }
};
