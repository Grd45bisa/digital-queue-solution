const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  service: {
    type: String,
    required: true,
    enum: ['installment', 'newcredit', 'account', 'complaint', 'datachange', 'priority']
  },
  queueNumber: {
    type: String,
    required: true,
    unique: true
  },
  queueOrder: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['waiting', 'processing', 'completed'],
    default: 'waiting'
  },
  tellerId: {
    type: String,
    default: null
  },
  processingStartTime: {
    type: Date,
    default: null
  },
  processingEndTime: {
    type: Date,
    default: null
  },
  processingTime: {
    type: Number,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  skipCount: {
    type: Number,
    default: 0
  },
  isExpired: {
    type: Boolean,
    default: false
  },
  skippedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Validation untuk multiple tellers
customerSchema.pre('save', function(next) {
  // Validasi: tellerId harus ada jika status adalah 'processing'
  if (this.status === 'processing' && !this.tellerId) {
    return next(new Error('tellerId is required when status is processing'));
  }

  // Auto-set processingStartTime ketika status berubah menjadi 'processing'
  if (this.status === 'processing' && !this.processingStartTime) {
    this.processingStartTime = new Date();
  }

  // Auto-set processingEndTime dan completedAt ketika status berubah menjadi 'completed'
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
    this.processingEndTime = new Date();

    // Hitung processing time jika ada processingStartTime
    if (this.processingStartTime) {
      this.processingTime = Date.now() - this.processingStartTime.getTime();
    }
  }

  next();
});

// Index untuk optimasi query
customerSchema.index({ date: 1 });
customerSchema.index({ queueNumber: 1 });
customerSchema.index({ status: 1 });

// Index tambahan untuk optimasi multiple tellers
customerSchema.index({ tellerId: 1 });
customerSchema.index({ tellerId: 1, status: 1 });
customerSchema.index({ date: 1, tellerId: 1, status: 1 });
customerSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Customer', customerSchema);