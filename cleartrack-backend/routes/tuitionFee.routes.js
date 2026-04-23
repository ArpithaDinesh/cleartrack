const express = require('express');
const router = express.Router();
const { getAllFees, updateFee } = require('../controllers/tuitionFee.controller');

router.get('/', getAllFees);
router.post('/update', updateFee);
router.post('/seed', seedFees);

module.exports = router;
