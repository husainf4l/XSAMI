# XSAMI Frontend - Next.js

Modern, scalable frontend for XSAMI video conferencing platform built with Next.js 14, TypeScript, and Tailwind CSS.

## 🚀 Features

- **Next.js 14** with App Router for optimal performance
- **TypeScript** for type safety and better developer experience
- **Tailwind CSS** for utility-first styling
- **Zustand** for lightweight state management
- **WebRTC** for peer-to-peer video/audio communication
- **WebSocket** for real-time signaling and chat
- **Lucide React** for beautiful, consistent icons

## 📁 Project Structure

```
xsami-front/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home/Welcome page
│   │   ├── room/
│   │   │   └── [id]/           # Dynamic room pages
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── VideoPlayer.tsx
│   │   ├── room/               # Room-specific components
│   │   └── chat/               # Chat components
│   ├── services/               # Business logic services
│   │   ├── webrtc.service.ts   # WebRTC management
│   │   └── websocket.service.ts # WebSocket management
│   ├── store/                  # State management
│   │   └── room.store.ts       # Room state (Zustand)
│   ├── types/                  # TypeScript type definitions
│   │   └── index.ts
│   └── lib/                    # Utility functions
│       └── utils.ts
├── public/                     # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

## 🛠️ Installation

1. **Navigate to the frontend directory:**
   ```bash
   cd xsami-front
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` to match your backend API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   NEXT_PUBLIC_WS_URL=ws://localhost:8080
   ```

## 🚀 Development

Run the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 📦 Build

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## 🎨 Architecture

### Service Layer Pattern

The application uses a service layer to encapsulate business logic:

- **WebRTCService**: Manages all WebRTC operations (peer connections, media streams, ICE handling)
- **WebSocketService**: Handles WebSocket connections with auto-reconnect logic

### State Management

Zustand is used for global state management with a single store:

- **Room Store**: Manages room state, peer connections, media settings, chat, and interactive features

### Component Structure

- **UI Components**: Reusable, presentation-only components
- **Feature Components**: Business logic components for specific features
- **Page Components**: Route-level components that compose features

## 🔌 API Integration

The frontend communicates with the Go backend through:

1. **REST API**: For room creation and initial setup
2. **WebSocket**: For real-time signaling and chat
   - Signaling WebSocket: `/room/{id}/websocket`
   - Chat WebSocket: `/room/{id}/chat/websocket`

## 🎯 Key Features Implementation

### WebRTC Connection Flow

1. User joins room → Gets list of existing peers
2. Creates RTCPeerConnection for each peer
3. Exchanges SDP offers/answers via WebSocket
4. Exchanges ICE candidates for connectivity
5. Establishes peer-to-peer media streams

### Screen Sharing

- Host controls who can share
- Only one person can share at a time
- Automatic fallback to camera on share end

### Chat System

- Real-time message delivery via WebSocket
- Support for text messages and file sharing
- Unread message counter
- Chat enable/disable control for hosts

### Interactive Features

- **Reactions**: Quick emoji reactions
- **Raise Hand**: Virtual hand raising for Q&A
- **Polls**: Host-created polls with real-time voting
- **Q&A**: Question submission and upvoting

## 🎨 Styling

### Design System

The application uses a custom design system with:

- Dark theme optimized for video conferencing
- Glassmorphism effects for modern UI
- Consistent spacing and typography
- Accessible color contrast

### Tailwind Configuration

Custom colors aligned with XSAMI branding:
- Primary: `#00bfff` (Bright cyan blue)
- Backgrounds: Dark theme variants
- Status colors: Success, danger, warning, info

## 🔐 Security Considerations

- Environment variables for sensitive configuration
- No hardcoded credentials
- HTTPS/WSS in production
- Input validation and sanitization

## 📱 Responsive Design

The application is fully responsive:
- Mobile: Single column layout, collapsible chat
- Tablet: Adaptive grid for video tiles
- Desktop: Full feature set with sidebars

## 🧪 Type Safety

Full TypeScript coverage with:
- Strict mode enabled
- Type definitions for all props and state
- No `any` types (except for necessary cases)

## 🚀 Performance Optimizations

- Next.js automatic code splitting
- Lazy loading for heavy components
- Optimized media constraints
- Debounced WebSocket messages

## 🔧 Development Tools

- **ESLint**: Code linting
- **TypeScript**: Type checking (`npm run type-check`)
- **Prettier**: Code formatting (recommended)

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8080` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:8080` |
| `NEXT_PUBLIC_TURN_SERVER_URL` | TURN server (optional) | - |
| `NEXT_PUBLIC_TURN_USERNAME` | TURN username (optional) | - |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | TURN credential (optional) | - |

## 🐛 Troubleshooting

### WebRTC Connection Issues

- Ensure STUN/TURN servers are configured
- Check firewall settings
- Verify WebSocket connection is established

### Build Errors

- Clear `.next` folder: `rm -rf .next`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zustand](https://github.com/pmndrs/zustand)

## 🤝 Contributing

When contributing:
1. Follow the existing code style
2. Add TypeScript types for new features
3. Test WebRTC functionality across browsers
4. Update documentation

## 📄 License

This project is part of the XSAMI video conferencing platform.
