const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const QueueCounter = require('../models/QueueCounter');

// Helper function untuk generate queue number
const generateQueueNumber = async (order) => {
  return `A${String(order).padStart(2, '0')}`;
};

// Helper function untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD
const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

// Helper function untuk reset counter otomatis jika berganti hari
const ensureDailyReset = async () => {
  try {
    const today = getTodayDate();

    // Cari counter untuk hari ini
    let counter = await QueueCounter.findOne({ date: today });

    // Jika tidak ada counter untuk hari ini, buat baru
    if (!counter) {
      console.log(`Creating new counter for ${today}`);
      counter = new QueueCounter({
        date: today,
        counter: 0,
        lastReset: new Date()
      });
      await counter.save();
    }

    return counter;
  } catch (error) {
    console.error('Error in daily reset check:', error);
    throw error;
  }
};

// Create new customer queue - versi sederhana
router.post('/queue', async (req, res) => {
  try {
    const { name, phone, service } = req.body;

    if (!name || !service) {
      return res.status(400).json({ message: 'Name and service are required' });
    }

    console.log('Creating queue for:', { name, service });

    // Pastikan counter reset untuk hari baru
    let queueCounter = await ensureDailyReset();

    // Gunakan atomic operation untuk increment counter
    const updatedCounter = await QueueCounter.findOneAndUpdate(
      { date: queueCounter.date },
      { $inc: { counter: 1 } },
      { new: true }
    );

    const queueOrder = updatedCounter.counter;
    const queueNumber = await generateQueueNumber(queueOrder);

    console.log('Generated queue:', { queueOrder, queueNumber });

    // Cek apakah queue number sudah ada (meskipun seharusnya tidak mungkin)
    const existingCustomer = await Customer.findOne({ queueNumber });
    if (existingCustomer) {
      console.log('Queue number already exists:', queueNumber);
      return res.status(500).json({ message: 'Queue number already exists' });
    }

    // Buat customer baru
    const customer = new Customer({
      name,
      phone: phone || '',
      service,
      queueNumber,
      queueOrder,
      date: new Date(),
      status: 'waiting'
    });

    await customer.save();

    console.log('Customer created successfully:', customer.queueNumber);

    // Get Socket.IO instance and emit real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('new-queue', {
        customer: customer,
        message: `New queue created: ${queueNumber}`
      });

      io.emit('queue-update', {
        action: 'created',
        customer: customer,
        totalWaiting: await Customer.countDocuments({
          date: { $gte: new Date().setHours(0, 0, 0, 0) },
          status: 'waiting'
        })
      });
    }

    res.status(201).json({
      success: true,
      data: {
        queueNumber,
        name: customer.name,
        service: customer.service,
        queueOrder: customer.queueOrder
      }
    });

  } catch (error) {
    console.error('Error creating queue:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all customers for today
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const customers = await Customer.find({
      date: { $gte: today, $lt: tomorrow }
    }).sort({ queueOrder: 1 });

    res.json({
      success: true,
      data: customers
    });

  } catch (error) {
    console.error('Error fetching today customers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reset counter endpoint
router.post('/reset-counter', async (req, res) => {
  try {
    const today = getTodayDate();

    // Hapus counter hari ini jika ada
    await QueueCounter.deleteOne({ date: today });

    // Buat counter baru
    const newCounter = new QueueCounter({
      date: today,
      counter: 0,
      lastReset: new Date()
    });
    await newCounter.save();

    console.log(`Manual reset performed for ${today}`);

    res.json({
      success: true,
      data: {
        message: 'Queue counter reset successfully',
        newCounter: {
          date: newCounter.date,
          counter: newCounter.counter,
          lastReset: newCounter.lastReset
        }
      }
    });

  } catch (error) {
    console.error('Error in manual reset:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;