// Simple fallback - return production URL directly without checking
const getApiUrl = async () => {
  return import.meta.env.VITE_API_BASE_URL || 'https://fin.kitapunya.web.id';
};

// Simple fallback - return production socket URL directly without checking
const getSocketUrl = async () => {
  return import.meta.env.VITE_SOCKET_URL || 'https://fin.kitapunya.web.id';
};

// Helper function to get local API URL based on current hostname
const getLocalApiUrl = () => {
  // Always use production API URL
  return 'https://fin.kitapunya.web.id';
};

// API Configuration (synchronous fallback for immediate use)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://fin.kitapunya.web.id';

// Socket.IO Configuration (synchronous fallback for immediate use)
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://fin.kitapunya.web.id';

// Export async functions for dynamic URL resolution
export { getApiUrl, getSocketUrl };

export const API_ENDPOINTS = {
  CUSTOMERS: {
    QUEUE: '/api/customers/queue',
    TODAY: '/api/customers/today',
    RESET_COUNTER: '/api/customers/reset-counter',
    FIX_DUPLICATES: '/api/customers/fix-duplicates',
    CHECK_DUPLICATES: '/api/customers/check-duplicates',
    CLEANUP_OLD: '/api/customers/cleanup-old',
    CLEANUP_STATS: '/api/customers/cleanup-stats',
    CALL_NEXT: '/api/customers/call-next',
    COMPLETE_SERVICE: '/api/customers/complete-service',
    SKIP_CUSTOMER: '/api/customers/skip-customer',
    CREATE_FAKE_QUEUES: '/api/customers/create-fake-queues',
    TELLER_CURRENT: '/api/customers/teller/:tellerId/current',
    TELLERS_STATUS: '/api/customers/tellers/status',
    NEXT_CUSTOMERS: '/api/customers/teller/next-customers',
    STATS: '/api/customers/stats'
  }
};

// Helper function for API calls
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};