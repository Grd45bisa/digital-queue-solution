import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_ENDPOINTS, apiCall, SOCKET_URL } from '../config/api';
import './Teller.css';

export default function Teller() {
  const [tellerId, setTellerId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [nextCustomers, setNextCustomers] = useState([]);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const socketRef = useRef(null);

  // Restore session
  useEffect(() => {
    const saved = localStorage.getItem('tellerId');
    if (saved) {
      setTellerId(saved);
      setIsLoggedIn(true);
    }
  }, []);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Data Fetching & Socket
  useEffect(() => {
    if (!isLoggedIn || !tellerId) return;

    localStorage.setItem('tellerId', tellerId);

    const fetchData = async () => {
      try {
        setLoading(true);
        // Get current customer for this teller
        const currentRes = await apiCall(API_ENDPOINTS.CUSTOMERS.TELLER_CURRENT.replace(':tellerId', tellerId));
        if (currentRes.success && currentRes.data.currentCustomer) {
          setCurrentCustomer(currentRes.data.currentCustomer);
        } else {
          setCurrentCustomer(null);
        }

        // Get next customers
        const nextRes = await apiCall(`${API_ENDPOINTS.CUSTOMERS.NEXT_CUSTOMERS}?limit=100`);
        if (nextRes.success) {
          setNextCustomers(nextRes.data.nextCustomers);
          setTotalWaiting(nextRes.data.totalWaiting);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // Don't alert on 404 for current customer, just set null
        if (!error.message.includes('404')) {
          // alert('Gagal memuat data antrian');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Socket Connection
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to socket server');
      socketRef.current.emit('join-teller', tellerId);
    });

    socketRef.current.on('queue-update', (data) => {
      // Refresh next customers list when queue changes
      fetchData();
    });

    socketRef.current.on('new-queue', () => {
      // Also refresh on new queue specifically
      fetchData();
    });

    socketRef.current.on('teller-update', (data) => {
      if (data.tellerId === tellerId) {
        if (data.action === 'customer-called') {
          setCurrentCustomer(data.customer);
        } else if (data.action === 'service-completed' || data.action === 'customer-expired') {
          setCurrentCustomer(null);
        } else if (data.action === 'customer-skipped') {
          setCurrentCustomer(null);
        }
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [isLoggedIn, tellerId]);

  const services = {
    installment: 'Pembayaran Angsuran',
    newcredit: 'Pengajuan Kredit Baru',
    account: 'Informasi Akun',
    complaint: 'Keluhan',
    datachange: 'Perubahan Data',
    priority: 'Lainnya'
  };

  const handleLogin = () => {
    if (tellerId.trim()) setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setTellerId('');
    setCurrentCustomer(null);
    setNextCustomers([]);
    localStorage.removeItem('tellerId');
    if (socketRef.current) socketRef.current.disconnect();
  };

  const handleCallNext = async () => {
    try {
      setLoading(true);
      const res = await apiCall(API_ENDPOINTS.CUSTOMERS.CALL_NEXT, {
        method: 'POST',
        body: JSON.stringify({ tellerId })
      });

      if (res.success) {
        setCurrentCustomer(res.data.customer);
        // Socket will update the list
      }
    } catch (error) {
      console.error('Error calling next:', error);
      alert('Gagal memanggil antrian: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!currentCustomer) return;

    const newSkipCount = (currentCustomer.skipCount || 0) + 1;
    const isExpired = newSkipCount >= 3;
    const message = isExpired
      ? `Nomor antrian ${currentCustomer.queueNumber} akan HANGUS. Lanjutkan?`
      : `Skip nasabah ${currentCustomer.queueNumber}?\nSkip: ${newSkipCount}/3`;

    if (confirm(message)) {
      try {
        setLoading(true);
        const res = await apiCall(API_ENDPOINTS.CUSTOMERS.SKIP_CUSTOMER, {
          method: 'POST',
          body: JSON.stringify({
            queueNumber: currentCustomer.queueNumber,
            tellerId
          })
        });

        if (res.success) {
          if (res.data.isExpired) {
            alert('Nomor antrian hangus!');
          }
          setCurrentCustomer(null);
        }
      } catch (error) {
        console.error('Error skipping customer:', error);
        alert('Gagal skip nasabah');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleComplete = async () => {
    if (!currentCustomer) return;

    if (confirm('Selesaikan layanan?')) {
      try {
        setLoading(true);
        const res = await apiCall(API_ENDPOINTS.CUSTOMERS.COMPLETE_SERVICE, {
          method: 'POST',
          body: JSON.stringify({
            queueNumber: currentCustomer.queueNumber,
            tellerId
          })
        });

        if (res.success) {
          setCurrentCustomer(null);
        }
      } catch (error) {
        console.error('Error completing service:', error);
        alert('Gagal menyelesaikan layanan');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFakeQueue = async () => {
    try {
      setLoading(true);
      await apiCall(API_ENDPOINTS.CUSTOMERS.CREATE_FAKE_QUEUES, {
        method: 'POST'
      });
      // Socket will trigger refresh
    } catch (error) {
      console.error('Error creating fake queues:', error);
      alert('Gagal membuat antrian dummy');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="teller-login-screen">
        <div className="login-box">
          <h1 className="login-title">Login Teller</h1>
          <p className="login-desc">Masukkan ID Teller untuk melanjutkan</p>
          <input
            type="text"
            value={tellerId}
            onChange={(e) => setTellerId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="ID Teller (T01, T02, dst)"
            className="login-input"
          />
          <button
            onClick={handleLogin}
            disabled={!tellerId.trim()}
            className="login-button"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="teller-app">
      {/* Header */}
      <header className="teller-app-header">
        <div className="header-container">
          <div className="header-main">
            <div className="header-info">
              <h1 className="loket-title">Loket {tellerId}</h1>
              <p className="loket-subtitle">Teller Dashboard</p>
            </div>
            <div className="header-actions">
              <div className="time-display">
                <div className="time-text">
                  {currentTime.toLocaleTimeString('id-ID')}
                </div>
                <div className="date-text">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
              </div>
              <button onClick={handleFakeQueue} className="btn-test">
                + Test
              </button>
              <button onClick={handleLogout} className="btn-logout">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="teller-main">
        <div className="content-grid">
          {/* Current Customer */}
          <section className="current-section">
            <h2 className="section-title">Nasabah Saat Ini</h2>

            {currentCustomer ? (
              <div className="current-content">
                <div className="customer-card">
                  <div className="customer-card-header">
                    <div className="queue-display">
                      <div className="queue-number-big">
                        {currentCustomer.queueNumber}
                      </div>
                      {currentCustomer.skipCount > 0 && (
                        <span className={`skip-indicator ${currentCustomer.skipCount >= 2 ? 'danger' : ''}`}>
                          Skip {currentCustomer.skipCount}/3
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="customer-details">
                    <h3 className="customer-name-large">{currentCustomer.name}</h3>
                    <p className="customer-service-text">{services[currentCustomer.service] || currentCustomer.service}</p>
                  </div>
                </div>

                {currentCustomer.skipCount >= 2 && (
                  <div className="warning-box">
                    <p>⚠️ PERINGATAN: 1x skip lagi nomor antrian akan HANGUS!</p>
                  </div>
                )}

                <div className="action-buttons">
                  <button
                    onClick={handleSkip}
                    disabled={loading}
                    className="btn-skip"
                  >
                    Skip Nasabah
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={loading}
                    className="btn-complete"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-customer">
                <div className="empty-icon">
                  <svg width="80" height="80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p>Tidak ada nasabah yang dilayani</p>
                </div>
                <button
                  onClick={handleCallNext}
                  disabled={loading || nextCustomers.length === 0}
                  className="btn-call-main"
                >
                  {loading ? 'Memanggil...' : 'Panggil Nasabah'}
                </button>
              </div>
            )}
          </section>

          {/* Next Customers */}
          <section className="queue-section">
            <div className="queue-header">
              <h2 className="section-title">Antrian Berikutnya</h2>
              <div className="total-badge">
                <span className="total-label">Total: </span>
                <span className="total-number">{totalWaiting}</span>
              </div>
            </div>

            <div className="queue-list">
              {nextCustomers.length > 0 ? (
                nextCustomers.map((customer, idx) => (
                  <div key={customer._id} className="queue-item">
                    <div className="queue-number-box">
                      <div className="queue-number-small">
                        {customer.queueNumber}
                      </div>
                    </div>
                    <div className="queue-info">
                      <h3 className="queue-name">{customer.name}</h3>
                      <p className="queue-service">{services[customer.service] || customer.service}</p>
                    </div>
                    <div className="queue-position">#{idx + 1}</div>
                  </div>
                ))
              ) : (
                <div className="empty-queue">
                  <div className="empty-queue-icon">
                    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>Tidak ada antrian</p>
                  </div>
                </div>
              )}
            </div>

            {nextCustomers.length > 0 && !currentCustomer && (
              <button
                onClick={handleCallNext}
                disabled={loading}
                className="btn-call-bottom"
              >
                {loading ? 'Memanggil...' : 'Panggil Nasabah'}
              </button>
            )}
          </section>
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-info">
            <div className="status-dot"></div>
            <span className="status-text">Sistem Online</span>
            <span className="status-realtime">📡 Real-Time Aktif</span>
          </div>
          <div className="status-queue">
            <span className="status-label">Antrian Menunggu:</span> {nextCustomers.length}
          </div>
        </div>
      </main>
    </div>
  );
}