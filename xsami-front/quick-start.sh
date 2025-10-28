#!/bin/bash

# XSAMI Frontend - Quick Start Script
# This script helps you get started with the Next.js frontend

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║   XSAMI Frontend - Quick Start Setup    ║"
echo "╔══════════════════════════════════════════╗"
echo -e "${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found!${NC}"
    echo "Please run this script from the xsami-front directory:"
    echo "  cd xsami-front"
    echo "  ./quick-start.sh"
    exit 1
fi

echo -e "${YELLOW}Step 1: Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed!${NC}"
    echo "Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js version is too old (found v$NODE_VERSION, need v18+)${NC}"
    echo "Please update Node.js from: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

echo -e "\n${YELLOW}Step 2: Installing dependencies...${NC}"
echo "This may take a few minutes..."
npm install

echo -e "\n${GREEN}✓ Dependencies installed${NC}"

echo -e "\n${YELLOW}Step 3: Setting up environment variables...${NC}"
if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    echo -e "${GREEN}✓ Created .env.local from template${NC}"
    echo -e "${YELLOW}Note: Edit .env.local if your backend is not at localhost:8080${NC}"
else
    echo -e "${GREEN}✓ .env.local already exists${NC}"
fi

echo -e "\n${YELLOW}Step 4: Configuration Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Backend API URL: $(grep NEXT_PUBLIC_API_URL .env.local | cut -d'=' -f2)"
echo "WebSocket URL:   $(grep NEXT_PUBLIC_WS_URL .env.local | cut -d'=' -f2)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "\n${GREEN}✓ Setup complete!${NC}"

echo -e "\n${BLUE}╔══════════════════════════════════════════╗"
echo "║          Next Steps                      ║"
echo "╚══════════════════════════════════════════╝${NC}"

echo -e "\n${YELLOW}1. Start the development server:${NC}"
echo "   npm run dev"

echo -e "\n${YELLOW}2. Open your browser:${NC}"
echo "   http://localhost:3000"

echo -e "\n${YELLOW}3. Make sure your Go backend is running:${NC}"
echo "   (In the XSAMI root directory)"
echo "   make run"

echo -e "\n${YELLOW}4. Test the application:${NC}"
echo "   - Click 'Start Meeting' to create a room"
echo "   - Copy the room link"
echo "   - Open in another browser window/tab to test peer connection"

echo -e "\n${BLUE}📚 Documentation:${NC}"
echo "   README.md        - Full documentation"
echo "   SETUP.md         - Detailed setup guide"
echo "   MIGRATION.md     - Migration from vanilla JS"
echo "   PROJECT_SUMMARY.md - Complete overview"

echo -e "\n${BLUE}🔧 Useful Commands:${NC}"
echo "   npm run dev      - Start development server"
echo "   npm run build    - Build for production"
echo "   npm run start    - Start production server"
echo "   npm run lint     - Run ESLint"
echo "   npm run type-check - Run TypeScript checks"

echo -e "\n${GREEN}Happy coding! 🚀${NC}\n"
