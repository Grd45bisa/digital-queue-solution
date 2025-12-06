const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabase');

// Helper: Generate queue number
const generateQueueNumber = (order) => `A${String(order).padStart(3, '0')}`;

// Helper: Get today's date
const getTodayDate = () => new Date().toISOString().split('T')[0];

// Helper: Convert DB row to camelCase for frontend compatibility
const dbToFrontend = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    phone: row.phone,
    service: row.service,
    queueNumber: row.queue_number,
    queueOrder: row.queue_order,
    date: row.date,
    status: row.status,
    tellerId: row.teller_id,
    skipCount: row.skip_count || 0,
    isExpired: row.is_expired || false,
    skippedAt: row.skipped_at,
    processingStartTime: row.processing_start_time,
    processingEndTime: row.processing_end_time,
    processingTime: row.processing_time,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

// Helper: Ensure daily reset
const ensureDailyReset = async () => {
  const today = getTodayDate();
  const { data: counter, error } = await supabase
    .from('queue_counters').select('*').eq('date', today).single();

  if (error && error.code !== 'PGRST116') throw error;

  if (!counter) {
    const { data: newCounter, error: insertError } = await supabase
      .from('queue_counters')
      .insert({ date: today, counter: 0, last_reset: new Date().toISOString() })
      .select().single();
    if (insertError) throw insertError;
    return newCounter;
  }
  return counter;
};

// Helper: Cleanup old queues
const cleanupOldQueues = async () => {
  const today = getTodayDate();
  await supabase.from('customers')
    .update({ status: 'completed' })
    .lt('date', today)
    .in('status', ['waiting', 'processing']);
};

// CREATE QUEUE
router.post('/queue', async (req, res) => {
  try {
    const { name, phone, service } = req.body;
    if (!name || !service) {
      return res.status(400).json({ success: false, message: 'Name and service are required' });
    }

    // Check maximum queue limit (100)
    const { count: activeCount } = await supabase.from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('date', getTodayDate())
      .in('status', ['waiting', 'processing']);

    if (activeCount >= 100) {
      return res.status(400).json({
        success: false,
        message: '⚠️ Sistem Antrian Penuh\n\nAntrian sudah mencapai batas maksimal (100 orang).\nSilakan coba lagi besok atau hubungi administrator.'
      });
    }

    let queueCounter = await ensureDailyReset();
    await cleanupOldQueues();

    const { data: updatedCounter } = await supabase
      .from('queue_counters')
      .update({ counter: queueCounter.counter + 1 })
      .eq('date', queueCounter.date)
      .select().single();

    const queueNumber = generateQueueNumber(updatedCounter.counter);

    const { data: customer } = await supabase.from('customers').insert({
      name: name.trim(),
      phone: phone?.trim() || null,
      service,
      queue_number: queueNumber,
      queue_order: updatedCounter.counter,
      date: getTodayDate(),
      status: 'waiting'
    }).select().single();

    const io = req.app.get('io');
    if (io) {
      io.emit('new-queue', { customer: dbToFrontend(customer), message: `New queue created: ${queueNumber}` });
      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true })
        .eq('date', getTodayDate()).eq('status', 'waiting');
      io.emit('queue-update', { action: 'created', customer: dbToFrontend(customer), totalWaiting: count || 0 });
    }

    res.status(201).json({
      success: true,
      data: {
        queueNumber,
        name: customer.name,
        service: customer.service,
        queueOrder: customer.queue_order
      }
    });
  } catch (error) {
    console.error('Error creating queue:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET TODAY'S CUSTOMERS
router.get('/today', async (req, res) => {
  try {
    const { data: customers } = await supabase.from('customers')
      .select('*').eq('date', getTodayDate()).order('queue_order');
    res.json({ success: true, data: (customers || []).map(dbToFrontend) });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET CUSTOMER BY QUEUE NUMBER
router.get('/queue/:queueNumber', async (req, res) => {
  try {
    const { data: customer, error } = await supabase.from('customers')
      .select('*').eq('queue_number', req.params.queueNumber).single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    if (error) throw error;

    res.json({ success: true, data: dbToFrontend(customer) });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// CALL NEXT CUSTOMER
router.post('/call-next', async (req, res) => {
  try {
    const { tellerId } = req.body;
    const today = getTodayDate();

    const { data: nextCustomer, error } = await supabase.from('customers')
      .select('*').eq('date', today).eq('status', 'waiting').eq('is_expired', false)
      .order('queue_order').limit(1).single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({ success: false, message: 'No waiting customers' });
    }
    if (error) throw error;

    const { data: updatedCustomer } = await supabase.from('customers')
      .update({
        status: 'processing',
        teller_id: tellerId,
        processing_start_time: new Date().toISOString()
      }).eq('id', nextCustomer.id).select().single();

    const io = req.app.get('io');
    if (io) {
      const converted = dbToFrontend(updatedCustomer);
      io.emit('customer-called', { customer: converted, tellerId, message: `Calling ${converted.queueNumber} to teller ${tellerId}` });
      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true })
        .eq('date', today).eq('status', 'waiting');
      io.emit('queue-update', { action: 'called', customer: converted, tellerId, totalWaiting: count || 0 });
      io.emit('teller-update', { action: 'customer-called', tellerId, customer: converted });
    }

    res.json({ success: true, data: { customer: dbToFrontend(updatedCustomer), message: `Calling ${updatedCustomer.queue_number}` } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// COMPLETE SERVICE
router.post('/complete-service', async (req, res) => {
  try {
    const { queueNumber, tellerId } = req.body;

    const { data: customer, error: fetchError } = await supabase.from('customers')
      .select('*').eq('queue_number', queueNumber).single();

    if (fetchError && fetchError.code === 'PGRST116') {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    if (fetchError) throw fetchError;

    if (customer.status !== 'processing') {
      return res.status(400).json({ success: false, message: 'Customer is not being processed' });
    }

    const processingTime = customer.processing_start_time
      ? Date.now() - new Date(customer.processing_start_time).getTime() : null;

    const { data: updatedCustomer } = await supabase.from('customers').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      processing_end_time: new Date().toISOString(),
      processing_time: processingTime
    }).eq('id', customer.id).select().single();

    const io = req.app.get('io');
    if (io) {
      const converted = dbToFrontend(updatedCustomer);
      io.emit('service-completed', { customer: converted, tellerId, message: `Service completed for ${queueNumber}` });
      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true })
        .eq('date', getTodayDate()).eq('status', 'waiting');
      io.emit('queue-update', { action: 'completed', customer: converted, tellerId, totalWaiting: count || 0 });
      io.emit('teller-update', { action: 'service-completed', tellerId, customer: converted });
    }

    res.json({ success: true, data: { customer: dbToFrontend(updatedCustomer), message: `Service completed` } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// SKIP CUSTOMER
router.post('/skip-customer', async (req, res) => {
  try {
    const { queueNumber, tellerId } = req.body;
    if (!queueNumber) return res.status(400).json({ success: false, message: 'Queue number required' });

    const { data: customer, error: fetchError } = await supabase.from('customers')
      .select('*').eq('queue_number', queueNumber).single();

    if (fetchError && fetchError.code === 'PGRST116') {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    if (fetchError) throw fetchError;

    if (customer.status !== 'processing' || customer.teller_id !== tellerId) {
      return res.status(400).json({ success: false, message: 'Customer is not being processed by this teller' });
    }

    const newSkipCount = (customer.skip_count || 0) + 1;

    if (newSkipCount >= 3) {
      const { data: expiredCustomer } = await supabase.from('customers').update({
        skip_count: newSkipCount,
        is_expired: true,
        status: 'completed',
        teller_id: null,
        skipped_at: new Date().toISOString()
      }).eq('id', customer.id).select().single();

      const io = req.app.get('io');
      if (io) {
        const converted = dbToFrontend(expiredCustomer);
        io.emit('customer-skipped', { customer: converted, tellerId, skipCount: newSkipCount, isExpired: true });
        io.emit('teller-update', { action: 'customer-expired', tellerId, customer: converted });
      }

      return res.json({
        success: true,
        data: { customer: dbToFrontend(expiredCustomer), isExpired: true, skipCount: newSkipCount, message: `Nomor antrian ${queueNumber} hangus` }
      });
    }

    // Move to back (Position #11)
    const today = getTodayDate();

    // Get the 10th waiting customer to determine insertion point
    const { data: tenthCustomerData } = await supabase.from('customers')
      .select('queue_order')
      .eq('date', today)
      .eq('is_expired', false)
      .eq('status', 'waiting')
      .order('queue_order', { ascending: true })
      .range(9, 9); // 0-based index 9 is the 10th item

    let newQueueOrder;

    if (tenthCustomerData && tenthCustomerData.length > 0) {
      // We have at least 10 people. We want to insert AFTER the 10th person.
      // So the new person becomes the 11th person.
      // Target Order = 10th.queue_order + 1
      const tenthCustomer = tenthCustomerData[0];
      const targetOrder = tenthCustomer.queue_order + 1;
      newQueueOrder = targetOrder;

      // Shift everyone who is currently at or after targetOrder
      const { data: toShift } = await supabase.from('customers')
        .select('id, queue_order')
        .eq('date', today)
        .eq('status', 'waiting')
        .gte('queue_order', targetOrder);

      if (toShift && toShift.length > 0) {
        // Update them one by one
        await Promise.all(toShift.map(c =>
          supabase.from('customers')
            .update({ queue_order: c.queue_order + 1 })
            .eq('id', c.id)
        ));
      }
    } else {
      // Less than 10 people. Move to very end.
      const { data: lastCustomer } = await supabase.from('customers')
        .select('queue_order')
        .eq('date', today)
        .order('queue_order', { ascending: false })
        .limit(1)
        .single();

      newQueueOrder = lastCustomer ? lastCustomer.queue_order + 1 : (customer.queue_order + 1);
    }

    const { data: updatedCustomer } = await supabase.from('customers').update({
      skip_count: newSkipCount,
      status: 'waiting',
      teller_id: null,
      queue_order: newQueueOrder,
      processing_start_time: null,
      skipped_at: new Date().toISOString()
    }).eq('id', customer.id).select().single();

    const io = req.app.get('io');
    if (io) {
      const converted = dbToFrontend(updatedCustomer);
      io.emit('customer-skipped', { customer: converted, tellerId, skipCount: newSkipCount, isExpired: false });
      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true })
        .eq('date', today).eq('status', 'waiting').eq('is_expired', false);
      io.emit('queue-update', { action: 'skipped', customer: converted, tellerId, totalWaiting: count || 0 });
      io.emit('teller-update', { action: 'customer-skipped', tellerId, customer: converted });
    }

    res.json({
      success: true,
      data: { customer: dbToFrontend(updatedCustomer), isExpired: false, skipCount: newSkipCount, message: `Skip ${newSkipCount}/3` }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// CREATE FAKE QUEUES
router.post('/create-fake-queues', async (req, res) => {
  try {
    let queueCounter = await ensureDailyReset();
    const fakeNames = ['Budi', 'Ani', 'Rudi', 'Siti', 'Joko', 'Mega'];
    const services = ['installment', 'newcredit', 'account', 'complaint', 'datachange', 'priority'];
    const createdCustomers = [];

    for (let i = 0; i < 3; i++) {
      const { data: updatedCounter } = await supabase.from('queue_counters')
        .update({ counter: queueCounter.counter + 1 }).eq('date', queueCounter.date).select().single();
      queueCounter = updatedCounter;

      const { data: customer } = await supabase.from('customers').insert({
        name: fakeNames[Math.floor(Math.random() * fakeNames.length)],
        phone: `08${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        service: services[Math.floor(Math.random() * services.length)],
        queue_number: generateQueueNumber(updatedCounter.counter),
        queue_order: updatedCounter.counter,
        date: getTodayDate(),
        status: 'waiting'
      }).select().single();

      createdCustomers.push(customer);
    }

    const io = req.app.get('io');
    if (io) {
      // Emit update for each new customer or just a general update
      // For simplicity, we can just emit queue-update once at the end or for each
      // Let's emit for each to be safe and consistent with single creation
      for (const customer of createdCustomers) {
        io.emit('new-queue', { customer: dbToFrontend(customer), message: `New queue created: ${customer.queue_number}` });
      }

      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true })
        .eq('date', getTodayDate()).eq('status', 'waiting');

      // Emit general update
      io.emit('queue-update', { action: 'bulk-created', customers: createdCustomers.map(dbToFrontend), totalWaiting: count || 0 });
    }

    res.status(201).json({
      success: true,
      data: {
        message: `Created 3 fake queues`,
        customers: createdCustomers.map(c => ({ queueNumber: c.queue_number, name: c.name }))
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET TELLER CURRENT
router.get('/teller/:tellerId/current', async (req, res) => {
  try {
    const { data: currentCustomer } = await supabase.from('customers')
      .select('*').eq('date', getTodayDate()).eq('teller_id', req.params.tellerId).eq('status', 'processing').single();
    res.json({ success: true, data: { currentCustomer: dbToFrontend(currentCustomer) } });
  } catch (error) {
    res.json({ success: true, data: { currentCustomer: null } });
  }
});

// GET NEXT CUSTOMERS
router.get('/teller/next-customers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || 5);
    const today = getTodayDate();

    const { data: nextCustomers } = await supabase.from('customers')
      .select('*').eq('date', today).eq('status', 'waiting').eq('is_expired', false)
      .order('queue_order').limit(limit);

    const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true })
      .eq('date', today).eq('status', 'waiting').eq('is_expired', false);

    res.json({ success: true, data: { nextCustomers: (nextCustomers || []).map(dbToFrontend), totalWaiting: count || 0 } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET STATS
router.get('/stats', async (req, res) => {
  try {
    const { data: customers } = await supabase.from('customers').select('status').eq('date', getTodayDate());
    const stats = { waiting: 0, processing: 0, completed: 0 };
    customers.forEach(c => stats[c.status] = (stats[c.status] || 0) + 1);
    res.json({ success: true, data: { total: customers.length, stats } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// RESET COUNTER
router.post('/reset-counter', async (req, res) => {
  try {
    const today = getTodayDate();
    const { data: counter } = await supabase.from('queue_counters').select('*').eq('date', today).single();

    if (counter) {
      await supabase.from('queue_counters').update({ counter: 0, last_reset: new Date().toISOString() }).eq('date', today);
    } else {
      await supabase.from('queue_counters').insert({ date: today, counter: 0, last_reset: new Date().toISOString() });
    }

    res.json({ success: true, data: { message: 'Counter reset' } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;