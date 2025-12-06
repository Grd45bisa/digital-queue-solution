const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const QueueCounter = require('../models/QueueCounter');

// Fungsi untuk memperbaiki queue numbers yang duplikat
const fixDuplicateQueues = async () => {
  try {
    console.log('Starting duplicate queue fix...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Tugas');
    console.log('Connected to MongoDB');

    // Dapatkan semua customer yang memiliki queue number duplikat
    const duplicates = await Customer.aggregate([
      {
        $group: {
          _id: '$queueNumber',
          count: { $sum: 1 },
          documents: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`Found ${duplicates.length} duplicate queue numbers`);

    for (const dup of duplicates) {
      console.log(`Processing duplicate queue number: ${dup._id} (${dup.count} occurrences)`);

      // Ambil semua dokumen dengan queue number yang sama
      const customers = await Customer.find({ queueNumber: dup._id }).sort({ createdAt: 1 });

      // Keep the first one, reassign others
      const keepCustomer = customers[0];
      console.log(`Keeping ${keepCustomer.queueNumber} (ID: ${keepCustomer._id})`);

      // Reassign queue numbers untuk duplikat
      for (let i = 1; i < customers.length; i++) {
        const customer = customers[i];

        // Dapatkan counter untuk hari ini
        const today = new Date().toISOString().split('T')[0];
        let counter = await QueueCounter.findOne({ date: today });

        if (!counter) {
          counter = new QueueCounter({
            date: today,
            counter: 0,
            lastReset: new Date()
          });
          await counter.save();
        }

        // Increment counter
        counter.counter += 1;
        await counter.save();

        // Generate new queue number
        const newQueueNumber = `A${String(counter.counter).padStart(2, '0')}`;

        // Update customer dengan queue number baru
        customer.queueNumber = newQueueNumber;
        customer.queueOrder = counter.counter;
        customer.notes = customer.notes || [];
        customer.notes.push(`Queue number reassigned from ${dup._id} to ${newQueueNumber} on ${new Date().toISOString()}`);

        await customer.save();

        console.log(`Reassigned customer ${customer._id} from ${dup._id} to ${newQueueNumber}`);
      }
    }

    console.log('Duplicate queue fix completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing duplicate queues:', error);
    process.exit(1);
  }
};

// Run jika file ini dijalankan langsung
if (require.main === module) {
  fixDuplicateQueues();
}

module.exports = fixDuplicateQueues;