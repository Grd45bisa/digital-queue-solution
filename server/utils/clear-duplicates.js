const mongoose = require('mongoose');
const Customer = require('../models/Customer');

// Fungsi untuk menghapus semua duplikat dan reset counter
const clearAllDuplicates = async () => {
  try {
    console.log('Starting to clear all duplicates...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Tugas');
    console.log('Connected to MongoDB');

    // Hapus semua customer yang memiliki queue number duplikat
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

    let totalDeleted = 0;

    for (const dup of duplicates) {
      // Ambil semua dokumen dengan queue number yang sama
      const customers = await Customer.find({ queueNumber: dup._id }).sort({ createdAt: 1 });

      // Keep the first one, delete the rest
      const keepCustomer = customers[0];
      console.log(`Keeping ${keepCustomer.queueNumber} (ID: ${keepCustomer._id})`);

      for (let i = 1; i < customers.length; i++) {
        const customer = customers[i];
        await Customer.findByIdAndDelete(customer._id);
        console.log(`Deleted duplicate customer ${customer._id} with queue number ${dup._id}`);
        totalDeleted++;
      }
    }

    console.log(`Deleted ${totalDeleted} duplicate customers successfully`);
    console.log('Clear duplicates completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing duplicates:', error);
    process.exit(1);
  }
};

// Run jika file ini dijalankan langsung
if (require.main === module) {
  clearAllDuplicates();
}

module.exports = clearAllDuplicates;