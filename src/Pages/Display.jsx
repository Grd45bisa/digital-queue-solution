import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import './Display.css';

export default function Display() {
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [processingQueue, setProcessingQueue] = useState([]);
  const [currentServices, setCurrentServices] = useState([]); // Multiple tellers
  const [nextCall, setNextCall] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [socket, setSocket] = useState(null);
  const audioContextRef = useRef(null);

  // Update waktu setiap detik
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    // Initialize Socket.IO
    const initSocket = () => {
      const newSocket = io(API_BASE_URL);
      setSocket(newSocket);

      // Join display room
      newSocket.emit('join-display');

      // Listen for real-time updates
      newSocket.on('customer-called', (data) => {
        console.log('Customer called:', data);
        speakQueueNumber(data.customer.queueNumber, data.tellerId);
        fetchQueueData();
      });

      newSocket.on('service-completed', (data) => {
        console.log('Service completed:', data);
        fetchQueueData();
      });

      newSocket.on('queue-update', (data) => {
        console.log('Queue update:', data);
        fetchQueueData();
      });

      return () => {
        newSocket.close();
      };
    };

    // Load Socket.IO dynamically
    const loadSocketIO = () => {
      if (typeof io !== 'undefined') {
        initSocket();
      } else {
        // Load Socket.IO from CDN if not available
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
        script.onload = initSocket;
        document.head.appendChild(script);
      }
    };

    loadSocketIO();
  }, []);

  // Initialize AudioContext for TTS
  useEffect(() => {
    // Initialize audio context on user interaction
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
    };

    // Initialize on first user interaction
    document.addEventListener('click', initAudio, { once: true });

    return () => {
      document.removeEventListener('click', initAudio);
    };
  }, []);

  // TTS function
  const speakQueueNumber = (queueNumber, tellerId) => {
    if (!('speechSynthesis' in window)) {
      console.log('Speech synthesis not supported');
      return;
    }

    const utterance = new SpeechSynthesisUtterance();
    utterance.text = `Nomor ${queueNumber.replace('A', 'A - ')}, silakan ke loket ${tellerId}`;
    utterance.lang = 'id-ID';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to use Indonesian female voice
    const voices = speechSynthesis.getVoices();
    const indonesianVoice = voices.find(voice =>
      voice.lang.startsWith('id') && voice.name.includes('Female')
    ) || voices.find(voice => voice.lang.startsWith('id'));

    if (indonesianVoice) {
      utterance.voice = indonesianVoice;
    }

    speechSynthesis.speak(utterance);
  };

  // Fetch data antrian
  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CUSTOMERS.TODAY}`);
      const result = await response.json();

      if (result.success) {
        const customers = result.data;

        // Filter berdasarkan status
        const waiting = customers.filter(c => c.status === 'waiting').sort((a, b) => a.queueOrder - b.queueOrder);
        const processing = customers.filter(c => c.status === 'processing').sort((a, b) => a.queueOrder - b.queueOrder);

        setWaitingQueue(waiting);
        setProcessingQueue(processing);

        // Set current services (multiple tellers)
        setCurrentServices(processing);

        // Set panggilan berikutnya
        if (waiting.length > 0) {
          setNextCall(waiting[0]);
        } else {
          setNextCall(null);
        }
      }
    } catch (error) {
      console.error('Error fetching queue data:', error);
    }
  };

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchQueueData();

    // Refresh data setiap 5 detik sebagai fallback
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

  const getServiceName = (serviceId) => {
    const services = {
      'installment': 'Bayar Angsuran',
      'newcredit': 'Ajukan Kredit',
      'account': 'Cek Saldo',
      'complaint': 'Keluhan',
      'datachange': 'Ubah Data',
      'priority': 'Lainnya'
    };
    return services[serviceId] || serviceId;
  };

  return (
    <div className="display-container">
      {/* Header - Sederhana */}
      <div className="display-header">
        <div className="display-title">
          <h1>ANTRIAN</h1>
          <h2>Kantor Finance</h2>
        </div>
        <div className="display-time">
          <div className="time">{formatTime(currentTime)}</div>
          <div className="date">{formatDate(currentTime)}</div>
        </div>
      </div>

      {/* Area Utama - Multiple Tellers Grid */}
      <div className="display-main">
        {/* Sekarang Dilayani - Grid untuk Multiple Tellers */}
        <div className="current-services-grid">
          <div className="current-label">
            SEDANG DILAYANI
          </div>

          <div className="tellers-grid">
            {currentServices.length > 0 ? (
              currentServices.map((service) => (
                <div key={service._id} className="teller-service-card">
                  <div className="teller-id">Loket {service.tellerId || 'Teller'}</div>
                  <div className="current-number">
                    {service.queueNumber}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-service-message">
                <div className="current-empty">
                  BELUM ADA
                </div>
                <div className="empty-subtitle">Tidak ada layanan sedang berlangsung</div>
              </div>
            )}
          </div>
        </div>

        {/* Berikutnya */}
        <div className="next-service">
          <div className="next-label">
            BERIKUTNYA
          </div>
          {nextCall ? (
            <div className="next-number">
              {nextCall.queueNumber}
              <div className="next-name">{nextCall.name}</div>
            </div>
          ) : (
            <div className="next-empty">
              ANTRIAN KOSONG
            </div>
          )}
        </div>
      </div>

      {/* Daftar Menunggu - Simple */}
      <div className="waiting-section">
        <div className="waiting-header">
          <h3>DAFTAR MENUNGGU</h3>
          <div className="waiting-count">({waitingQueue.length} orang)</div>
        </div>
        <div className="waiting-list">
          {waitingQueue.slice(0, 10).map((customer) => (
            <div key={customer._id} className="waiting-item">
              <div className="waiting-number">{customer.queueNumber}</div>
              <div className="waiting-name">{customer.name}</div>
            </div>
          ))}
          {waitingQueue.length === 0 && (
            <div className="waiting-empty">Tidak ada yang menunggu</div>
          )}
        </div>
      </div>

      {/* Footer - Simple */}
      <div className="display-footer">
        <div className="footer-message">
          Silakan tunggu nomor Anda dipanggil
        </div>
        <div className="footer-status">
          ● Sistem Aktif
        </div>
      </div>
    </div>
  );
}