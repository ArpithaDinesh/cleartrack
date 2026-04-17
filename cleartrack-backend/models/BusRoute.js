const mongoose = require('mongoose');

const busRouteSchema = new mongoose.Schema({
  group: {
    type: String,
    required: true,
    enum: ['Kannur', 'Mattannur', 'Thalassery']
  },
  location: {
    type: String,
    required: true
  },
  fee: {
    type: Number,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('BusRoute', busRouteSchema);
