import React, { useState, useEffect } from 'react';
import { Ticket, Home, Monitor } from 'lucide-react';
import { API_BASE_URL, API_ENDPOINTS, SOCKET_URL, getApiUrl, getSocketUrl } from '../config/api';
import { io } from 'socket.io-client';
import './QueueSystem.css';

export default function QueueSystem() {
  const [activeTab, setActiveTab] = useState('home');
  const [currentScreen, setCurrentScreen] = useState('form');
  const [formData, setFormData] = useState({
    name: '',
    service: 'installment',
    phone: ''
  });
  const [queueNumber, setQueueNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [processingQueue, setProcessingQueue] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [ticketStatus, setTicketStatus] = useState('waiting');
  const [tellerId, setTellerId] = useState('');
  const [notification, setNotification] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [socket, setSocket] = useState(null);
  const [lastResetDate, setLastResetDate] = useState(null);
  const [currentApiUrl, setCurrentApiUrl] = useState(API_BASE_URL);
  const [currentSocketUrl, setCurrentSocketUrl] = useState(SOCKET_URL);
  const [customerData, setCustomerData] = useState(null);

  const services = [
    {
      id: 'installment',
      title: 'Pembayaran Angsuran',
      desc: 'Lakukan pembayaran angsuran kredit Anda.'
    },
    {
      id: 'newcredit',
      title: 'Pengajuan Kredit Baru',
      desc: 'Ajukan permohonan untuk kredit baru.'
    },
    {
      id: 'account',
      title: 'Informasi Akun / Saldo',
      desc: 'Dapatkan informasi terkait akun dan saldo Anda.'
    },
    {
      id: 'complaint',
      title: 'Keluhan / Komplain',
      desc: 'Sampaikan keluhan atau komplain Anda.'
    },
    {
      id: 'datachange',
      title: 'Perubahan Data Nasabah',
      desc: 'Ubah atau perbarui data diri Anda.'
    },
    {
      id: 'priority',
      title: 'Prioritas (Lansia/Hamil/Difabel)',
      desc: 'Layanan prioritas untuk lansia, ibu hamil, dan difabel.'
    }
  ];

  // Initialize URLs with fallback
  useEffect(() => {
    const initializeUrls = async () => {
      try {
        // Get dynamic URLs with fallback
        const apiUrl = await getApiUrl();
        const socketUrl = await getSocketUrl();

        setCurrentApiUrl(apiUrl);
        setCurrentSocketUrl(socketUrl);

        console.log('Using API URL:', apiUrl);
        console.log('Using Socket URL:', socketUrl);
      } catch (error) {
        console.error('Error initializing URLs:', error);
        // Fallback to default URLs
        setCurrentApiUrl(API_BASE_URL);
        setCurrentSocketUrl(SOCKET_URL);
      }
    };

    initializeUrls();
  }, []);

  // Initialize last reset date from localStorage
  useEffect(() => {
    const savedResetDate = localStorage.getItem('lastResetDate');
    if (savedResetDate) {
      setLastResetDate(new Date(savedResetDate));
    }
  }, []);

  // Check for active ticket on mount
  useEffect(() => {
    const checkActiveTicket = async () => {
      const activeTicket = localStorage.getItem('activeTicket');
      if (!activeTicket) return;

      try {
        const ticketData = JSON.parse(activeTicket);
        const ticketDate = new Date(ticketData.timestamp);
        const now = new Date();
        const hoursDiff = (now - ticketDate) / (1000 * 60 * 60);

        if (hoursDiff >= 24) {
          localStorage.removeItem('activeTicket');
          return;
        }

        // Wait for URLs to be initialized before checking ticket
        if (!currentApiUrl) return;

        try {
          const response = await fetch(`${currentApiUrl}${API_ENDPOINTS.CUSTOMERS.QUEUE}/${ticketData.queueNumber}`);
          const result = await response.json();

          if (result.success && result.data) {
            if (result.data.status === 'waiting' || result.data.status === 'processing') {
              setQueueNumber(ticketData.queueNumber);
              setFormData({
                name: ticketData.name,
                service: ticketData.service,
                phone: ticketData.phone || ''
              });
              setTicketStatus(result.data.status);
              setTellerId(result.data.tellerId || '');
              setCurrentScreen('queue');
              return;
            }
          }
          localStorage.removeItem('activeTicket');
        } catch (error) {
          // Only log errors in production mode
          if (!import.meta.env.DEV) {
            console.error('Error verifying ticket:', error);
          }
          setQueueNumber(ticketData.queueNumber);
          setFormData({
            name: ticketData.name,
            service: ticketData.service,
            phone: ticketData.phone || ''
          });
          setCurrentScreen('queue');
        }
      } catch (error) {
        console.error('Error parsing ticket:', error);
        localStorage.removeItem('activeTicket');
      }
    };

    checkActiveTicket();
  }, [currentApiUrl]);

  // Initialize Socket.IO
  useEffect(() => {
    if (!currentSocketUrl) return;

    const newSocket = io(currentSocketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server:', currentSocketUrl);
    });

    newSocket.on('connect_error', (error) => {
      // Only log errors in production mode to reduce console noise
      if (!import.meta.env.DEV) {
        console.log('Socket connection error:', error.message);
      }

      // Try to reconnect with fallback URL only in production mode
      if (!import.meta.env.DEV &&
        currentSocketUrl.includes('fin.kitapunya.web.id') &&
        currentSocketUrl !== 'https://fin.kitapunya.web.id') {
        console.log('Production socket failed, trying production fallback...');
        const fallbackUrl = 'https://fin.kitapunya.web.id';
        setCurrentSocketUrl(fallbackUrl);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, you need to reconnect manually
        newSocket.connect();
      }
    });

    return () => {
      newSocket.disconnect();
      newSocket.removeAllListeners();
    };
  }, [currentSocketUrl]);

  // Auto-hide notification
  useEffect(() => {
    if (showNotification && ticketStatus === 'processing') {
      const timer = setTimeout(() => setShowNotification(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [showNotification, ticketStatus]);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket || !queueNumber) return;

    const handleCustomerCalled = (data) => {
      if (data.customer?.queueNumber === queueNumber) {
        setTicketStatus('processing');
        setTellerId(data.tellerId || '');
        setNotification(`Nomor antrian ${queueNumber} sedang dipanggil ke ${data.tellerId || 'Loket'}!`);
        setShowNotification(true);

        // Play notification sound twice with delay
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi6Gy/DaiTkGGGS58+OZURE');

        // Play sound twice with 1 second delay
        audio.play().then(() => {
          setTimeout(() => {
            const audio2 = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi6Gy/DaiTkGGGS58+OZURE');
            audio2.play().catch(e => console.log('Could not play second sound:', e));
          }, 1000);
        }).catch(e => console.log('Could not play sound:', e));
      }
    };

    const handleServiceCompleted = (data) => {
      if (data.customer?.queueNumber === queueNumber) {
        setTicketStatus('completed');
        setNotification(`Layanan untuk nomor antrian ${queueNumber} telah selesai!`);
        setShowNotification(true);

        // Play completion sound (gentle chime)
        const completionAudio = new Audio('data:audio/wav;base64,UklGRhwGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YfgGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJOAgZaLvt559NFAxQp+PwtmMcBjiR1/LMeS0GJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi6Gy/DaiTkGGGS58+OZURE');
        completionAudio.play().catch(e => console.log('Could not play completion sound:', e));

        setTimeout(() => {
          localStorage.removeItem('activeTicket');
          setQueueNumber('');
          setFormData({ name: '', service: 'installment', phone: '' });
          setCurrentScreen('form');
          setTicketStatus('waiting');
          setTellerId('');
          setShowNotification(false);
          alert('Tiket Anda telah selesai diproses. Terima kasih!');
        }, 3000);
      }
    };

    socket.on('customer-called', handleCustomerCalled);
    socket.on('service-completed', handleServiceCompleted);

    return () => {
      socket.off('customer-called', handleCustomerCalled);
      socket.off('service-completed', handleServiceCompleted);
    };
  }, [socket, queueNumber]);

  // Periodic ticket status check
  useEffect(() => {
    if (currentScreen !== 'queue' || !queueNumber) return;

    const checkTicketStatus = async () => {
      try {
        const response = await fetch(`${currentApiUrl}${API_ENDPOINTS.CUSTOMERS.QUEUE}/${queueNumber}`);
        const result = await response.json();

        if (result.success && result.data) {
          // Save customer data including skip info
          setCustomerData(result.data);

          if (result.data.status === 'completed') {
            // Check if expired
            if (result.data.isExpired) {
              localStorage.removeItem('activeTicket');
              setQueueNumber('');
              setFormData({ name: '', service: 'installment', phone: '' });
              setCurrentScreen('form');
              setTicketStatus('waiting');
              setTellerId('');
              setCustomerData(null);
              alert('❌ Nomor antrian Anda telah HANGUS karena di-skip 3 kali.\n\nSilakan daftar ulang untuk mendapatkan nomor antrian baru.');
            } else {
              localStorage.removeItem('activeTicket');
              setQueueNumber('');
              setFormData({ name: '', service: 'installment', phone: '' });
              setCurrentScreen('form');
              setTicketStatus('waiting');
              setTellerId('');
              setCustomerData(null);
              alert('Tiket Anda telah selesai diproses. Silakan ambil tiket baru jika memerlukan layanan lain.');
            }
          } else if (result.data.status === 'processing') {
            setTicketStatus('processing');
            setTellerId(result.data.tellerId || '');
          }
        }
      } catch (error) {
        // Only log errors in production mode
        if (!import.meta.env.DEV) {
          console.error('Error checking ticket status:', error);
        }
      }
    };

    const interval = setInterval(checkTicketStatus, 10000);
    return () => clearInterval(interval);
  }, [currentScreen, queueNumber, currentApiUrl]);

  // Update time every second and check for midnight reset
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkMidnightReset();
    }, 1000);
    return () => clearInterval(timer);
  }, [lastResetDate]);

  // Fetch queue data for display
  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${currentApiUrl}${API_ENDPOINTS.CUSTOMERS.TODAY}`);
      const result = await response.json();

      if (result.success) {
        const customers = result.data;
        const waiting = customers
          .filter(c => c.status === 'waiting')
          .sort((a, b) => a.queueOrder - b.queueOrder);
        const processing = customers
          .filter(c => c.status === 'processing')
          .sort((a, b) => a.queueOrder - b.queueOrder);

        setWaitingQueue(waiting);
        setProcessingQueue(processing);
      }
    } catch (error) {
      // Only log errors in production mode
      if (!import.meta.env.DEV) {
        console.error('Error fetching queue data:', error);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'display') {
      fetchQueueData();
      const interval = setInterval(fetchQueueData, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, currentApiUrl]);

  // Function to save daily queue data to queuecounters
  const saveDailyQueueData = async () => {
    try {
      const response = await fetch(`${currentApiUrl}/api/customers/today`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Save to localStorage as queuecounters
        const queueCounters = JSON.parse(localStorage.getItem('queuecounters') || '{}');
        queueCounters[dateStr] = {
          date: dateStr,
          totalQueues: result.data.length,
          completedQueues: result.data.filter(c => c.status === 'completed').length,
          waitingQueues: result.data.filter(c => c.status === 'waiting').length,
          processingQueues: result.data.filter(c => c.status === 'processing').length,
          queues: result.data
        };

        localStorage.setItem('queuecounters', JSON.stringify(queueCounters));
        console.log(`Daily queue data saved for ${dateStr}:`, queueCounters[dateStr]);
      }
    } catch (error) {
      // Only log errors in production mode
      if (!import.meta.env.DEV) {
        console.error('Error saving daily queue data:', error);
      }
    }
  };

  // Function to reset queue system
  const resetQueueSystem = async () => {
    try {
      // Save current day's data before resetting
      await saveDailyQueueData();

      // Call API to reset queue counter
      const response = await fetch(`${currentApiUrl}${API_ENDPOINTS.CUSTOMERS.RESET_COUNTER}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      if (result.success) {
        console.log('Queue system reset successfully');
        const resetDate = new Date();
        setLastResetDate(resetDate);

        // Save reset date to localStorage
        localStorage.setItem('lastResetDate', resetDate.toISOString());

        // Reset any active tickets
        localStorage.removeItem('activeTicket');

        // Reset local state
        handleReset();
      } else {
        if (!import.meta.env.DEV) {
          console.error('Failed to reset queue system:', result.message);
        }
      }
    } catch (error) {
      // Only log errors in production mode
      if (!import.meta.env.DEV) {
        console.error('Error resetting queue system:', error);
      }
    }
  };

  // Check for midnight reset
  const checkMidnightReset = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDate = now.toDateString();

    // Check if it's midnight (00:00) and we haven't reset today
    if (currentHour === 0 && currentMinute === 0) {
      if (!lastResetDate || lastResetDate.toDateString() !== currentDate) {
        console.log('Midnight detected, resetting queue system...');
        resetQueueSystem();
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('Mohon isi nama lengkap');
      return;
    }

    if (!formData.service) {
      alert('Silakan pilih layanan');
      return;
    }

    try {
      const response = await fetch(`${currentApiUrl}${API_ENDPOINTS.CUSTOMERS.TODAY}`);
      const result = await response.json();

      if (result.success && result.data) {
        const currentQueueCount = result.data.filter(
          c => c.status === 'waiting' || c.status === 'processing'
        ).length;

        if (currentQueueCount >= 100) {
          alert('⚠️ Sistem Antrian Penuh\n\nAntrian sudah mencapai batas maksimal (100 orang).\nSilakan coba lagi besok atau hubungi administrator.');
          return;
        }
      }
    } catch (error) {
      // Only log errors in production mode
      if (!import.meta.env.DEV) {
        console.error('Error checking queue count:', error);
      }
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${currentApiUrl}${API_ENDPOINTS.CUSTOMERS.QUEUE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone ? formData.phone.trim() : '',
          service: formData.service
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.message || result.error || `Server error (${response.status})`;
        console.error('Server Error:', {
          status: response.status,
          message: errorMsg,
          fullResponse: result
        });

        if (response.status === 500) {
          if (errorMsg.includes('Unable to generate unique queue number')) {
            alert('⚠️ Sistem Antrian Penuh\n\nSemua nomor antrian hari ini sudah terpakai.\n\nSilakan hubungi administrator untuk reset sistem atau coba lagi besok.');
          } else {
            alert('❌ Server sedang bermasalah\n' + errorMsg + '\n\nSilakan coba lagi atau hubungi administrator');
          }
        } else if (response.status === 400) {
          alert('⚠️ Data tidak valid\n' + errorMsg);
        } else {
          alert('❌ Terjadi kesalahan\n' + errorMsg);
        }
        return;
      }

      if (result.success && result.data?.queueNumber) {
        setQueueNumber(result.data.queueNumber);

        const ticketData = {
          queueNumber: result.data.queueNumber,
          name: formData.name.trim(),
          service: formData.service,
          phone: formData.phone ? formData.phone.trim() : '',
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('activeTicket', JSON.stringify(ticketData));
        setCurrentScreen('queue');
      } else {
        alert('Gagal mendapatkan nomor antrian\n' + (result.message || 'Format response tidak sesuai'));
      }
    } catch (error) {
      // Only log detailed errors in production mode
      if (!import.meta.env.DEV) {
        console.error('Error:', error);
      }

      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        alert('❌ Tidak bisa terhubung ke server\n\nPeriksa:\n- Koneksi internet\n- Server sudah berjalan\n- URL API sudah benar');
      } else if (error instanceof SyntaxError) {
        alert('❌ Server mengirim response yang tidak valid\n\nResponse bukan format JSON yang benar');
      } else {
        alert('❌ Terjadi kesalahan yang tidak terduga\n' + error.message + '\n\nSilakan coba lagi');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem('activeTicket');
    setCurrentScreen('form');
    setFormData({ name: '', service: 'installment', phone: '' });
    setQueueNumber('');
    setTicketStatus('waiting');
    setTellerId('');
    setShowNotification(false);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getServiceName = (serviceId) => {
    const serviceMap = {
      'installment': 'Bayar Angsuran',
      'newcredit': 'Ajukan Kredit',
      'account': 'Cek Saldo',
      'complaint': 'Keluhan',
      'datachange': 'Ubah Data',
      'priority': 'Lainnya'
    };
    return serviceMap[serviceId] || serviceId;
  };

  const BottomNav = () => (
    <div className="bottom-nav">
      <div
        className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => setActiveTab('home')}
      >
        <Home size={24} color={activeTab === 'home' ? '#1E3A8A' : '#6B7280'} />
        <span className="nav-label">Home</span>
      </div>
      <div
        className={`nav-item ${activeTab === 'display' ? 'active' : ''}`}
        onClick={() => setActiveTab('display')}
      >
        <Monitor size={24} color={activeTab === 'display' ? '#1E3A8A' : '#6B7280'} />
        <span className="nav-label">Display</span>
      </div>
    </div>
  );

  // DISPLAY TAB
  if (activeTab === 'display') {
    return (
      <div className="display-wrapper">
        <div className="display-header-mobile">
          <div className="display-title-mobile">
            <h2>Status Antrian</h2>
            <div className="display-time-mobile">{formatTime(currentTime)}</div>
          </div>
        </div>

        <div className="display-content-mobile">
          <div className="display-section">
            <h3 className="section-title">Sedang Dilayani</h3>
            <div className="processing-list">
              {processingQueue.length > 0 ? (
                processingQueue.map((customer) => (
                  <div key={customer._id} className="processing-card">
                    <div className="processing-header">
                      <div className="processing-number">{customer.queueNumber}</div>
                      <div className="processing-teller">Loket {customer.tellerId || '?'}</div>
                    </div>
                    <div className="processing-info">
                      <div className="processing-name">{customer.name}</div>
                      <div className="processing-service">{getServiceName(customer.service)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">Belum ada yang dilayani</div>
              )}
            </div>
          </div>

          <div className="display-section">
            <h3 className="section-title">
              Menunggu <span className="count-badge">{waitingQueue.length}</span>
            </h3>
            <div className="waiting-list-mobile">
              {waitingQueue.slice(0, 15).map((customer) => (
                <div key={customer._id} className="waiting-card-mobile">
                  <div className="waiting-number-mobile">{customer.queueNumber}</div>
                  <div className="waiting-info-mobile">
                    <div className="waiting-name-mobile">{customer.name}</div>
                    <div className="waiting-service-mobile">{getServiceName(customer.service)}</div>
                  </div>
                </div>
              ))}
              {waitingQueue.length === 0 && (
                <div className="empty-state">Tidak ada yang menunggu</div>
              )}
            </div>
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  // QUEUE TICKET SCREEN
  if (currentScreen === 'queue') {
    return (
      <div className="queue-screen">
        <div className="queue-content-centered">
          <div className="ticket-icon-large">
            <Ticket size={48} color="#1E3A8A" strokeWidth={2} />
          </div>

          <h1 className="queue-welcome-large">Halo, {formData.name.split(' ')[0]}</h1>
          <p className="queue-info-large">Nomor antrian Anda sudah siap. Silakan tunggu giliran Anda.</p>

          <div className="queue-card-large">
            <div className="queue-reason-centered">
              <p className="queue-reason-label-gray">Keperluan Kunjungan</p>
              <h2 className="queue-reason-title-large">
                {services.find(s => s.id === formData.service)?.title}
              </h2>
            </div>

            <div className="divider-dashed"></div>

            <div className="queue-number-container-clean">
              <div className="queue-system-number-blue">
                {queueNumber}
                {customerData?.skipCount > 0 && (
                  <span className={`skip-badge-queue ${customerData.skipCount >= 2 ? 'warning' : ''}`}>
                    Skip: {customerData.skipCount}/3
                  </span>
                )}
              </div>
            </div>

            {customerData?.skipCount >= 2 && (
              <div className="skip-warning-queue">
                ⚠️ PERINGATAN: Nomor antrian Anda sudah di-skip {customerData.skipCount}x.
                {customerData.skipCount === 2 ? 'Jika di-skip 1x lagi, nomor antrian akan HANGUS!' : 'Nomor antrian akan HANGUS jika tidak datang!'}
              </div>
            )}

            <div className={`queue-status-section status-${ticketStatus}`}>
              <div className="status-content">
                <div className="status-text">
                  {ticketStatus === 'waiting' && (
                    <>Menunggu Giliran</>
                  )}
                  {ticketStatus === 'processing' && (
                    <>Sedang Diproses - {tellerId ? `Loket ${tellerId}` : 'Loket'}</>
                  )}
                  {ticketStatus === 'completed' && (
                    <>Selesai</>
                  )}
                </div>
                <div className={`status-dot ${ticketStatus}`}></div>
              </div>

              {ticketStatus === 'waiting' && (
                <div className="waiting-indicator">
                  <span className="waiting-icon">⏱️</span>
                  Sedang menunggu giliran Anda
                  {customerData?.skipCount > 0 && customerData.skipCount < 2 && (
                    <div className="skip-info-small">
                      (Sudah di-skip {customerData.skipCount}x)
                    </div>
                  )}
                </div>
              )}

              {ticketStatus === 'processing' && (
                <div className="processing-indicator">
                  Silakan siap-siap menuju loket
                </div>
              )}
            </div>
          </div>

          {showNotification && (
            <div className={`notification-box ${ticketStatus}`}>
              <div className="notification-icon">
                {ticketStatus === 'completed' ? '✅' : '🔔'}
              </div>
              <div className="notification-content">
                <div className="notification-title">
                  {ticketStatus === 'completed' ? (
                    <>Layanan Selesai!</>
                  ) : (
                    <>Sedang Dipanggil!</>
                  )}
                </div>
                <div className="notification-message">{notification}</div>
                {ticketStatus === 'processing' && (
                  <div className="notification-subtitle">Silakan menuju loket sekarang</div>
                )}
              </div>
              {ticketStatus === 'processing' && <div className="notification-shimmer" />}
            </div>
          )}

          <div className="info-box">
            <p>
              <strong>Info:</strong> Halaman ini akan otomatis update saat antrian Anda dipanggil.
              <br />
              <span className="info-subtitle">
                Refresh browser tidak akan mempengaruhi tiket Anda yang aktif.
              </span>
            </p>
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  // FORM SCREEN
  return (
    <div className="queue-container">
      <div className="queue-form-wrapper-full">
        <h1 className="queue-title-large">Daftar Antrian</h1>
        <p className="queue-description-gray">
          Pilih layanan dan isi data diri Anda untuk mendapatkan nomor antrian.
        </p>

        <div className="form-content">
          <div className="form-group">
            <label className="form-label-dark">Nama Lengkap</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Masukkan nama lengkap Anda"
              className="form-input-clean"
            />
          </div>

          <div className="form-group">
            <label className="form-label-dark">Pilih Layanan</label>
            <div>
              {services.map((service) => (
                <label
                  key={service.id}
                  className={`service-option-clean ${formData.service === service.id ? 'selected' : ''}`}
                >
                  <div className="service-content-spaced">
                    <div className="service-info-full">
                      <div className="service-title-bold">{service.title}</div>
                      <div className="service-desc-gray">{service.desc}</div>
                    </div>
                    <input
                      type="radio"
                      name="service"
                      value={service.id}
                      checked={formData.service === service.id}
                      onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                      className="service-radio-blue"
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label-dark">
              Nomor Telepon <span className="optional-text">(Opsional)</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Contoh: 081234567890"
              className="form-input-clean"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!formData.name.trim() || !formData.service || isLoading}
            className="submit-btn-blue"
          >
            {isLoading ? 'Memproses...' : 'Ambil Nomor Antrian'}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}