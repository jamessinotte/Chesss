const Message = require('../models/Message');


exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    if (!receiverId || !content) return res.status(400).json({ message: 'Invalid payload' });

    const message = await Message.create({
      sender: req.user.id,
      receiver: receiverId,
      content
    });
    res.json(message);
  } catch (err) {
    res.status(500).json({ message: 'Error sending message' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: userId },
        { sender: userId, receiver: req.user.id }
      ]
    }).sort('createdAt');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
};
