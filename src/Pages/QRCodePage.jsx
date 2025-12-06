import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

export default function QRCodePage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [totalVisitors, setTotalVisitors] = useState(0);
  const [maxCapacity] = useState(100);

  // Update waktu setiap detik
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch data antrian
  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CUSTOMERS.TODAY}`);
      const result = await response.json();

      if (result.success) {
        const customers = result.data;

        // Filter hanya yang waiting
        const waiting = customers
          .filter(c => c.status === 'waiting')
          .sort((a, b) => a.queueOrder - b.queueOrder);

        setWaitingQueue(waiting);

        // Total pengunjung yang sedang ada di dalam kantor (waiting + processing)
        const activeVisitors = customers.filter(c =>
          c.status === 'waiting' || c.status === 'processing'
        ).length;
        setTotalVisitors(activeVisitors);
      }
    } catch (error) {
      console.error('Error fetching queue data:', error);
      // Set dummy data untuk demo
      setWaitingQueue([
        { _id: '1', queueNumber: 'A001', name: 'Ahmad Ridwan' },
        { _id: '2', queueNumber: 'A002', name: 'Siti Nurhaliza' },
        { _id: '3', queueNumber: 'A003', name: 'Budi Santoso' },
        { _id: '4', queueNumber: 'A004', name: 'Dewi Lestari' },
        { _id: '5', queueNumber: 'A005', name: 'Eko Prasetyo' }
      ]);
      setTotalVisitors(5);
    }
  };

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchQueueData();
    const interval = setInterval(fetchQueueData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Format waktu
  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format tanggal
  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <h1 style={styles.title}>REGISTRASI ANTRIAN</h1>
          <h2 style={styles.subtitle}>Kantor Finance</h2>
        </div>
        <div style={styles.timeSection}>
          <div style={styles.time}>{formatTime(currentTime)}</div>
          <div style={styles.date}>{formatDate(currentTime)}</div>
        </div>
      </div>

      {/* Main Content - Grid Layout */}
      <div style={styles.mainContent}>
        {/* Left Grid - QR Code Section */}
        <div style={styles.qrSection}>
          <div style={styles.qrCard}>
            {/* Instruction */}
            <div style={styles.instructionBox}>
              <h3 style={styles.instructionTitle}>Ambil Nomor Antrian</h3>
            </div>

            {/* QR Code */}
            <div style={styles.qrCodeWrapper}>
              <div style={styles.qrCodeContainer}>
                <QRCodeSVG
                  value="https://finance.kitapunya.web.id"
                  size={280}
                  level="H"
                  includeMargin={true}
                  style={styles.qrCode}
                />
              </div>
              <div style={styles.urlText}>Pindai</div>
            </div>

            {/* Visitor Counter */}
            <div style={styles.counterBox}>
              <div style={styles.counterLabel}>Pengunjung Di Dalam Kantor</div>
              <div style={styles.counterDisplay}>
                <span style={styles.counterCurrent}>
                  {String(totalVisitors).padStart(3, '0')}
                </span>
                <span style={styles.counterSeparator}>/</span>
                <span style={styles.counterMax}>{maxCapacity}</span>
              </div>
              <div style={styles.capacityBar}>
                <div 
                  style={{
                    ...styles.capacityFill,
                    width: `${(totalVisitors / maxCapacity) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Grid - Waiting Queue */}
        <div style={styles.waitingSection}>
          <div style={styles.waitingCard}>
            <div style={styles.waitingHeader}>
              <h3 style={styles.waitingTitle}>DAFTAR PENGUNJUNG</h3>
              <div style={styles.waitingCount}>
                {waitingQueue.length} Orang
              </div>
            </div>

            <div style={styles.waitingList}>
              {waitingQueue.length > 0 ? (
                waitingQueue.map((customer, index) => (
                  <div 
                    key={customer._id} 
                    style={{
                      ...styles.waitingItem,
                      animationDelay: `${index * 0.1}s`
                    }}
                  >
                    <div style={styles.queueNumber}>{customer.queueNumber}</div>
                    <div style={styles.customerName}>{customer.name}</div>
                  </div>
                ))
              ) : (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>✓</div>
                  <div style={styles.emptyText}>Tidak ada antrian</div>
                  <div style={styles.emptySubtext}>Silakan scan QR Code untuk mengambil nomor</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerMessage}>
          Pastikan koneksi internet Anda stabil saat melakukan scan
        </div>
        <div style={styles.footerStatus}>
          <span style={styles.statusDot}></span>
          Sistem Aktif
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#F9FAFB',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem'
  },
  header: {
    background: 'white',
    borderRadius: '1rem',
    padding: '2rem',
    marginBottom: '2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E5E7EB'
  },
  titleSection: {
    display: 'flex',
    flexDirection: 'column'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#1E3A8A',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '2px'
  },
  subtitle: {
    fontSize: '1.2rem',
    fontWeight: '600',
    color: '#6B7280',
    margin: '0.25rem 0 0 0',
    textTransform: 'uppercase'
  },
  timeSection: {
    textAlign: 'right'
  },
  time: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#1E3A8A',
    fontFamily: '"SF Pro Display", -apple-system, sans-serif'
  },
  date: {
    fontSize: '1rem',
    color: '#6B7280',
    marginTop: '0.25rem',
    fontWeight: '500'
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
    flex: 1,
    marginBottom: '2rem'
  },
  qrSection: {
    display: 'flex',
    flexDirection: 'column'
  },
  qrCard: {
    background: 'white',
    borderRadius: '1rem',
    padding: '2.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%'
  },
  instructionBox: {
    textAlign: 'center',
    marginBottom: '2rem'
  },
  scanIcon: {
    fontSize: '3rem',
    marginBottom: '1rem'
  },
  instructionTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1E3A8A',
    margin: '0 0 1rem 0',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  },
  instructionText: {
    fontSize: '1.1rem',
    color: '#6B7280',
    lineHeight: '1.6',
    margin: 0,
    fontWeight: '500'
  },
  qrCodeWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '2rem'
  },
  qrCodeContainer: {
    background: 'white',
    padding: '1.5rem',
    borderRadius: '1rem',
    border: '3px solid #1E3A8A',
    boxShadow: '0 4px 12px rgba(30, 58, 138, 0.15)',
    marginBottom: '1rem'
  },
  qrCode: {
    display: 'block'
  },
  urlText: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#1E3A8A',
    fontFamily: 'monospace',
    background: '#EFF6FF',
    padding: '0.5rem 1.5rem',
    borderRadius: '0.5rem'
  },
  counterBox: {
    width: '100%',
    background: '#EFF6FF',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '2px solid #DBEAFE',
    textAlign: 'center'
  },
  counterLabel: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '1rem'
  },
  counterDisplay: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    gap: '0.5rem',
    marginBottom: '1rem'
  },
  counterCurrent: {
    fontSize: '3rem',
    fontWeight: '800',
    color: '#1E3A8A',
    fontFamily: '"SF Pro Display", -apple-system, sans-serif'
  },
  counterSeparator: {
    fontSize: '2rem',
    fontWeight: '600',
    color: '#6B7280'
  },
  counterMax: {
    fontSize: '2rem',
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: '"SF Pro Display", -apple-system, sans-serif'
  },
  capacityBar: {
    width: '100%',
    height: '8px',
    background: '#DBEAFE',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  capacityFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #1E3A8A, #3B82F6)',
    borderRadius: '4px',
    transition: 'width 0.5s ease'
  },
  waitingSection: {
    display: 'flex',
    flexDirection: 'column'
  },
  waitingCard: {
    background: 'white',
    borderRadius: '1rem',
    padding: '2rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  waitingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #E5E7EB'
  },
  waitingTitle: {
    fontSize: '1.3rem',
    fontWeight: '700',
    color: '#1E3A8A',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '1px'
  },
  waitingCount: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1E3A8A',
    background: '#EFF6FF',
    padding: '0.5rem 1rem',
    borderRadius: '2rem'
  },
  waitingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    flex: 1,
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 400px)'
  },
  waitingItem: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '0.75rem',
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    animation: 'slideIn 0.3s ease forwards',
    opacity: 0
  },
  queueNumber: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1E3A8A',
    fontFamily: '"SF Pro Display", -apple-system, sans-serif',
    background: '#DBEAFE',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    minWidth: '4rem',
    textAlign: 'center'
  },
  customerName: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#111827',
    flex: 1
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
    opacity: 0.5
  },
  emptyText: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: '0.5rem'
  },
  emptySubtext: {
    fontSize: '1rem',
    color: '#9CA3AF'
  },
  footer: {
    background: 'white',
    borderRadius: '1rem',
    padding: '1.5rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E5E7EB'
  },
  footerMessage: {
    fontSize: '1rem',
    fontWeight: '500',
    color: '#111827'
  },
  footerStatus: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#1E3A8A',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#1E3A8A',
    animation: 'blink 2s infinite'
  }
};

// Add keyframes for animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.3; }
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  .waitingItem:hover {
    border-color: #1E3A8A !important;
    background: #EFF6FF !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(30, 58, 138, 0.15);
  }
`;
document.head.appendChild(styleSheet);