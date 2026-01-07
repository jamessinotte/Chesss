const mongoose = require('mongoose');

const datasetSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed }
});

module.exports = mongoose.model('Dataset', datasetSchema);
