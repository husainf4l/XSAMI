#!/bin/bash

echo "🚀 XSAMI Video Conferencing Setup"
echo "=================================="

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed!"
    echo "📦 Installing Go..."
    echo "Please install Go from: https://go.dev/dl/"
    echo "Or run: sudo snap install go --classic"
    exit 1
fi

echo "✅ Go is installed: $(go version)"

# Download dependencies
echo ""
echo "📦 Downloading dependencies..."
go mod download
go mod tidy

if [ $? -ne 0 ]; then
    echo "❌ Failed to download dependencies"
    exit 1
fi

echo "✅ Dependencies downloaded successfully"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
fi

# Build the application
echo ""
echo "🔨 Building application..."
go build -o bin/xsami cmd/main.go

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"

# Run the application
echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the server, run:"
echo "  ./bin/xsami"
echo ""
echo "Or use:"
echo "  make run"
echo ""
echo "The server will be available at: http://localhost:8080"
echo ""
echo "📚 For more information, see README.md"
