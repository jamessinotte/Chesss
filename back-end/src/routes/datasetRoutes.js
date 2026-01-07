const router = require('express').Router();
const { getDatasetByName } = require('../controllers/datasetController');

router.get('/:name', getDatasetByName);

module.exports = router;
