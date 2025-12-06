# Digital Queue Solution

A modern, real-time queue management system designed for service centers, banks, and customer care facilities. This solution provides a seamless experience for both customers and staff, featuring a customer-facing display, a teller interface, and an admin dashboard.

## Features

- **Real-time Queue Management**: Instant updates across all devices using Socket.io.
- **Multi-Role Support**:
  - **Customer View**: Displays current queue numbers and promotional videos.
  - **Teller Interface**: Allows staff to call, skip, and complete services for customers.
  - **Admin Dashboard**: Analytics and system management.
- **Voice Notifications**: Automated voice announcements when calling queue numbers.
- **QR Code Integration**: Easy access for customers to join the queue or view status.
- **Responsive Design**: Built with TailwindCSS for a modern look on all devices.
- **Hybrid Backend**: Utilizes both MongoDB and Supabase for robust data management.

## Tech Stack

### Frontend
- **Framework**: React (Vite)
- **Styling**: TailwindCSS
- **Real-time**: Socket.io-client
- **Routing**: React Router
- **Utilities**: Lucide React (Icons), QR Code generators

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose) & Supabase
- **Real-time**: Socket.io
- **Scheduling**: Node-cron

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB instance (local or cloud)
- Supabase account (optional, depending on configuration)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Grd45bisa/digital-queue-solution.git
   cd digital-queue-solution
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

## Configuration

### Frontend (.env)
Create a `.env` file in the root directory:
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### Backend (server/.env)
Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

## Usage

1. **Start the Backend Server**
   ```bash
   cd server
   npm start
   ```
   The server will run on `http://localhost:5000`.

2. **Start the Frontend Application**
   Open a new terminal window in the root directory:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

## Project Structure

- `/src`: Frontend React application source code.
- `/server`: Backend Node.js/Express application.
- `/public`: Static assets.

## License

[MIT](LICENSE)
