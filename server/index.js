require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const http = require('http');
const socketIo = require('socket.io');
const customerRoutes = require('./routes/customer');
const { supabase, testConnection } = require('./utils/supabase');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "https://finance.kitapunya.web.id",
      "http://localhost:5173",
      "http://localhost:5100",
      "https://fin.kitapunya.web.id"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    "https://finance.kitapunya.web.id",
    "http://localhost:5173",
    "http://localhost:5100",
    "https://fin.kitapunya.web.id"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));
app.use(express.json());

// Routes
app.use('/api/customers', customerRoutes);

// Health check
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({
    status: dbConnected ? 'OK' : 'DB_ERROR',
    database: 'Supabase',
    timestamp: new Date().toISOString()
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-display', () => {
    socket.join('display');
    console.log('Display joined:', socket.id);
  });

  socket.on('join-teller', (tellerId) => {
    socket.join(`teller-${tellerId}`);
    console.log(`Teller ${tellerId} joined:`, socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Auto-reset queue counter setiap hari jam 00:00
const scheduledTask = cron.schedule('0 0 * * *', async () => {
  try {
    console.log('Running daily queue counter reset...');

    const today = new Date().toISOString().split('T')[0];

    // Check if counter for today already exists
    const { data: existingCounter, error } = await supabase
      .from('queue_counters')
      .select('*')
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking counter:', error);
      return;
    }

    if (!existingCounter) {
      // Create new counter for today
      const { error: insertError } = await supabase
        .from('queue_counters')
        .insert({
          date: today,
          counter: 0,
          last_reset: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating counter:', insertError);
      } else {
        console.log('Queue counter reset successfully for', today);
      }
    } else {
      console.log('Queue counter for', today, 'already exists');
    }

  } catch (error) {
    console.error('Error in daily reset:', error);
  }
}, {
  scheduled: false,
  timezone: "Asia/Jakarta"
});

// Start server
const startServer = async () => {
  // Test Supabase connection
  const connected = await testConnection();

  if (!connected) {
    console.error('Failed to connect to Supabase. Please check your credentials.');
    process.exit(1);
  }

  // Start cron job
  scheduledTask.start();
  console.log('Daily reset cron job started');

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`WebSocket server ready`);
  });
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer().catch(console.error);

module.exports = app;