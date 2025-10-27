// WebRTC Room Client
let localStream = null;
let peerConnections = {}; // Map of peer connections by peer ID
let websocket = null;
let chatWebsocket = null;
let viewerWebsocket = null;
let screenStream = null;
let isAudioEnabled = true;
let isVideoEnabled = true;
let isScreenSharing = false;
let myPeerId = null;
let isHost = false;
let hostId = null;
let canShareScreen = false;
let activeSharingPeerId = null; // Track who is sharing screen
let localCameraStream = null; // Keep reference to camera stream

const roomId = document.getElementById('roomId').textContent;
const localVideo = document.getElementById('localVideo');
const videoGrid = document.getElementById('videoGrid');

// WebRTC Configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await initializeMedia();
    connectWebSocket();
    connectChatWebSocket();
    connectViewerWebSocket();
    populateDeviceSelectors();
    initializeAdminPanel();
});

// Initialize admin panel UI
function initializeAdminPanel() {
    // Initialize chat toggle as active (chat is enabled by default)
    const chatToggle = document.getElementById('chatToggle');
    if (chatToggle && chatToggle.checked) {
        chatToggle.parentElement.classList.add('active');
    }
}

// Initialize media devices
async function initializeMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        localVideo.srcObject = localStream;
        console.log('Local media initialized');
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Could not access camera and microphone. Please grant permissions.');
    }
}

// Connect to WebRTC signaling WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/room/${roomId}/websocket`;
    
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
        console.log('WebSocket connected');
        // Generate unique peer ID or get from server
        myPeerId = 'peer_' + Math.random().toString(36).substr(2, 9);
        // Announce presence to server
        sendSignalingMessage({
            event: 'join',
            data: {
                peerId: myPeerId
            }
        });
    };

    websocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await handleSignalingMessage(message);
    };

    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
        console.log('WebSocket closed');
        // Clean up all peer connections
        Object.keys(peerConnections).forEach(peerId => {
            if (peerConnections[peerId]) {
                peerConnections[peerId].close();
            }
        });
        peerConnections = {};
        setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
    };
}

// Create peer connection for a specific peer
function createPeerConnection(peerId, isInitiator) {
    console.log(`Creating peer connection for ${peerId}, initiator: ${isInitiator}`);
    
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections[peerId] = pc;

    // Add local tracks to peer connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
        console.log('Remote track received from', peerId, ':', event.track.kind);
        handleRemoteTrack(event, peerId);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingMessage({
                event: 'candidate',
                data: {
                    peerId: myPeerId,
                    targetPeerId: peerId,
                    candidate: JSON.stringify(event.candidate)
                }
            });
        }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${peerId}:`, pc.connectionState);
        
        if (pc.connectionState === 'failed' || 
            pc.connectionState === 'disconnected' ||
            pc.connectionState === 'closed') {
            // Remove video element for this peer
            removeRemoteVideo(peerId);
            delete peerConnections[peerId];
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state with ${peerId}:`, pc.iceConnectionState);
    };

    // If initiator, create and send offer
    if (isInitiator) {
        createOffer(peerId);
    }

    return pc;
}

// Create offer for specific peer
async function createOffer(peerId) {
    try {
        const pc = peerConnections[peerId];
        if (!pc) return;

        const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });

        await pc.setLocalDescription(offer);

        sendSignalingMessage({
            event: 'offer',
            data: {
                peerId: myPeerId,
                targetPeerId: peerId,
                sdp: offer.sdp
            }
        });
    } catch (error) {
        console.error('Error creating offer:', error);
    }
}

// Handle signaling messages
async function handleSignalingMessage(message) {
    try {
        switch (message.event) {
            case 'peers':
                // Server sends list of existing peers when we join
                if (message.data) {
                    // Set our peer ID and role
                    myPeerId = message.data.yourId || myPeerId;
                    isHost = message.data.isHost || false;
                    hostId = message.data.hostId;
                    canShareScreen = isHost; // Host can always share
                    
                    // Update UI based on role
                    updateHostUI();
                    
                    // Show admin button if host
                    if (isHost) {
                        showAdminButton();
                    }
                    
                    if (message.data.peers) {
                        message.data.peers.forEach(peerId => {
                            if (peerId !== myPeerId && !peerConnections[peerId]) {
                                // We are the initiator for existing peers
                                createPeerConnection(peerId, true);
                            }
                        });
                    }
                }
                break;

            case 'peer-joined':
                // New peer joined - wait for their offer
                if (message.data && message.data.peerId && message.data.peerId !== myPeerId) {
                    const peerId = message.data.peerId;
                    if (!peerConnections[peerId]) {
                        // Create connection but don't initiate (they will send offer)
                        createPeerConnection(peerId, false);
                    }
                }
                break;

            case 'peer-left':
                // Peer left - clean up their connection
                if (message.data && message.data.peerId) {
                    const peerId = message.data.peerId;
                    if (peerConnections[peerId]) {
                        peerConnections[peerId].close();
                        delete peerConnections[peerId];
                    }
                    removeRemoteVideo(peerId);
                }
                break;

            case 'screen-share-request':
                // Host receives screen share request
                if (isHost && message.data && message.data.peerId) {
                    showScreenShareRequest(message.data.peerId, message.data.peerName);
                }
                break;

            case 'screen-share-response':
                // Participant receives response to their request
                if (message.data) {
                    if (message.data.approved) {
                        canShareScreen = true;
                        alert('Screen sharing approved! You can now share your screen.');
                    } else {
                        canShareScreen = false;
                        alert('Screen sharing request denied.');
                    }
                }
                break;

            case 'screen-share-revoked':
                // Host revoked screen sharing
                canShareScreen = false;
                if (isScreenSharing) {
                    stopScreenShare();
                }
                alert('Your screen sharing permission has been revoked.');
                break;

            case 'screen-share-started':
                // Someone started sharing their screen
                if (message.data && message.data.peerId) {
                    const sharingPeerId = message.data.peerId;
                    if (sharingPeerId !== myPeerId) {
                        activeSharingPeerId = sharingPeerId;
                        // Wait a bit for video element to update
                        setTimeout(() => {
                            enableScreenShareLayout(sharingPeerId, false);
                        }, 500);
                    }
                }
                break;

            case 'screen-share-stopped':
                // Someone stopped sharing their screen
                if (message.data && message.data.peerId) {
                    const sharingPeerId = message.data.peerId;
                    if (activeSharingPeerId === sharingPeerId) {
                        activeSharingPeerId = null;
                        disableScreenShareLayout();
                    }
                }
                break;

            case 'offer':
                if (message.data && message.data.sdp && message.data.peerId) {
                    const peerId = message.data.peerId;
                    let pc = peerConnections[peerId];
                    
                    // Create connection if it doesn't exist
                    if (!pc) {
                        pc = createPeerConnection(peerId, false);
                    }

                    await pc.setRemoteDescription({
                        type: 'offer',
                        sdp: message.data.sdp
                    });
                    
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    
                    sendSignalingMessage({
                        event: 'answer',
                        data: {
                            peerId: myPeerId,
                            targetPeerId: peerId,
                            sdp: answer.sdp
                        }
                    });
                }
                break;

            case 'answer':
                if (message.data && message.data.sdp && message.data.peerId) {
                    const peerId = message.data.peerId;
                    const pc = peerConnections[peerId];
                    
                    if (pc) {
                        await pc.setRemoteDescription({
                            type: 'answer',
                            sdp: message.data.sdp
                        });
                    }
                }
                break;

            case 'candidate':
                if (message.data && message.data.candidate && message.data.peerId) {
                    const peerId = message.data.peerId;
                    const pc = peerConnections[peerId];
                    
                    if (pc) {
                        const candidate = JSON.parse(message.data.candidate);
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                }
                break;

            // Admin Panel Event Handlers
            case 'room-locked':
                showAdminNotification('🔒 Room has been locked by host');
                // Show lock indicator for all users
                const lockIndicator = document.getElementById('roomLockedIndicator');
                if (lockIndicator) {
                    lockIndicator.style.display = 'inline';
                }
                break;

            case 'room-unlocked':
                showAdminNotification('🔓 Room has been unlocked');
                // Hide lock indicator for all users
                const unlockIndicator = document.getElementById('roomLockedIndicator');
                if (unlockIndicator) {
                    unlockIndicator.style.display = 'none';
                }
                break;

            case 'chat-disabled':
                showAdminNotification('Chat has been disabled');
                // Disable chat input
                const chatInput = document.getElementById('chatInput');
                const chatSendBtn = document.getElementById('sendChatBtn');
                if (chatInput) chatInput.disabled = true;
                if (chatSendBtn) chatSendBtn.disabled = true;
                break;

            case 'chat-enabled':
                showAdminNotification('Chat has been enabled');
                // Enable chat input
                const chatInputEnabled = document.getElementById('chatInput');
                const chatSendBtnEnabled = document.getElementById('sendChatBtn');
                if (chatInputEnabled) chatInputEnabled.disabled = false;
                if (chatSendBtnEnabled) chatSendBtnEnabled.disabled = false;
                break;

            case 'participant-muted':
                if (message.data && message.data.peerId === myPeerId) {
                    // You've been muted
                    toggleAudio(); // Mute yourself
                    showAdminNotification('You have been muted by the host');
                }
                break;

            case 'all-muted':
                // Everyone except host has been muted
                if (!isHost) {
                    toggleAudio(); // Mute yourself
                    showAdminNotification('All participants have been muted');
                }
                break;

            case 'cohost-added':
                if (message.data && message.data.peerId === myPeerId) {
                    showAdminNotification('You are now a co-host');
                    showAdminButton();
                }
                break;

            case 'cohost-removed':
                if (message.data && message.data.peerId === myPeerId) {
                    showAdminNotification('You are no longer a co-host');
                    const adminBtn = document.getElementById('adminBtn');
                    if (adminBtn) adminBtn.style.display = 'none';
                }
                break;

            case 'participant-removed':
                if (message.data && message.data.peerId === myPeerId) {
                    alert('You have been removed from the meeting');
                    leaveRoom();
                }
                break;

            case 'waiting-room-list':
                if (message.data && message.data.participants) {
                    updateWaitingListUI(message.data.participants);
                }
                break;

            case 'recording-started':
                showAdminNotification('Recording started');
                // Show recording indicator for all users
                const recordingIndicator = document.createElement('div');
                recordingIndicator.id = 'globalRecordingIndicator';
                recordingIndicator.style.cssText = 'position: fixed; top: 80px; left: 20px; background: rgba(239, 68, 68, 0.9); color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; z-index: 1000; display: flex; align-items: center; gap: 8px;';
                recordingIndicator.innerHTML = '<div style="width: 12px; height: 12px; background: white; border-radius: 50%; animation: recordingPulse 1.5s ease-in-out infinite;"></div>Recording';
                document.body.appendChild(recordingIndicator);
                break;

            case 'recording-stopped':
                showAdminNotification('Recording stopped');
                // Remove recording indicator
                const indicator = document.getElementById('globalRecordingIndicator');
                if (indicator) indicator.remove();
                break;
        }
    } catch (error) {
        console.error('Error handling signaling message:', error);
    }
}

// Send signaling message
function sendSignalingMessage(message) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(message));
    }
}

// Handle remote tracks
function handleRemoteTrack(event, peerId) {
    const stream = event.streams[0];
    
    if (!stream) {
        console.warn('No stream in track event');
        return;
    }

    console.log(`Adding remote stream for peer ${peerId}`);

    // Check if video container already exists
    let videoContainer = document.getElementById(`video-${peerId}`);
    
    if (!videoContainer) {
        videoContainer = document.createElement('div');
        videoContainer.id = `video-${peerId}`;
        videoContainer.className = 'video-container';
        
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsinline = true;
        video.muted = false; // Don't mute remote videos
        video.srcObject = stream;
        
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay';
        overlay.innerHTML = `<span class="participant-name">Participant ${peerId.substr(-4)}</span>`;
        
        videoContainer.appendChild(video);
        videoContainer.appendChild(overlay);
        videoGrid.appendChild(videoContainer);
        
        console.log(`Video element created for peer ${peerId}`);
    } else {
        // Update existing video element
        const video = videoContainer.querySelector('video');
        if (video && video.srcObject !== stream) {
            video.srcObject = stream;
        }
    }
}

// Remove remote video element
function removeRemoteVideo(peerId) {
    const videoContainer = document.getElementById(`video-${peerId}`);
    if (videoContainer) {
        videoContainer.remove();
        console.log(`Removed video for peer ${peerId}`);
    }
}

// Toggle microphone
function toggleMicrophone() {
    isAudioEnabled = !isAudioEnabled;
    
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isAudioEnabled;
        });
    }

    const micBtn = document.getElementById('micBtn');
    const iconOn = micBtn.querySelector('.icon-on');
    const iconOff = micBtn.querySelector('.icon-off');
    
    if (isAudioEnabled) {
        micBtn.classList.add('active');
        iconOn.style.display = 'block';
        iconOff.style.display = 'none';
    } else {
        micBtn.classList.remove('active');
        iconOn.style.display = 'none';
        iconOff.style.display = 'block';
    }
}

// Toggle camera
function toggleCamera() {
    isVideoEnabled = !isVideoEnabled;
    
    if (localStream) {
        localStream.getVideoTracks().forEach(track => {
            track.enabled = isVideoEnabled;
        });
    }

    const videoBtn = document.getElementById('videoBtn');
    const iconOn = videoBtn.querySelector('.icon-on');
    const iconOff = videoBtn.querySelector('.icon-off');
    
    if (isVideoEnabled) {
        videoBtn.classList.add('active');
        iconOn.style.display = 'block';
        iconOff.style.display = 'none';
    } else {
        videoBtn.classList.remove('active');
        iconOn.style.display = 'none';
        iconOff.style.display = 'block';
    }
}

// Toggle screen sharing
async function toggleScreenShare() {
    if (!isScreenSharing) {
        // Check permission first
        if (!canShareScreen && !isHost) {
            // Request permission from host
            const confirmed = confirm('You need permission to share your screen. Request permission from the host?');
            if (confirmed) {
                sendSignalingMessage({
                    event: 'request-screen-share',
                    data: {
                        peerName: 'Participant ' + myPeerId.substr(-4)
                    }
                });
            }
            return;
        }
        
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always'
                },
                audio: false
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Save camera stream reference before switching
            if (!localCameraStream && localStream) {
                localCameraStream = localStream.clone();
            }
            
            // Replace video track in all peer connections with screen
            Object.values(peerConnections).forEach(pc => {
                const sender = pc.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                
                if (sender) {
                    sender.replaceTrack(screenTrack);
                }
            });

            // IMPORTANT: Show screen stream in local video element
            localVideo.srcObject = screenStream;
            
            // Handle screen share stop
            screenTrack.onended = () => {
                stopScreenShare();
            };

            isScreenSharing = true;
            activeSharingPeerId = myPeerId;
            
            // Enable Picture-in-Picture mode (this will create PiP with camera)
            enableScreenShareLayout(myPeerId, true);
            
            document.getElementById('screenBtn').classList.add('active');
            
            // Notify others about screen share
            sendSignalingMessage({
                event: 'screen-share-started',
                data: {
                    peerId: myPeerId
                }
            });
            
        } catch (error) {
            console.error('Error sharing screen:', error);
            alert('Could not share screen');
        }
    } else {
        stopScreenShare();
    }
}

// Stop screen sharing
function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    // Switch back to camera in local video element
    if (localStream) {
        localVideo.srcObject = localStream;
        
        const videoTrack = localStream.getVideoTracks()[0];
        
        // Replace track in all peer connections
        Object.values(peerConnections).forEach(pc => {
            const sender = pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            
            if (sender) {
                sender.replaceTrack(videoTrack);
            }
        });
    }

    isScreenSharing = false;
    activeSharingPeerId = null;
    localCameraStream = null;  // Clear the camera stream reference
    
    // Disable Picture-in-Picture mode
    disableScreenShareLayout();
    
    document.getElementById('screenBtn').classList.remove('active');
    
    // Notify others screen share stopped
    sendSignalingMessage({
        event: 'screen-share-stopped',
        data: {
            peerId: myPeerId
        }
    });
}

// Chat functionality
function connectChatWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/room/${roomId}/chat/websocket`;
    
    chatWebsocket = new WebSocket(wsUrl);

    chatWebsocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Check if this is our own message by comparing sender peer ID
        const isOwn = data.sender === myPeerId;
        displayChatMessage(event.data, isOwn);
    };

    chatWebsocket.onerror = (error) => {
        console.error('Chat WebSocket error:', error);
    };
}

function toggleChat() {
    const chatSidebar = document.getElementById('chatSidebar');
    chatSidebar.classList.toggle('hidden');
    
    // Reset notification badge
    const badge = document.getElementById('chatNotification');
    badge.style.display = 'none';
    badge.textContent = '0';
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message && chatWebsocket && chatWebsocket.readyState === WebSocket.OPEN) {
        const messageData = JSON.stringify({
            text: message,
            timestamp: new Date().toISOString(),
            sender: myPeerId || 'Anonymous',  // Send actual peer ID
            senderName: 'You'  // Display name for sender
        });
        
        chatWebsocket.send(messageData);
        // Don't display immediately - let server echo it back to avoid duplicates
        input.value = '';
    }
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

function displayChatMessage(messageData, isOwn) {
    const chatMessages = document.getElementById('chatMessages');
    const data = JSON.parse(messageData);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own' : ''}`;
    
    const time = new Date(data.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // Show "You" for own messages, otherwise show sender name or "User"
    const displayName = isOwn ? 'You' : (data.senderName || 'User');
    
    messageDiv.innerHTML = `
        <div class="message-sender">${displayName}</div>
        <div class="message-text">${escapeHtml(data.text)}</div>
        <div class="message-time">${time}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Show notification if chat is hidden
    if (!isOwn && document.getElementById('chatSidebar').classList.contains('hidden')) {
        const badge = document.getElementById('chatNotification');
        const count = parseInt(badge.textContent) || 0;
        badge.textContent = count + 1;
        badge.style.display = 'flex';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Viewer count
function connectViewerWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/room/${roomId}/viewer/websocket`;
    
    viewerWebsocket = new WebSocket(wsUrl);

    viewerWebsocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.event === 'viewer_count') {
            document.getElementById('participantCount').textContent = message.data.count;
        }
    };
}

// Device selection
async function populateDeviceSelectors() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const cameraSelect = document.getElementById('cameraSelect');
        const microphoneSelect = document.getElementById('microphoneSelect');
        const speakerSelect = document.getElementById('speakerSelect');
        
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `${device.kind} ${devices.indexOf(device) + 1}`;
            
            if (device.kind === 'videoinput') {
                cameraSelect.appendChild(option.cloneNode(true));
            } else if (device.kind === 'audioinput') {
                microphoneSelect.appendChild(option.cloneNode(true));
            } else if (device.kind === 'audiooutput') {
                speakerSelect.appendChild(option.cloneNode(true));
            }
        });
    } catch (error) {
        console.error('Error enumerating devices:', error);
    }
}

async function changeCamera() {
    const deviceId = document.getElementById('cameraSelect').value;
    
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
            audio: false
        });
        
        const videoTrack = newStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
        );
        
        if (sender) {
            sender.replaceTrack(videoTrack);
        }
        
        // Update local stream
        localStream.getVideoTracks()[0].stop();
        localStream.removeTrack(localStream.getVideoTracks()[0]);
        localStream.addTrack(videoTrack);
        
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error('Error changing camera:', error);
    }
}

async function changeMicrophone() {
    const deviceId = document.getElementById('microphoneSelect').value;
    
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: { deviceId: { exact: deviceId } }
        });
        
        const audioTrack = newStream.getAudioTracks()[0];
        const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'audio'
        );
        
        if (sender) {
            sender.replaceTrack(audioTrack);
        }
        
        // Update local stream
        localStream.getAudioTracks()[0].stop();
        localStream.removeTrack(localStream.getAudioTracks()[0]);
        localStream.addTrack(audioTrack);
    } catch (error) {
        console.error('Error changing microphone:', error);
    }
}

async function changeSpeaker() {
    const deviceId = document.getElementById('speakerSelect').value;
    
    try {
        if (typeof localVideo.setSinkId !== 'undefined') {
            await localVideo.setSinkId(deviceId);
        }
    } catch (error) {
        console.error('Error changing speaker:', error);
    }
}

// Settings modal
function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

// Copy room link
function copyRoomLink() {
    const roomLink = window.location.href;
    navigator.clipboard.writeText(roomLink).then(() => {
        alert('Room link copied to clipboard!');
    });
}

// Leave room
function leaveRoom() {
    if (confirm('Are you sure you want to leave the room?')) {
        // Stop all tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
        }
        
        // Close connections
        if (peerConnection) {
            peerConnection.close();
        }
        
        if (websocket) {
            websocket.close();
        }
        
        if (chatWebsocket) {
            chatWebsocket.close();
        }
        
        if (viewerWebsocket) {
            viewerWebsocket.close();
        }
        
        // Redirect to home
        window.location.href = '/';
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    Object.values(peerConnections).forEach(pc => {
        pc.close();
    });
});

// Update host UI elements
function updateHostUI() {
    if (isHost) {
        // Add host badge to local video
        const localContainer = localVideo.parentElement;
        if (localContainer && !localContainer.querySelector('.host-badge')) {
            const hostBadge = document.createElement('div');
            hostBadge.className = 'host-badge';
            hostBadge.innerHTML = '👑 Host';
            hostBadge.style.cssText = 'position: absolute; top: 10px; left: 10px; background: rgba(255, 215, 0, 0.9); color: #000; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; z-index: 10;';
            localContainer.appendChild(hostBadge);
        }
        
        console.log('You are the host of this meeting');
    }
}

// Show screen share request dialog (for host)
function showScreenShareRequest(peerId, peerName) {
    const name = peerName || `Participant ${peerId.substr(-4)}`;
    const approved = confirm(`${name} is requesting permission to share their screen. Allow?`);
    
    if (approved) {
        sendSignalingMessage({
            event: 'approve-screen-share',
            data: {
                peerId: peerId
            }
        });
    } else {
        sendSignalingMessage({
            event: 'deny-screen-share',
            data: {
                peerId: peerId
            }
        });
    }
}

// Revoke screen share permission (host only)
function revokeScreenShare(peerId) {
    if (!isHost) return;
    
    sendSignalingMessage({
        event: 'revoke-screen-share',
        data: {
            peerId: peerId
        }
    });
}

// Enable screen share layout (Picture-in-Picture mode)
function enableScreenShareLayout(sharingPeerId, isLocal) {
    console.log(`Enabling screen share layout for peer: ${sharingPeerId}, isLocal: ${isLocal}`);
    
    // Add screen-sharing-active class to video grid
    videoGrid.classList.add('screen-sharing-active');
    
    // Get the video container for the sharing peer
    const sharingContainer = isLocal ? 
        localVideo.parentElement : 
        document.getElementById(`video-${sharingPeerId}`);
    
    if (!sharingContainer) {
        console.warn('Sharing container not found');
        return;
    }
    
    // Mark as main screen share
    sharingContainer.classList.add('screen-share-main');
    
    // Add screen share indicator
    if (!sharingContainer.querySelector('.screen-share-indicator')) {
        const indicator = document.createElement('div');
        indicator.className = 'screen-share-indicator';
        indicator.textContent = isLocal ? 'You are sharing' : `${sharingPeerId.substr(-4)} is sharing`;
        sharingContainer.appendChild(indicator);
    }
    
    if (isLocal) {
        // For local sharing: create PiP camera view
        createPiPCamera();
    } else {
        // For remote sharing: move local video to PiP
        const localContainer = localVideo.parentElement;
        if (localContainer) {
            localContainer.classList.add('pip-camera');
        }
    }
    
    // Move other videos to bottom strip
    const allVideos = videoGrid.querySelectorAll('.video-container:not(.screen-share-main):not(.pip-camera)');
    if (allVideos.length > 0) {
        const otherParticipantsContainer = document.createElement('div');
        otherParticipantsContainer.className = 'other-participants';
        
        allVideos.forEach(video => {
            otherParticipantsContainer.appendChild(video);
        });
        
        videoGrid.appendChild(otherParticipantsContainer);
    }
}

// Create Picture-in-Picture camera view for local screen share
function createPiPCamera() {
    // Remove existing PiP if any
    const existingPip = document.querySelector('.pip-camera');
    if (existingPip && existingPip.id !== 'localVideoContainer') {
        existingPip.remove();
    }
    
    // Create PiP container for camera
    const pipContainer = document.createElement('div');
    pipContainer.className = 'video-container pip-camera';
    pipContainer.id = 'pip-camera-local';
    
    // Create video element for camera
    const pipVideo = document.createElement('video');
    pipVideo.autoplay = true;
    pipVideo.playsinline = true;
    pipVideo.muted = true;
    pipVideo.srcObject = localCameraStream || localStream;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    overlay.innerHTML = '<span class="participant-name">You (Camera)</span>';
    
    pipContainer.appendChild(pipVideo);
    pipContainer.appendChild(overlay);
    
    // Add to the main screen share container
    const mainContainer = videoGrid.querySelector('.screen-share-main');
    if (mainContainer) {
        mainContainer.appendChild(pipContainer);
    }
}

// Disable screen share layout
function disableScreenShareLayout() {
    console.log('Disabling screen share layout');
    
    // Remove screen-sharing-active class
    videoGrid.classList.remove('screen-sharing-active');
    
    // Remove all special classes
    const mainShare = videoGrid.querySelector('.screen-share-main');
    if (mainShare) {
        mainShare.classList.remove('screen-share-main');
        
        // Remove indicator
        const indicator = mainShare.querySelector('.screen-share-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    // Remove PiP camera
    const pipCamera = document.querySelector('.pip-camera');
    if (pipCamera) {
        pipCamera.classList.remove('pip-camera');
        if (pipCamera.id === 'pip-camera-local') {
            pipCamera.remove();
        }
    }
    
    // Move videos back to normal grid
    const otherParticipants = videoGrid.querySelector('.other-participants');
    if (otherParticipants) {
        const videos = otherParticipants.querySelectorAll('.video-container');
        videos.forEach(video => {
            videoGrid.appendChild(video);
        });
        otherParticipants.remove();
    }
    
    // Restore local video if needed
    const localContainer = localVideo.parentElement;
    if (localContainer && !videoGrid.contains(localContainer)) {
        videoGrid.insertBefore(localContainer, videoGrid.firstChild);
    }
}

// ========================================
// Admin Panel Functions
// ========================================

// Toggle Admin Panel
function toggleAdminPanel() {
    const panel = document.getElementById('adminPanel');
    panel.classList.toggle('active');
}

// Toggle Participants Panel (for all users)
function toggleParticipantsPanel() {
    const panel = document.getElementById('participantsPanel');
    panel.classList.toggle('active');
    
    if (panel.classList.contains('active')) {
        populateAllParticipantsList();
    }
}

// Switch Admin Tab
function switchAdminTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Populate content based on tab
    if (tabName === 'participantsTab') {
        populateParticipantsList();
    } else if (tabName === 'waitingTab') {
        populateWaitingList();
    }
}

// Toggle Room Lock
function toggleRoomLock() {
    const toggle = document.getElementById('roomLockToggle');
    const isLocked = toggle.checked;
    
    // Update toggle visual state
    toggle.parentElement.classList.toggle('active', isLocked);
    
    // Update room header indicator
    const indicator = document.getElementById('roomLockedIndicator');
    if (indicator) {
        indicator.style.display = isLocked ? 'inline' : 'none';
    }
    
    sendSignalingMessage({
        event: isLocked ? 'lock-room' : 'unlock-room',
        data: {}
    });
    
    showAdminNotification(isLocked ? '🔒 Room locked - New participants blocked' : '🔓 Room unlocked - New participants allowed');
}

// Toggle Chat Permission
function toggleChatPermission() {
    const toggle = document.getElementById('chatToggle');
    const isEnabled = toggle.checked;
    
    // Update toggle visual state
    toggle.parentElement.classList.toggle('active', isEnabled);
    
    sendSignalingMessage({
        event: isEnabled ? 'enable-chat' : 'disable-chat',
        data: {}
    });
    
    showAdminNotification(isEnabled ? 'Chat enabled' : 'Chat disabled');
}

// Toggle Mute All Participants
function toggleMuteAll() {
    const toggle = document.getElementById('muteAllToggle');
    const isMuted = toggle.checked;
    
    // Update toggle visual state
    toggle.parentElement.classList.toggle('active', isMuted);
    
    if (isMuted) {
        // Mute all
        sendSignalingMessage({
            event: 'mute-all',
            data: {}
        });
        showAdminNotification('All participants muted');
    } else {
        // Unmute all
        sendSignalingMessage({
            event: 'unmute-all',
            data: {}
        });
        showAdminNotification('All participants unmuted');
    }
}

// Legacy function - kept for compatibility
function muteAllParticipants() {
    const toggle = document.getElementById('muteAllToggle');
    if (toggle) {
        toggle.checked = true;
        toggleMuteAll();
    }
}

// Populate Participants List (Admin Panel)
function populateParticipantsList() {
    const list = document.getElementById('participantsList');
    list.innerHTML = '';
    
    // Add host (you)
    const hostItem = createParticipantItem(myPeerId, 'You', true, false);
    list.appendChild(hostItem);
    
    // Add other participants
    Object.keys(peerConnections).forEach(peerId => {
        const item = createParticipantItem(peerId, `Participant ${peerId.substr(-4)}`, false, false);
        list.appendChild(item);
    });
}

// Create Participant Item Element
function createParticipantItem(peerId, name, isCurrentUser, isCoHost) {
    const item = document.createElement('div');
    item.className = 'participant-item';
    item.innerHTML = `
        <div class="participant-info">
            <div class="participant-avatar">${name.charAt(0).toUpperCase()}</div>
            <div class="participant-details">
                <div class="participant-name">${name}</div>
                ${isCurrentUser ? '<div class="participant-role">Host</div>' : ''}
                ${isCoHost ? '<div class="participant-role">Co-Host</div>' : ''}
            </div>
        </div>
        ${!isCurrentUser ? `
        <div class="participant-actions">
            <button class="participant-action-btn" onclick="muteParticipant('${peerId}')" title="Mute">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                </svg>
            </button>
            <button class="participant-action-btn" onclick="makeCoHost('${peerId}')" title="Make Co-Host">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 10l-4 4-1.41-1.41L10 11.17l6.59-6.59L18 6l-6 6z"/>
                </svg>
            </button>
            <button class="participant-action-btn danger" onclick="removeParticipant('${peerId}')" title="Remove">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        </div>
        ` : ''}
    `;
    return item;
}

// Mute Participant
function muteParticipant(peerId) {
    sendSignalingMessage({
        event: 'mute-participant',
        data: { peerId }
    });
    
    showAdminNotification('Participant muted');
}

// Make Co-Host
function makeCoHost(peerId) {
    if (confirm('Make this participant a co-host?')) {
        sendSignalingMessage({
            event: 'add-cohost',
            data: { peerId }
        });
        
        showAdminNotification('Co-host added');
        populateParticipantsList();
    }
}

// Remove Participant
function removeParticipant(peerId) {
    if (confirm('Remove this participant from the room?')) {
        sendSignalingMessage({
            event: 'remove-participant',
            data: { peerId }
        });
        
        showAdminNotification('Participant removed');
    }
}

// Populate Waiting List
function populateWaitingList() {
    sendSignalingMessage({
        event: 'get-waiting-room',
        data: {}
    });
}

// Update Waiting List UI
function updateWaitingListUI(participants) {
    const list = document.getElementById('waitingList');
    const empty = document.getElementById('waitingEmpty');
    
    if (participants.length === 0) {
        list.style.display = 'none';
        empty.style.display = 'block';
    } else {
        list.style.display = 'flex';
        empty.style.display = 'none';
        list.innerHTML = '';
        
        participants.forEach(p => {
            const item = createWaitingItem(p.peerId, p.name);
            list.appendChild(item);
        });
    }
}

// Create Waiting Item Element
function createWaitingItem(peerId, name) {
    const item = document.createElement('div');
    item.className = 'waiting-item';
    item.innerHTML = `
        <div class="waiting-info">
            <div class="waiting-avatar">${name.charAt(0).toUpperCase()}</div>
            <div>${name}</div>
        </div>
        <div class="waiting-actions">
            <button class="admit-btn" onclick="admitParticipant('${peerId}')">Admit</button>
            <button class="deny-btn" onclick="denyParticipant('${peerId}')">Deny</button>
        </div>
    `;
    return item;
}

// Admit Participant
function admitParticipant(peerId) {
    sendSignalingMessage({
        event: 'admit-participant',
        data: { peerId }
    });
    
    showAdminNotification('Participant admitted');
    populateWaitingList();
}

// Deny Participant
function denyParticipant(peerId) {
    sendSignalingMessage({
        event: 'deny-participant',
        data: { peerId }
    });
    
    showAdminNotification('Participant denied');
    populateWaitingList();
}

// Toggle Recording
let recordingInterval = null;
let recordingStartTime = null;

function toggleRecording() {
    const isRecording = document.getElementById('recordingStatus').style.display === 'flex';
    
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    sendSignalingMessage({
        event: 'start-recording',
        data: {}
    });
    
    // Update UI
    document.getElementById('recordingStatus').style.display = 'flex';
    document.getElementById('startRecordingBtn').style.display = 'none';
    document.getElementById('stopRecordingBtn').style.display = 'flex';
    
    // Start timer
    recordingStartTime = Date.now();
    recordingInterval = setInterval(updateRecordingTimer, 1000);
    
    showAdminNotification('Recording started');
}

function stopRecording() {
    sendSignalingMessage({
        event: 'stop-recording',
        data: {}
    });
    
    // Update UI
    document.getElementById('recordingStatus').style.display = 'none';
    document.getElementById('startRecordingBtn').style.display = 'flex';
    document.getElementById('stopRecordingBtn').style.display = 'none';
    
    // Stop timer
    if (recordingInterval) {
        clearInterval(recordingInterval);
        recordingInterval = null;
    }
    
    showAdminNotification('Recording stopped');
}

function updateRecordingTimer() {
    if (!recordingStartTime) return;
    
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('recordingTime').textContent = timeStr;
}

// Populate All Participants List (for participants panel - all users)
function populateAllParticipantsList() {
    const list = document.getElementById('allParticipantsList');
    list.innerHTML = '';
    
    // Add yourself
    const selfItem = document.createElement('div');
    selfItem.className = 'participant-item';
    selfItem.innerHTML = `
        <div class="participant-info">
            <div class="participant-avatar">Y</div>
            <div class="participant-details">
                <div class="participant-name">You</div>
                ${isHost ? '<div class="participant-role">Host</div>' : ''}
            </div>
        </div>
    `;
    list.appendChild(selfItem);
    
    // Add other participants
    Object.keys(peerConnections).forEach(peerId => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        item.innerHTML = `
            <div class="participant-info">
                <div class="participant-avatar">${peerId.charAt(0).toUpperCase()}</div>
                <div class="participant-details">
                    <div class="participant-name">Participant ${peerId.substr(-4)}</div>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

// Show Admin Notification
function showAdminNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'admin-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Show admin button for host
function showAdminButton() {
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn && isHost) {
        adminBtn.style.display = 'flex';
    }
}
