const mongoose = require('mongoose');

const queueCounterSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true
  },
  counter: {
    type: Number,
    default: 0
  },
  lastReset: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('QueueCounter', queueCounterSchema);