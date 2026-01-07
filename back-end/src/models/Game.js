const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  mode: { type: String, enum: ['classical', 'blitz', 'bullet'], required: true },
  status: { type: String, enum: ['waiting', 'in-progress', 'completed'], default: 'waiting' },
  white: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  black: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winner: { type: String, enum: ['white', 'black', 'draw', null], default: null },

 
  moves: [mongoose.Schema.Types.Mixed],
  spectators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Game', GameSchema);
