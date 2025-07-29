const CACHE_NAME = 'finance-tracker-v8';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// External resources to cache
const externalResources = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// API cache for offline functionality
const API_CACHE_NAME = 'finance-tracker-api-v2';
const API_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Offline fallback pages
const OFFLINE_PAGES = {
  '/': '/offline.html',
  '/dashboard': '/offline.html',
  '/transactions': '/offline.html',
  '/accounts': '/offline.html',
  '/categories': '/offline.html'
};

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Only cache resources that exist
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(error => {
              console.log('Failed to cache:', url, error);
              return null;
            })
          )
        );
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests for offline functionality
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle external resources (like Font Awesome)
  if (request.url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(error => {
          console.log('External resource fetch failed:', request.url, error);
          // Try to serve from cache as fallback
          return caches.match(request);
        })
    );
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful navigation responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(error => {
          console.log('Navigation failed, serving offline page:', request.url, error);
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // Handle other requests (assets, etc.)
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(request).catch(error => {
          console.log('Fetch failed:', request.url, error);
          // Return a fallback response for navigation requests
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
          return new Response('Network error', { status: 503 });
        });
      })
  );
});

// Handle API requests with offline caching
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const cacheKey = `${request.method}:${url.pathname}${url.search}`;

  // Clone request body early to avoid "already used" errors
  let requestBody = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      requestBody = await request.clone().text();
    } catch (error) {
      console.warn('Could not clone request body:', error);
    }
  }

  try {
    // Try to fetch from network first
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful API responses (only for GET requests)
      if (request.method === 'GET') {
      const responseClone = response.clone();
      const apiCache = await caches.open(API_CACHE_NAME);
      
      // Create a proper Request object for caching
      const cacheRequest = new Request(cacheKey, {
        method: 'GET',
        headers: request.headers
      });
      
      await apiCache.put(cacheRequest, responseClone);
      
      // Set cache expiration
      const metadata = {
        timestamp: Date.now(),
        expires: Date.now() + API_CACHE_DURATION
      };
      const metadataRequest = new Request(`${cacheKey}:metadata`, { method: 'GET' });
      await apiCache.put(metadataRequest, new Response(JSON.stringify(metadata)));
      }
    }
    
    return response;
  } catch (error) {
    console.log('API request failed, trying cache:', request.url, error);
    
    // Try to serve from cache (only for GET requests)
    if (request.method === 'GET') {
    const apiCache = await caches.open(API_CACHE_NAME);
    const cacheRequest = new Request(cacheKey, { method: 'GET' });
    const cachedResponse = await apiCache.match(cacheRequest);
    
    if (cachedResponse) {
      // Check if cache is still valid
      const metadataRequest = new Request(`${cacheKey}:metadata`, { method: 'GET' });
      const metadataResponse = await apiCache.match(metadataRequest);
      if (metadataResponse) {
        const metadata = JSON.parse(await metadataResponse.text());
        if (Date.now() < metadata.expires) {
          console.log('Serving cached API response:', request.url);
          return cachedResponse;
        }
      }
    }
    
    // Return offline response for GET requests
      const offlineData = getOfflineData(url.pathname);
      return new Response(JSON.stringify(offlineData), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // For non-GET requests, queue for later sync with preserved body
    if (requestBody !== null) {
      await queueForSync(request.url, request.method, requestBody);
    }
    return new Response(JSON.stringify({
      message: 'Request queued for sync when online',
      queued: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get offline data based on endpoint
function getOfflineData(pathname) {
  // Return cached data or empty arrays
  switch (pathname) {
    case '/api/transactions':
      return { transactions: [], total: 0, totalPages: 0, currentPage: 1 };
    case '/api/accounts':
      return [];
    case '/api/categories':
      return [];
    case '/api/categories/with-counts':
      return [];
    case '/api/analytics/summary':
      return { 
        totalBalance: "0.00", 
        monthlyIncome: "0.00", 
        monthlyExpenses: "0.00",
        savingsRate: "0.0"
      };
    case '/api/analytics/spending-by-category':
      return [];
    case '/api/analytics/spending-data':
      return { 
        totalSpent: 0,
        monthlyBudget: 2000,
        weeklyBudget: 500,
        categorySpending: [],
        previousWeekSpending: 0,
        spendingChange: 0,
        weekStart: new Date().toISOString(),
        weekEnd: new Date().toISOString()
      };
    default:
      return { message: 'Offline mode - endpoint not available' };
  }
}

// Queue requests for later sync
async function queueForSync(url, method, body) {
  try {
    const syncQueue = await getSyncQueue();
    syncQueue.push({
      url: url,
      method: method,
      body: method !== 'GET' ? body : null,
      timestamp: Date.now()
    });
    await setSyncQueue(syncQueue);
  } catch (error) {
    console.error('Failed to queue request for sync:', error);
  }
}

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Handle online/offline status changes
self.addEventListener('online', () => {
  console.log('Service Worker: Online - triggering sync');
  doBackgroundSync();
});

self.addEventListener('offline', () => {
  console.log('Service Worker: Offline');
});

async function doBackgroundSync() {
  try {
    console.log('Starting background sync...');
    
    // Sync queued requests
    const syncQueue = await getSyncQueue();
    if (syncQueue.length > 0) {
      console.log(`Syncing ${syncQueue.length} queued requests`);
      await syncQueuedRequests(syncQueue);
    }
    
    // Clear old cache entries
    await cleanupOldCache();
    
    console.log('Background sync completed');
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function syncQueuedRequests(syncQueue) {
  const successfulSyncs = [];
  
  for (const queuedRequest of syncQueue) {
    try {
      const response = await fetch(queuedRequest.url, {
        method: queuedRequest.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getStoredToken()}`
        },
        body: queuedRequest.body
      });
      
      if (response.ok) {
        successfulSyncs.push(queuedRequest);
        console.log('Successfully synced:', queuedRequest.url);
      } else {
        console.error('Failed to sync:', queuedRequest.url, response.status);
      }
    } catch (error) {
      console.error('Error syncing request:', queuedRequest.url, error);
    }
  }
  
  // Remove successfully synced requests from queue
  const remainingQueue = syncQueue.filter(req => 
    !successfulSyncs.some(synced => synced.timestamp === req.timestamp)
  );
  await setSyncQueue(remainingQueue);
}

async function cleanupOldCache() {
  try {
    const apiCache = await caches.open(API_CACHE_NAME);
    const requests = await apiCache.keys();
    
    for (const request of requests) {
      if (request.url.includes(':metadata')) {
        const response = await apiCache.match(request);
        if (response) {
          const metadata = JSON.parse(await response.text());
          if (Date.now() > metadata.expires) {
            await apiCache.delete(request);
            // Also delete the corresponding data
            const dataKey = request.url.replace(':metadata', '');
            await apiCache.delete(dataKey);
          }
        }
      }
    }
  } catch (error) {
    console.error('Cache cleanup failed:', error);
  }
}

// IndexedDB for sync queue
async function getSyncQueue() {
  try {
    const db = await openDB();
    const transaction = db.transaction(['syncQueue'], 'readonly');
    const store = transaction.objectStore('syncQueue');
    return await store.getAll();
  } catch (error) {
    console.error('Failed to get sync queue:', error);
    return [];
  }
}

async function setSyncQueue(queue) {
  try {
    const db = await openDB();
    const transaction = db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    
    // Clear existing queue
    await store.clear();
    
    // Add new queue items
    for (const item of queue) {
      await store.add(item);
    }
  } catch (error) {
    console.error('Failed to set sync queue:', error);
  }
}

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FinanceTrackerDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'timestamp' });
      }
      
      // Create offline data store
      if (!db.objectStoreNames.contains('offlineData')) {
        db.createObjectStore('offlineData', { keyPath: 'key' });
      }
    };
  });
}

async function getStoredToken() {
  try {
    const db = await openDB();
    const transaction = db.transaction(['offlineData'], 'readonly');
    const store = transaction.objectStore('offlineData');
    const result = await store.get('authToken');
    return result ? result.value : null;
  } catch (error) {
    console.error('Failed to get stored token:', error);
    return null;
  }
} 