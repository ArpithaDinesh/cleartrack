const BusRoute = require('../models/BusRoute');

// Get all routes
exports.getRoutes = async (req, res) => {
  try {
    const routes = await BusRoute.find().sort({ group: 1, location: 1 });
    res.json({ success: true, routes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create a route
exports.createRoute = async (req, res) => {
  try {
    const route = await BusRoute.create(req.body);
    res.status(201).json({ success: true, route });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Update a route
exports.updateRoute = async (req, res) => {
  try {
    const route = await BusRoute.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, route });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Delete a route
exports.deleteRoute = async (req, res) => {
  try {
    const route = await BusRoute.findByIdAndDelete(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, message: 'Route deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Seed initial data
exports.seedRoutes = async (req, res) => {
  try {
    const initialRoutes = [
      // Kannur
      { group: 'Kannur', location: 'Kannur', fee: 12500 },
      { group: 'Kannur', location: 'Mele Chowva', fee: 12300 },
      { group: 'Kannur', location: 'Thazhe Chowva', fee: 12000 },
      { group: 'Kannur', location: 'Chala', fee: 11250 },
      { group: 'Kannur', location: 'Kadachira', fee: 10200 },
      { group: 'Kannur', location: 'Moonnuperiya', fee: 8500 },
      { group: 'Kannur', location: 'Mambaram', fee: 7000 },
      { group: 'Kannur', location: 'Kayalode', fee: 6000 },
      { group: 'Kannur', location: 'Kappummal', fee: 5500 },
      { group: 'Kannur', location: 'Kadirur', fee: 5000 },
      // Mattannur
      { group: 'Mattannur', location: 'Mattannur', fee: 12000 },
      { group: 'Mattannur', location: 'Uruvachal', fee: 10000 },
      { group: 'Mattannur', location: 'Nirmalagiri', fee: 7800 },
      { group: 'Mattannur', location: 'Kuthuparamba', fee: 6200 },
      { group: 'Mattannur', location: 'Pookkode', fee: 6000 },
      { group: 'Mattannur', location: '6th Mile', fee: 5700 },
      { group: 'Mattannur', location: '5th Mile', fee: 5500 },
      // Thalassery
      { group: 'Thalassery', location: 'Thalassery', fee: 6000 },
      { group: 'Thalassery', location: 'Chonadam', fee: 5400 },
      { group: 'Thalassery', location: 'Nayanar Road', fee: 4000 }
    ];

    await BusRoute.deleteMany({});
    await BusRoute.insertMany(initialRoutes);
    res.json({ success: true, message: 'Seed data inserted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
