const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getRoutes, createRoute, updateRoute, deleteRoute, seedRoutes } = require('../controllers/busRoute.controller');

router.get('/', getRoutes);
router.post('/', protect, authorize('admin'), createRoute);
router.put('/:id', protect, authorize('admin'), updateRoute);
router.delete('/:id', protect, authorize('admin'), deleteRoute);
router.post('/seed', protect, authorize('admin'), seedRoutes);

module.exports = router;
