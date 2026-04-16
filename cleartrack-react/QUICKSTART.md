# Frontend Quick Start

This is the React/Vite frontend for the Cleartrack system.

## Step 1: Install Dependencies
Open a terminal in this `cleartrack-react` folder and run:
```bash
npm install
```
*(Note: If you get "vite is not recognized", you MUST run this step so the tools download properly).*

## Step 2: Configure Environment
Make sure the `.env` file exists in this folder with:
```env
VITE_API_URL=http://localhost:5000/api
```
*(If your backend is running on a different port like 5001, update this URL).*

## Step 3: Start the App
Make sure the **backend server** is already running in a separate terminal. Then, in this folder, run:
```bash
npm run dev
```

You should see output indicating the server is running on a local URL. Open your browser to:
**http://localhost:5173**

## Common Issues
- **"vite is not recognized"**: You forgot to run `npm install` inside this folder.
- **Network Error / API Failed**: Your backend server (port 5000) or MongoDB is not running.
