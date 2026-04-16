const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { processOCR, confirmOCR } = require('../controllers/ocr.controller');

router.post('/process/:requestId', protect, authorize('student', 'admin'), processOCR);
router.patch('/confirm/:requestId', protect, authorize('student'), confirmOCR);

module.exports = router;
