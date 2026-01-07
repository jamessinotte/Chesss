const User = require('../models/User');
const bcrypt = require('bcryptjs');


exports.getProfile = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password; 
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect old password' });

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
    const mode = req.query.mode || 'blitz'; 
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
    const query = (req.query.query || req.query.username || '').trim();
    if (!query) return res.json([]);
    const users = await User.find(
      { username: new RegExp(query, 'i') },
      'username status'
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error searching users' });
  }
};


exports.getFriends = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const user = await User.findById(userId).populate('friends', 'username status').select('friends');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.friends || []);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching friends list' });
  }
};


exports.addFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    if (friendId === req.user.id) return res.status(400).json({ message: 'You cannot add yourself.' });

    const user = await User.findById(req.user.id);
    const friend = await User.findById(friendId);
    if (!friend) return res.status(404).json({ message: 'Friend not found' });
    if (user.friends.some(id => id.toString() === friendId)) {
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
