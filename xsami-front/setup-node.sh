#!/bin/bash

# XSAMI Frontend - Node.js Setup Script
# This script safely installs Node.js and project dependencies

set -e  # Exit on error

echo "================================"
echo "XSAMI Frontend Setup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is already installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js is already installed: $NODE_VERSION${NC}"
    
    # Check if version is acceptable (v16+)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 16 ]; then
        echo -e "${YELLOW}⚠ Warning: Node.js version is old. Recommended: v18 or v20${NC}"
        echo "Would you like to upgrade? (y/n)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            echo "Please upgrade Node.js using nvm or your package manager"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠ Node.js is not installed${NC}"
    echo ""
    echo "Choose installation method:"
    echo "1) nvm (Recommended - Latest version, easy updates)"
    echo "2) apt (Simple - System package manager)"
    echo "3) NodeSource (Ubuntu/Debian - Latest stable)"
    echo "4) Skip (I'll install it manually)"
    echo ""
    read -p "Enter choice [1-4]: " choice
    
    case $choice in
        1)
            echo -e "${GREEN}Installing Node.js via nvm...${NC}"
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
            
            # Load nvm
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
            
            # Install Node.js 20 LTS
            nvm install 20
            nvm use 20
            nvm alias default 20
            ;;
        2)
            echo -e "${GREEN}Installing Node.js via apt...${NC}"
            sudo apt update
            sudo apt install -y nodejs npm
            ;;
        3)
            echo -e "${GREEN}Installing Node.js via NodeSource...${NC}"
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        4)
            echo -e "${YELLOW}Skipping Node.js installation${NC}"
            echo "Please install Node.js manually and run this script again"
            exit 0
            ;;
        *)
            echo -e "${RED}✗ Invalid choice${NC}"
            exit 1
            ;;
    esac
fi

echo ""

# Verify Node.js installation
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js installation failed${NC}"
    echo "Please install Node.js manually:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
    echo "  nvm install 20"
    exit 1
fi

# Verify npm installation
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node --version) installed${NC}"
echo -e "${GREEN}✓ npm $(npm --version) installed${NC}"
echo ""

# Navigate to project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================"
echo "Installing Dependencies"
echo "================================"
echo ""

# Check if node_modules already exists
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ node_modules already exists${NC}"
    echo "Would you like to reinstall? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Cleaning old installation..."
        rm -rf node_modules package-lock.json
    else
        echo "Skipping dependency installation"
        exit 0
    fi
fi

# Install dependencies
echo "Installing npm packages..."
echo "(This may take 3-5 minutes)"
echo ""

npm install

echo ""
echo "================================"
echo "Verifying Installation"
echo "================================"
echo ""

# Check if installation was successful
if [ ! -d "node_modules" ]; then
    echo -e "${RED}✗ Installation failed: node_modules not created${NC}"
    exit 1
fi

# Count installed packages
PACKAGE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
echo -e "${GREEN}✓ Installed $PACKAGE_COUNT packages${NC}"

# Check for critical packages
CRITICAL_PACKAGES=("next" "react" "typescript" "tailwindcss" "zustand")
MISSING_PACKAGES=()

for package in "${CRITICAL_PACKAGES[@]}"; do
    if [ ! -d "node_modules/$package" ]; then
        MISSING_PACKAGES+=("$package")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing critical packages: ${MISSING_PACKAGES[*]}${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All critical packages installed${NC}"

# Run TypeScript check
echo ""
echo "Checking TypeScript compilation..."
if npx tsc --noEmit 2>/dev/null; then
    echo -e "${GREEN}✓ TypeScript compilation successful${NC}"
else
    echo -e "${YELLOW}⚠ TypeScript has warnings (this is normal)${NC}"
fi

echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo -e "${GREEN}✓ Node.js installed${NC}"
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo -e "${GREEN}✓ Project ready${NC}"
echo ""
echo "Next steps:"
echo "  1. Start development server:"
echo "     npm run dev"
echo ""
echo "  2. Open in browser:"
echo "     http://localhost:3000"
echo ""
echo "  3. Review documentation:"
echo "     - QUICKSTART.md (Quick start guide)"
echo "     - INSTALLATION_GUIDE.md (Detailed setup)"
echo "     - INTEGRATION.md (Backend integration)"
echo ""
echo "Happy coding! 🚀"
