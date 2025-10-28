# XSAMI Frontend - Setup Guide

## Quick Start

Follow these steps to get the Next.js frontend up and running:

### 1. Install Dependencies

```bash
cd xsami-front
npm install
```

This will install all necessary packages including:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Zustand (state management)
- Lucide React (icons)

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` to match your setup:

```env
# Backend API URL (where your Go server is running)
NEXT_PUBLIC_API_URL=http://localhost:8080

# WebSocket URL (same as API URL but with ws:// protocol)
NEXT_PUBLIC_WS_URL=ws://localhost:8080

# Optional: TURN server configuration for better connectivity
NEXT_PUBLIC_TURN_SERVER_URL=
NEXT_PUBLIC_TURN_USERNAME=
NEXT_PUBLIC_TURN_CREDENTIAL=
```

### 3. Start Development Server

```bash
npm run dev
```

The application will start at `http://localhost:3000`

### 4. Verify Backend Connection

Make sure your Go backend server is running on `http://localhost:8080` (or the URL you configured).

The backend should have the following endpoints available:
- `GET /room/create` - Create a new room
- `GET /room/{id}` - Join a room
- `WS /room/{id}/websocket` - WebRTC signaling
- `WS /room/{id}/chat/websocket` - Chat messages

## Project Structure Overview

```
xsami-front/
├── src/
│   ├── app/                    # Next.js pages (App Router)
│   │   ├── layout.tsx          # Root layout with metadata
│   │   ├── page.tsx            # Home page (/)
│   │   ├── room/
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Room page (/room/[id])
│   │   └── globals.css         # Global styles
│   │
│   ├── components/             # React components
│   │   └── ui/                 # Reusable UI components
│   │       ├── Button.tsx      # Button component
│   │       ├── Input.tsx       # Input field component
│   │       ├── Modal.tsx       # Modal dialog component
│   │       ├── VideoPlayer.tsx # Video player component
│   │       └── index.ts        # Component exports
│   │
│   ├── services/               # Business logic
│   │   ├── webrtc.service.ts   # WebRTC management
│   │   └── websocket.service.ts# WebSocket with auto-reconnect
│   │
│   ├── store/                  # State management (Zustand)
│   │   └── room.store.ts       # Global room state
│   │
│   ├── types/                  # TypeScript definitions
│   │   └── index.ts            # All type definitions
│   │
│   └── lib/                    # Utilities
│       └── utils.ts            # Helper functions
│
├── public/                     # Static assets
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── tailwind.config.ts          # Tailwind CSS config
├── next.config.mjs             # Next.js config
└── .env.local                  # Environment variables
```

## Key Concepts

### Service Layer

The application uses a service layer pattern to separate business logic from UI:

**WebRTC Service** (`src/services/webrtc.service.ts`):
- Manages peer connections
- Handles media streams (camera, microphone, screen)
- ICE candidate management
- Device enumeration

**WebSocket Service** (`src/services/websocket.service.ts`):
- Persistent WebSocket connection
- Automatic reconnection with exponential backoff
- Message queue for reliability
- Event-based architecture

### State Management

**Zustand** is used for lightweight, scalable state management:

```typescript
// Example usage:
import { useRoomStore } from '@/store/room.store';

function MyComponent() {
  const { localStream, toggleAudio } = useRoomStore();
  
  return (
    <button onClick={toggleAudio}>
      Toggle Mic
    </button>
  );
}
```

The store manages:
- Room metadata (ID, participants, host status)
- Peer connections
- Media settings
- Chat messages
- Interactive features (polls, Q&A, reactions)

### Component Architecture

**UI Components** (`src/components/ui/`):
- Pure presentation components
- No business logic
- Reusable across the app
- Type-safe props

**Page Components** (`src/app/`):
- Route-level components
- Compose UI components
- Connect to services and state

## Development Workflow

### Adding a New Feature

1. **Define Types** (`src/types/index.ts`):
   ```typescript
   export interface MyFeature {
     id: string;
     data: string;
   }
   ```

2. **Update State** (`src/store/room.store.ts`):
   ```typescript
   interface RoomStore {
     myFeature: MyFeature | null;
     setMyFeature: (feature: MyFeature) => void;
   }
   ```

3. **Create Component** (`src/components/MyFeatureComponent.tsx`):
   ```typescript
   export default function MyFeatureComponent() {
     const { myFeature, setMyFeature } = useRoomStore();
     // Component logic
   }
   ```

4. **Integrate** into page or parent component

### Type Checking

Run TypeScript type checking:

```bash
npm run type-check
```

### Linting

Run ESLint:

```bash
npm run lint
```

## Building for Production

### Create Production Build

```bash
npm run build
```

This will:
1. Type-check the entire codebase
2. Compile TypeScript to JavaScript
3. Optimize bundles with code splitting
4. Generate static assets

### Start Production Server

```bash
npm start
```

### Deployment Options

**Vercel (Recommended):**
```bash
npm install -g vercel
vercel
```

**Docker:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

**Manual:**
```bash
npm run build
npm start
```

## Troubleshooting

### Dependencies Not Installing

```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

```bash
rm -rf .next
npm run build
```

### WebRTC Not Working

1. Check browser console for errors
2. Verify WebSocket connection is established
3. Test with STUN server: `stun:stun.l.google.com:19302`
4. For production, configure TURN server

### TypeScript Errors

The errors you see are normal before running `npm install`. They will disappear once dependencies are installed.

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS 14.3+)
- Opera: ✅ Full support

## Performance Tips

1. **Video Quality**: Adjust constraints in `webrtc.service.ts`
2. **Grid Layout**: Automatic responsive layout based on participant count
3. **Lazy Loading**: Components are automatically code-split by Next.js

## Security Best Practices

1. Always use HTTPS in production
2. Configure CORS on backend
3. Validate all user inputs
4. Don't expose sensitive data in client-side code
5. Use environment variables for configuration

## Next Steps

1. ✅ Install dependencies
2. ✅ Configure environment
3. ✅ Start development server
4. 🔄 Test with backend
5. 🔄 Customize styling (Tailwind classes)
6. 🔄 Add additional features
7. 🔄 Deploy to production

## Need Help?

- Check the main README.md for architecture details
- Review the TypeScript types in `src/types/index.ts`
- Examine existing components for patterns
- Test with multiple browser windows for multi-user scenarios

---

**Happy coding! 🚀**
