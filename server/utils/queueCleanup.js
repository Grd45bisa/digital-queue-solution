const Customer = require('../models/Customer');
const QueueCounter = require('../models/QueueCounter');

/**
 * Membersihkan antrian dari hari sebelumnya yang masih pending
 * dan menandainya sebagai completed
 */
const cleanupPreviousDayQueues = async () => {
  try {
    console.log('Starting cleanup of previous day queues...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Cari semua antrian dari hari sebelumnya yang masih waiting atau processing
    const previousQueues = await Customer.find({
      date: {
        $gte: yesterday,
        $lt: today
      },
      status: { $in: ['waiting', 'processing'] }
    });

    console.log(`Found ${previousQueues.length} queues from previous day to cleanup`);

    if (previousQueues.length > 0) {
      // Update status semua menjadi completed dengan catatan
      const bulkOps = previousQueues.map(queue => ({
        updateOne: {
          filter: { _id: queue._id },
          update: {
            $set: {
              status: 'completed',
              completedAt: new Date(),
              processingEndTime: new Date(),
              processingTime: queue.processingStartTime ?
                Date.now() - queue.processingStartTime.getTime() : null,
              notes: 'Auto-completed due to system restart - previous day queue'
            },
            $currentDate: { updatedAt: true }
          }
        }
      }));

      const result = await Customer.bulkWrite(bulkOps);
      console.log(`Auto-completed ${result.modifiedCount} queues from previous day`);

      // Log detail antrian yang dicleanup
      previousQueues.forEach(queue => {
        console.log(`Auto-completed queue: ${queue.queueNumber} - ${queue.name} (${queue.status})`);
      });
    }

    // Reset counter untuk memastikan dimulai dari 1 untuk hari ini
    const todayStr = today.toISOString().split('T')[0];
    let queueCounter = await QueueCounter.findOne({ date: todayStr });

    if (!queueCounter) {
      // Buat counter baru untuk hari ini
      queueCounter = new QueueCounter({
        date: todayStr,
        counter: 0,
        lastReset: new Date()
      });
      await queueCounter.save();
      console.log('Created new queue counter for today:', todayStr);
    } else {
      // Reset counter yang sudah ada
      queueCounter.counter = 0;
      queueCounter.lastReset = new Date();
      await queueCounter.save();
      console.log('Reset existing queue counter for today:', todayStr);
    }

    console.log('Previous day queues cleanup completed successfully');
    return {
      success: true,
      cleanedCount: previousQueues.length,
      counterReset: true
    };

  } catch (error) {
    console.error('Error during previous day queues cleanup:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check dan cleanup antrian terbawa saat server startup
 */
const checkAndCleanupOldQueues = async () => {
  try {
    const now = new Date();
    const currentHour = now.getHours();

    // Jalankan cleanup hanya jika server restart di pagi hari (jam 6 pagi - 12 siang)
    // Ini mencegah cleanup jika server restart di malam hari
    if (currentHour >= 6 && currentHour <= 12) {
      console.log('Morning startup detected - checking for previous day queues...');
      return await cleanupPreviousDayQueues();
    } else {
      console.log('Server restarted outside morning hours - skipping auto-cleanup');
      return {
        success: true,
        cleanedCount: 0,
        skipped: true,
        reason: 'Not morning hours'
      };
    }

  } catch (error) {
    console.error('Error checking old queues:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  cleanupPreviousDayQueues,
  checkAndCleanupOldQueues
};