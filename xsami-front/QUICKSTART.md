# 🚀 XSAMI Next.js Frontend - Getting Started

Welcome! This guide will get you up and running in **5 minutes**.

## ⚡ Quick Start

### 1️⃣ Install Dependencies

```bash
cd xsami-front
npm install
```

### 2️⃣ Configure Environment

```bash
# Copy the environment template
cp .env.example .env.local

# Edit if your backend is not on localhost:8080
# (Optional - defaults work for local development)
```

### 3️⃣ Start Development Server

```bash
npm run dev
```

### 4️⃣ Open in Browser

Visit **http://localhost:3000**

---

## ✅ That's it!

You now have a modern Next.js frontend running!

## 🎯 What You Can Do Now

### Create a Room
1. Click **"Start Meeting"**
2. Allow camera/microphone access
3. Copy the room link
4. Open in another browser window to test

### Join a Room
1. Click **"Join Room"**
2. Enter the room code
3. Click "Join"

---

## 📖 Need More Help?

- **[SETUP.md](./SETUP.md)** - Detailed setup guide with troubleshooting
- **[INTEGRATION.md](./INTEGRATION.md)** - How it works with Go backend
- **[README.md](./README.md)** - Full documentation
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Complete overview

---

## 🔧 Common Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run linter
npm run type-check   # Check TypeScript types
```

---

## ⚠️ Important Notes

### Backend Required
Make sure your Go backend is running:
```bash
# In the XSAMI root directory (not xsami-front)
cd ..
make run
```

### TypeScript Errors
TypeScript errors before `npm install` are **normal** and will disappear after installation.

### Browser Permissions
Grant camera/microphone permissions when prompted.

---

## 🐛 Troubleshooting

### "Cannot connect to server"
→ Check that Go backend is running on port 8080

### "Camera access denied"
→ Grant permissions in browser settings

### "npm: command not found"
→ Install Node.js 18+ from https://nodejs.org

---

## 🎉 You're All Set!

Enjoy your modern video conferencing platform!

Questions? Check the comprehensive guides linked above.

**Happy coding! 🚀**
