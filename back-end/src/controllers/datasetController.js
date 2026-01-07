const Dataset = require('../models/Dataset');

exports.getDatasetByName = async (req, res) => {
  try {
    const raw = (req.params.name || '').toLowerCase();
    const parts = raw.match(/[a-z]+/g) || [];
    const datasetName = parts.join('');
    if (!datasetName) return res.status(404).json({ message: 'Not Found' });

    const dataset = await Dataset.findOne({ name: datasetName });
    if (!dataset) return res.status(404).json({ message: 'Not Found' });

    res.json(dataset);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
