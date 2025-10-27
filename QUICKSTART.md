# XSAMI Quick Start Guide

## 🎬 Getting Started in 5 Minutes

### Step 1: Install Go

If you don't have Go installed:

**Ubuntu/Debian:**
```bash
sudo snap install go --classic
```

**Or download from:** https://go.dev/dl/

### Step 2: Setup the Project

```bash
# Navigate to project directory
cd /home/husain/XSAMI

# Run the setup script
./setup.sh
```

### Step 3: Run the Application

```bash
# Option 1: Using Make
make run

# Option 2: Direct Go command
go run cmd/main.go

# Option 3: Using the built binary
./bin/xsami
```

### Step 4: Access the Application

Open your browser and go to:
```
http://localhost:8080
```

## 🎥 Using the Platform

### Starting a Meeting

1. Click **"Start Meeting"** on the home page
2. Allow camera and microphone access
3. Copy the room URL and share with participants
4. Start collaborating!

### Joining a Meeting

1. Click **"Join Room"**
2. Enter the room code (the UUID from the URL)
3. Click **"Join Room"**
4. Allow permissions and you're in!

## 🎮 Controls

| Button | Function | Shortcut |
|--------|----------|----------|
| 🎤 Microphone | Mute/Unmute audio | - |
| 📹 Camera | Turn video on/off | - |
| 🖥️ Screen Share | Share your screen | - |
| 💬 Chat | Open chat sidebar | - |
| ⚙️ Settings | Device settings | - |
| 🔴 Leave | Exit the meeting | - |

## 🛠️ Troubleshooting

### Camera/Microphone Not Working

1. Check browser permissions (click the 🔒 icon in address bar)
2. Grant camera and microphone access
3. Refresh the page

### No Video from Other Participants

1. Check your internet connection
2. Make sure other participants have their cameras on
3. Try refreshing the page

### Can't Connect (Behind Firewall/NAT)

You need a TURN server for production use. See README.md for TURN server setup.

## 🐳 Docker Quick Start

If you prefer Docker:

```bash
# Build images
make build-dev

# Run with Docker Compose
make run-dev

# Access at http://localhost:8080

# Stop
make clean-dev
```

## 📊 Testing Multiple Participants

Open multiple browser windows or tabs:
1. Start a meeting in one tab
2. Copy the room URL
3. Open a new incognito/private window
4. Paste the URL to join as a second participant

## 🔧 Configuration

### Change Port

Edit and set:
```bash
export PORT=3000
go run cmd/main.go
```

Or use command line:
```bash
go run cmd/main.go -addr=:3000
```

### Enable HTTPS

```bash
go run cmd/main.go -addr=:443 -cert=/path/to/cert.pem -key=/path/to/key.pem
```

## 🚀 Next Steps

- **Production Deployment:** See README.md for Docker, Nginx, and TURN server setup
- **Customization:** Edit CSS in `assets/css/style.css` for custom styling
- **Features:** Extend functionality by modifying handlers and WebRTC logic

## 💡 Tips

- Use Chrome or Firefox for best WebRTC support
- For local testing, localhost works fine without TURN server
- For production, always use HTTPS and a TURN server
- Monitor connections in browser DevTools Console

## 🆘 Need Help?

- Check the main README.md for detailed documentation
- Review browser console for errors (F12 → Console)
- Ensure Go version is 1.23 or higher: `go version`

## 🎉 You're Ready!

Start your first meeting and enjoy professional video conferencing with XSAMI!
