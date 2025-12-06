# Finance Queue System Backend

Backend untuk sistem antrian kantor finance dengan Node.js, Express, dan MongoDB.

## Fitur

- ✅ Generate nomor antrian otomatis (A01, A02, dst)
- ✅ Simpan data nasabah ke MongoDB
- ✅ Auto-reset nomor antrian setiap hari jam 00:00
- ✅ Tracking status antrian (waiting, processing, completed)
- ✅ API endpoints lengkap untuk manajemen antrian

## API Endpoints

### Customer Routes
- `POST /api/customers/queue` - Buat antrian baru
- `GET /api/customers/today` - Ambil semua antrian hari ini
- `GET /api/customers/queue/:queueNumber` - Cari antrian berdasarkan nomor
- `PUT /api/customers/queue/:queueNumber/status` - Update status antrian
- `GET /api/customers/counter` - Cek counter antrian hari ini
- `GET /api/customers/stats` - Statistik antrian hari ini

### Health Check
- `GET /health` - Cek status server

## Database Schema

### Customer Collection
- `name` - Nama nasabah
- `phone` - Nomor telepon (opsional)
- `service` - Jenis layanan
- `queueNumber` - Nomor antrian (A01, A02, dst)
- `queueOrder` - Urutan antrian
- `date` - Tanggal antrian
- `status` - Status (waiting, processing, completed)

### QueueCounter Collection
- `date` - Tanggal (YYYY-MM-DD)
- `counter` - Nomor counter terakhir
- `lastReset` - Waktu terakhir reset

## Cara Menjalankan

1. Pastikan MongoDB sudah running di `mongodb://localhost:27017`
2. Install dependencies:
   ```bash
   cd server
   npm install
   ```
3. Jalankan server:
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

Server akan running di `https://fin.kitapunya.web.id` (production) atau `http://localhost:5000` (development)

## Auto-Reset

Sistem akan otomatis mereset nomor antrian setiap hari jam 00:00 WIB menggunakan node-cron.

## Error Handling

- Validasi input sebelum simpan ke database
- Error handling untuk database connection
- Response format yang konsisten

## Environment Variables

- `PORT` - Port server (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `MONGODB_URI` - MongoDB connection string