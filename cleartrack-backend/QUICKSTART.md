# Backend Quick Start

This is the Node.js/Express backend API for the Cleartrack system.

## Step 1: Install Dependencies
Open a terminal in this `cleartrack-backend` folder and run:
```bash
npm install
```

## Step 2: Configure Environment
Make sure the `.env` file exists in this folder with:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cleartrack
JWT_SECRET=cleartrack_super_secret_jwt_key_2026
JWT_EXPIRES_IN=7d
```

## Step 3: Start MongoDB
Ensure MongoDB is running on your computer. If MongoDB is installed as a Windows service, you can start it by opening a terminal as Administrator and running:
```bash
net start MongoDB
```

## Step 4: Run the Server
In the terminal, run:
```bash
npm run dev
```

You should see:
`✅ MongoDB connected`
`🚀 CLEARTRACK API running on http://localhost:5000`

If the port is in use, change `PORT` in `.env` to 5001.
