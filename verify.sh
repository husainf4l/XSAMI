#!/bin/bash

echo "🔍 XSAMI Feature Verification Check"
echo "===================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1${NC}"
        ((PASS++))
    else
        echo -e "${RED}❌ $1 - MISSING${NC}"
        ((FAIL++))
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅ $1/${NC}"
        ((PASS++))
    else
        echo -e "${RED}❌ $1/ - MISSING${NC}"
        ((FAIL++))
    fi
}

echo "📂 Checking Project Structure..."
echo ""

# Backend files
echo "Backend Go Files:"
check_file "cmd/main.go"
check_file "internal/server/sever.go"
check_file "internal/handler/welcome.go"
check_file "internal/handler/room.go"
check_file "internal/handler/stream.go"
check_file "internal/handler/chat.go"
check_file "pkg/webrtc/room.go"
check_file "pkg/webrtc/peers.go"
check_file "pkg/chat/hub.go"
check_file "pkg/chat/client.go"

echo ""
echo "Frontend Files:"
check_file "views/welcome.html"
check_file "views/room.html"
check_file "views/stream.html"
check_file "views/layouts/main.html"
check_file "views/partials/header.html"
check_file "views/partials/footer.html"
check_file "assets/css/style.css"
check_file "assets/js/room.js"
check_file "assets/images/favicon.svg"

echo ""
echo "Configuration Files:"
check_file "go.mod"
check_file "go.sum"
check_file "makefile"
check_file ".env.example"
check_file ".gitignore"
check_file "README.md"
check_file "QUICKSTART.md"

echo ""
echo "Docker Files:"
check_file "containers/images/Dockerfile"
check_file "containers/composes/dc.dev.yml"
check_file "containers/composes/turnserver.conf"

echo ""
echo "🔍 Checking Feature Implementation..."
echo ""

# Check for WebRTC features in room.js
if grep -q "toggleMicrophone" assets/js/room.js; then
    echo -e "${GREEN}✅ Microphone toggle implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Microphone toggle missing${NC}"
    ((FAIL++))
fi

if grep -q "toggleCamera" assets/js/room.js; then
    echo -e "${GREEN}✅ Camera toggle implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Camera toggle missing${NC}"
    ((FAIL++))
fi

if grep -q "toggleScreenShare" assets/js/room.js; then
    echo -e "${GREEN}✅ Screen sharing implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Screen sharing missing${NC}"
    ((FAIL++))
fi

if grep -q "sendChatMessage" assets/js/room.js; then
    echo -e "${GREEN}✅ Chat functionality implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Chat functionality missing${NC}"
    ((FAIL++))
fi

if grep -q "populateDeviceSelectors" assets/js/room.js; then
    echo -e "${GREEN}✅ Device selection implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Device selection missing${NC}"
    ((FAIL++))
fi

# Check for WebRTC signaling in handlers
if grep -q "handleOffer" internal/handler/room.go; then
    echo -e "${GREEN}✅ WebRTC signaling (SDP) implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ WebRTC signaling missing${NC}"
    ((FAIL++))
fi

if grep -q "handleCandidate" internal/handler/room.go; then
    echo -e "${GREEN}✅ ICE candidate handling implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ ICE candidate handling missing${NC}"
    ((FAIL++))
fi

# Check for chat system
if grep -q "NewHub" pkg/chat/hub.go; then
    echo -e "${GREEN}✅ Chat hub system implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Chat hub missing${NC}"
    ((FAIL++))
fi

# Check for room management
if grep -q "CreateRoom" pkg/webrtc/room.go; then
    echo -e "${GREEN}✅ Room management implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Room management missing${NC}"
    ((FAIL++))
fi

# Check for peer connection management
if grep -q "AddPeerConnection" pkg/webrtc/peers.go; then
    echo -e "${GREEN}✅ Peer connection management implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Peer connection management missing${NC}"
    ((FAIL++))
fi

echo ""
echo "🎨 Checking UI Components..."
echo ""

if grep -q "video-grid" assets/css/style.css; then
    echo -e "${GREEN}✅ Video grid styling${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Video grid styling missing${NC}"
    ((FAIL++))
fi

if grep -q "controls-bar" assets/css/style.css; then
    echo -e "${GREEN}✅ Control bar styling${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Control bar styling missing${NC}"
    ((FAIL++))
fi

if grep -q "chat-sidebar" assets/css/style.css; then
    echo -e "${GREEN}✅ Chat sidebar styling${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Chat sidebar styling missing${NC}"
    ((FAIL++))
fi

if grep -q "dark" assets/css/style.css; then
    echo -e "${GREEN}✅ Dark theme implemented${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ Dark theme missing${NC}"
    ((FAIL++))
fi

echo ""
echo "📊 Verification Results"
echo "======================="
echo -e "${GREEN}Passed: $PASS${NC}"
if [ $FAIL -gt 0 ]; then
    echo -e "${RED}Failed: $FAIL${NC}"
else
    echo -e "${GREEN}Failed: $FAIL${NC}"
fi
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 All features verified successfully!${NC}"
    echo -e "${GREEN}✅ Project is ready to run!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some issues found. Please review the output above.${NC}"
    exit 1
fi
