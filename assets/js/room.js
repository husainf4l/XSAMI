// WebRTC Room Client
let localStream = null;
let peerConnections = {}; // Map of peer connections by peer ID
let peerUsernames = {}; // Map of peer ID to username
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
let myUsername = null; // Store user's chosen name
let isRoomLocked = false; // Track room lock status

// File sharing variables
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/zip'];

// Annotation variables
let annotationCanvas = null;
let annotationContext = null;
let isAnnotating = false;
let currentTool = 'pen';
let annotationColor = '#ef4444';
let annotationSize = 3;
let annotationHistory = [];
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Reaction variables
let isHandRaised = false;
let raisedHands = new Map(); // Map of peerId -> username

// Poll variables
let activePoll = null;
let hasVoted = false;

// Q&A variables
let questions = [];
let questionIdCounter = 0;

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
    // Prompt for username
    await promptForUsername();
    await initializeMedia();
    connectWebSocket();
    connectChatWebSocket();
    connectViewerWebSocket();
    populateDeviceSelectors();
    initializeAdminPanel();
});

// Prompt user for their name
async function promptForUsername() {
    // Check if username is stored in session
    myUsername = sessionStorage.getItem(`username_${roomId}`);
    
    if (!myUsername) {
        myUsername = prompt('Please enter your name:', 'Guest');
        if (!myUsername || myUsername.trim() === '') {
            myUsername = 'Guest_' + Math.random().toString(36).substr(2, 5);
        }
        // Store in session storage
        sessionStorage.setItem(`username_${roomId}`, myUsername);
    }
    
    console.log('Username set to:', myUsername);
}

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
                username: myUsername,
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
                    const username = message.data.username || `Participant ${peerId.substr(-4)}`;
                    
                    // Store the username
                    peerUsernames[peerId] = username;
                    
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
                    delete peerUsernames[peerId];
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
                    const username = message.data.username || `Participant ${peerId.substr(-4)}`;
                    
                    // Store the username
                    peerUsernames[peerId] = username;
                    
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
                            username: myUsername,
                            targetPeerId: peerId,
                            sdp: answer.sdp
                        }
                    });
                }
                break;

            case 'answer':
                if (message.data && message.data.sdp && message.data.peerId) {
                    const peerId = message.data.peerId;
                    const username = message.data.username || `Participant ${peerId.substr(-4)}`;
                    
                    // Store the username
                    peerUsernames[peerId] = username;
                    
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
                isRoomLocked = true;
                showAdminNotification('🔒 Room has been locked by host');
                // Show lock indicator for all users
                const lockIndicator = document.getElementById('roomLockedIndicator');
                if (lockIndicator) {
                    lockIndicator.style.display = 'inline';
                }
                // Hide room info for non-hosts
                updateRoomInfoVisibility();
                break;

            case 'room-unlocked':
                isRoomLocked = false;
                showAdminNotification('🔓 Room has been unlocked');
                // Hide lock indicator for all users
                const unlockIndicator = document.getElementById('roomLockedIndicator');
                if (unlockIndicator) {
                    unlockIndicator.style.display = 'none';
                }
                // Show room info for all users
                updateRoomInfoVisibility();
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

            // Reaction event handlers
            case 'reaction':
                if (message.data && message.data.emoji && message.data.peerId) {
                    showReactionAnimation(message.data.emoji, message.data.peerId);
                }
                break;

            case 'hand-raised':
                if (message.data && message.data.peerId) {
                    handleHandRaised(message.data.peerId, message.data.username, message.data.raised);
                }
                break;

            case 'lower-hand':
                if (message.data && message.data.peerId === myPeerId) {
                    isHandRaised = false;
                    const handBtn = document.getElementById('raiseHandBtn');
                    if (handBtn) handBtn.classList.remove('active');
                    showAdminNotification('Host lowered your hand');
                }
                break;

            // Poll event handlers
            case 'poll-created':
                if (message.data) {
                    activePoll = message.data;
                    hasVoted = false;
                    showPollUI();
                    showAdminNotification('📊 New poll available!');
                }
                break;

            case 'poll-vote':
                if (message.data && message.data.optionId !== undefined) {
                    handlePollVote(message.data.optionId, message.data.peerId, message.data.username);
                }
                break;

            case 'poll-closed':
                if (activePoll) {
                    activePoll.active = false;
                    showPollUI();
                    showAdminNotification('📊 Poll has been closed');
                }
                break;

            // Q&A event handlers
            case 'question-asked':
                if (message.data) {
                    questions.push(message.data);
                    updateQAUI();
                    if (isHost) {
                        showAdminNotification(`❓ New question from ${message.data.username}`);
                    }
                }
                break;

            case 'question-upvote':
                if (message.data && message.data.questionId) {
                    const question = questions.find(q => q.id === message.data.questionId);
                    if (question && !question.voters.includes(message.data.peerId)) {
                        question.upvotes++;
                        question.voters.push(message.data.peerId);
                        updateQAUI();
                    }
                }
                break;

            case 'question-answered':
                if (message.data && message.data.questionId) {
                    const question = questions.find(q => q.id === message.data.questionId);
                    if (question) {
                        question.answered = true;
                        question.answer = message.data.answer;
                        updateQAUI();
                        showAdminNotification('✅ Question answered');
                    }
                }
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

    // Get the username for this peer
    const username = peerUsernames[peerId] || `Participant ${peerId.substr(-4)}`;

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
        overlay.innerHTML = `<span class="participant-name">${username}</span>`;
        
        videoContainer.appendChild(video);
        videoContainer.appendChild(overlay);
        videoGrid.appendChild(videoContainer);
        
        console.log(`Video element created for peer ${peerId} (${username})`);
    } else {
        // Update existing video element
        const video = videoContainer.querySelector('video');
        if (video && video.srcObject !== stream) {
            video.srcObject = stream;
        }
        
        // Update username in case it changed
        const nameSpan = videoContainer.querySelector('.participant-name');
        if (nameSpan) {
            nameSpan.textContent = username;
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

    // Update the status icon in local video
    updateLocalAudioStatus();
    
    // Update the main control button
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
        const iconOn = micBtn.querySelector('.icon-on');
        const iconOff = micBtn.querySelector('.icon-off');
        
        if (isAudioEnabled) {
            micBtn.classList.add('active');
            if (iconOn) iconOn.style.display = 'block';
            if (iconOff) iconOff.style.display = 'none';
        } else {
            micBtn.classList.remove('active');
            if (iconOn) iconOn.style.display = 'none';
            if (iconOff) iconOff.style.display = 'block';
        }
    }
}

// Update local audio status icon
function updateLocalAudioStatus() {
    const audioStatus = document.getElementById('localAudioStatus');
    if (!audioStatus) return;
    
    if (isAudioEnabled) {
        audioStatus.classList.remove('muted');
        audioStatus.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
        `;
        audioStatus.title = 'Microphone On - Click to mute';
    } else {
        audioStatus.classList.add('muted');
        audioStatus.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
            </svg>
        `;
        audioStatus.title = 'Microphone Muted - Click to unmute';
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

    // Update the status icon in local video
    updateLocalVideoStatus();
    
    // Update the main control button
    const videoBtn = document.getElementById('videoBtn');
    if (videoBtn) {
        const iconOn = videoBtn.querySelector('.icon-on');
        const iconOff = videoBtn.querySelector('.icon-off');
        
        if (isVideoEnabled) {
            videoBtn.classList.add('active');
            if (iconOn) iconOn.style.display = 'block';
            if (iconOff) iconOff.style.display = 'none';
        } else {
            videoBtn.classList.remove('active');
            if (iconOn) iconOn.style.display = 'none';
            if (iconOff) iconOff.style.display = 'block';
        }
    }
}

// Update local video status icon
function updateLocalVideoStatus() {
    const videoStatus = document.getElementById('localVideoStatus');
    if (!videoStatus) return;
    
    if (isVideoEnabled) {
        videoStatus.classList.remove('disabled');
        videoStatus.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
        `;
        videoStatus.title = 'Camera On - Click to turn off';
    } else {
        videoStatus.classList.add('disabled');
        videoStatus.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
            </svg>
        `;
        videoStatus.title = 'Camera Off - Click to turn on';
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
    
    // Clean up annotations when screen sharing stops
    cleanupAnnotations();
    
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
            senderName: myUsername || 'Guest'  // Send actual username
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
    // Use the file-aware version
    displayChatMessageWithFile(messageData, isOwn);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============= FILE SHARING =============

// Handle file selection
function handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Validate and send each file
    Array.from(files).forEach(file => {
        if (validateFile(file)) {
            sendFile(file);
        }
    });
    
    // Clear input
    event.target.value = '';
}

// Validate file before sending
function validateFile(file) {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        showAdminNotification(`❌ File "${file.name}" is too large. Maximum size is 10MB.`);
        return false;
    }
    
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|txt|zip)$/i)) {
        showAdminNotification(`❌ File type not allowed for "${file.name}".`);
        return false;
    }
    
    return true;
}

// Send file through chat
function sendFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const fileData = {
            text: `📎 Shared a file: ${file.name}`,
            timestamp: new Date().toISOString(),
            sender: myPeerId || 'Anonymous',
            senderName: myUsername || 'Guest',
            isFile: true,
            file: {
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target.result // Base64 data
            }
        };
        
        if (chatWebsocket && chatWebsocket.readyState === WebSocket.OPEN) {
            chatWebsocket.send(JSON.stringify(fileData));
            showAdminNotification(`✅ File "${file.name}" sent`);
        } else {
            showAdminNotification('❌ Chat connection not available');
        }
    };
    
    reader.onerror = function() {
        showAdminNotification(`❌ Failed to read file "${file.name}"`);
    };
    
    reader.readAsDataURL(file);
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Download file
function downloadFile(fileName, fileData) {
    try {
        const link = document.createElement('a');
        link.href = fileData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAdminNotification(`✅ Downloaded "${fileName}"`);
    } catch (error) {
        console.error('Download error:', error);
        showAdminNotification('❌ Failed to download file');
    }
}

// Update displayChatMessage to handle files
function displayChatMessageWithFile(messageData, isOwn) {
    const chatMessages = document.getElementById('chatMessages');
    const data = JSON.parse(messageData);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own' : ''}`;
    
    const time = new Date(data.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const displayName = isOwn ? 'You' : (data.senderName || 'Guest');
    
    let content = '';
    
    // Check if it's a file message
    if (data.isFile && data.file) {
        const file = data.file;
        const isImage = file.type.startsWith('image/');
        
        content = `
            <div class="message-sender">${displayName}</div>
            <div class="file-message">
                <div class="file-info">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="file-icon">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div class="file-details">
                        <div class="file-name">${escapeHtml(file.name)}</div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                </div>
                ${isImage ? `<img src="${file.data}" alt="${escapeHtml(file.name)}" class="file-preview" onclick="openFilePreview('${file.data}', '${escapeHtml(file.name)}')">` : ''}
                <button class="btn-download" onclick="downloadFile('${escapeHtml(file.name)}', '${file.data}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                </button>
            </div>
            <div class="message-time">${time}</div>
        `;
    } else {
        // Regular text message
        content = `
            <div class="message-sender">${displayName}</div>
            <div class="message-text">${escapeHtml(data.text)}</div>
            <div class="message-time">${time}</div>
        `;
    }
    
    messageDiv.innerHTML = content;
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

// Open file preview in modal
function openFilePreview(fileData, fileName) {
    const modal = document.createElement('div');
    modal.className = 'file-preview-modal';
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>${escapeHtml(fileName)}</h3>
                <button class="btn-icon" onclick="this.closest('.file-preview-modal').remove()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <img src="${fileData}" alt="${escapeHtml(fileName)}" style="max-width: 100%; max-height: 70vh;">
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="downloadFile('${escapeHtml(fileName)}', '${fileData}')">
                    Download
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ============= SCREEN ANNOTATIONS =============

// Initialize annotation canvas
function initializeAnnotations() {
    if (annotationCanvas) return;
    
    // Find the screen share video container
    const screenShareContainer = document.querySelector('.screen-share-main');
    if (!screenShareContainer) {
        console.warn('No screen share active. Annotations only work during screen sharing.');
        showAdminNotification('⚠️ Start screen sharing first to use annotations');
        return;
    }
    
    // Create canvas overlay
    annotationCanvas = document.createElement('canvas');
    annotationCanvas.id = 'annotationCanvas';
    annotationCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10;
        pointer-events: none;
        display: none;
    `;
    
    // Make sure the screen share container has relative positioning
    screenShareContainer.style.position = 'relative';
    screenShareContainer.appendChild(annotationCanvas);
    
    annotationContext = annotationCanvas.getContext('2d');
    resizeAnnotationCanvas();
    
    // Add event listeners
    window.addEventListener('resize', resizeAnnotationCanvas);
}

// Resize canvas to match window
function resizeAnnotationCanvas() {
    if (!annotationCanvas) return;
    
    // Get the parent container (screen share) dimensions
    const container = annotationCanvas.parentElement;
    if (container) {
        annotationCanvas.width = container.clientWidth;
        annotationCanvas.height = container.clientHeight;
    }
}

// Toggle annotation mode
function toggleAnnotationMode() {
    // Check if screen is being shared
    const screenShareContainer = document.querySelector('.screen-share-main');
    if (!screenShareContainer) {
        showAdminNotification('⚠️ Please start screen sharing first to use annotations');
        return;
    }
    
    if (!annotationCanvas) {
        initializeAnnotations();
        if (!annotationCanvas) return; // Failed to initialize
    }
    
    isAnnotating = !isAnnotating;
    
    const annotateBtn = document.getElementById('annotateBtn');
    
    if (isAnnotating) {
        annotationCanvas.style.display = 'block';
        // Enable pointer events only on the canvas area, not blocking other UI
        annotationCanvas.style.pointerEvents = 'auto';
        // Make sure canvas doesn't block clicks on other UI elements
        annotationCanvas.style.touchAction = 'none';
        document.getElementById('annotationToolbar').classList.remove('hidden');
        setupAnnotationListeners();
        
        // Activate button
        if (annotateBtn) {
            annotateBtn.classList.add('active');
        }
        
        showAdminNotification('🎨 Annotation mode enabled - Draw on screen!');
    } else {
        annotationCanvas.style.display = 'none';
        annotationCanvas.style.pointerEvents = 'none';
        document.getElementById('annotationToolbar').classList.add('hidden');
        removeAnnotationListeners();
        
        // Deactivate button
        if (annotateBtn) {
            annotateBtn.classList.remove('active');
        }
        
        showAdminNotification('Annotation mode disabled');
    }
}

// Setup annotation event listeners
function setupAnnotationListeners() {
    annotationCanvas.addEventListener('mousedown', startDrawing);
    annotationCanvas.addEventListener('mousemove', draw);
    annotationCanvas.addEventListener('mouseup', stopDrawing);
    annotationCanvas.addEventListener('mouseout', stopDrawing);
    
    // Touch support
    annotationCanvas.addEventListener('touchstart', handleTouchStart);
    annotationCanvas.addEventListener('touchmove', handleTouchMove);
    annotationCanvas.addEventListener('touchend', stopDrawing);
}

// Remove annotation event listeners
function removeAnnotationListeners() {
    annotationCanvas.removeEventListener('mousedown', startDrawing);
    annotationCanvas.removeEventListener('mousemove', draw);
    annotationCanvas.removeEventListener('mouseup', stopDrawing);
    annotationCanvas.removeEventListener('mouseout', stopDrawing);
    annotationCanvas.removeEventListener('touchstart', handleTouchStart);
    annotationCanvas.removeEventListener('touchmove', handleTouchMove);
    annotationCanvas.removeEventListener('touchend', stopDrawing);
}

// Start drawing
function startDrawing(e) {
    isDrawing = true;
    const rect = annotationCanvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    
    if (currentTool === 'text') {
        addTextAnnotation(lastX, lastY);
        isDrawing = false;
    } else if (currentTool === 'arrow') {
        // For arrow, we'll draw on mouse up
        // Save the starting point
    }
}

// Draw on canvas
function draw(e) {
    if (!isDrawing) return;
    
    const rect = annotationCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Skip drawing while dragging for arrow tool
    if (currentTool === 'arrow') {
        return;
    }
    
    annotationContext.beginPath();
    annotationContext.moveTo(lastX, lastY);
    annotationContext.lineTo(x, y);
    
    if (currentTool === 'highlighter') {
        annotationContext.strokeStyle = annotationColor;
        annotationContext.globalAlpha = 0.3;
        annotationContext.lineWidth = annotationSize * 3;
    } else if (currentTool === 'eraser') {
        annotationContext.globalCompositeOperation = 'destination-out';
        annotationContext.lineWidth = annotationSize * 3;
    } else {
        annotationContext.strokeStyle = annotationColor;
        annotationContext.globalAlpha = 1;
        annotationContext.lineWidth = annotationSize;
        annotationContext.globalCompositeOperation = 'source-over';
    }
    
    annotationContext.lineCap = 'round';
    annotationContext.lineJoin = 'round';
    annotationContext.stroke();
    
    lastX = x;
    lastY = y;
}

// Stop drawing
function stopDrawing(e) {
    if (isDrawing) {
        // Draw arrow if that's the current tool
        if (currentTool === 'arrow' && e) {
            const rect = annotationCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            drawArrow(lastX, lastY, x, y);
        }
        
        isDrawing = false;
        saveAnnotationState();
    }
}

// Draw arrow helper function
function drawArrow(fromX, fromY, toX, toY) {
    const headLength = 15; // Length of arrow head
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    annotationContext.strokeStyle = annotationColor;
    annotationContext.fillStyle = annotationColor;
    annotationContext.globalAlpha = 1;
    annotationContext.lineWidth = annotationSize;
    annotationContext.globalCompositeOperation = 'source-over';
    
    // Draw the line
    annotationContext.beginPath();
    annotationContext.moveTo(fromX, fromY);
    annotationContext.lineTo(toX, toY);
    annotationContext.stroke();
    
    // Draw the arrow head
    annotationContext.beginPath();
    annotationContext.moveTo(toX, toY);
    annotationContext.lineTo(
        toX - headLength * Math.cos(angle - Math.PI / 6),
        toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    annotationContext.lineTo(
        toX - headLength * Math.cos(angle + Math.PI / 6),
        toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    annotationContext.closePath();
    annotationContext.fill();
}

// Handle touch events
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    annotationCanvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    annotationCanvas.dispatchEvent(mouseEvent);
}

// Select annotation tool
function selectAnnotationTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
}

// Update annotation color
function updateAnnotationColor() {
    annotationColor = document.getElementById('annotationColor').value;
}

function setAnnotationColor(color) {
    annotationColor = color;
    document.getElementById('annotationColor').value = color;
}

// Update annotation size
function updateAnnotationSize() {
    annotationSize = parseInt(document.getElementById('annotationSize').value);
    document.getElementById('sizeValue').textContent = annotationSize;
}

// Add text annotation
function addTextAnnotation(x, y) {
    const text = prompt('Enter text:');
    if (text) {
        annotationContext.font = `${annotationSize * 8}px Arial`;
        annotationContext.fillStyle = annotationColor;
        annotationContext.fillText(text, x, y);
        saveAnnotationState();
    }
}

// Save annotation state for undo
function saveAnnotationState() {
    annotationHistory.push(annotationCanvas.toDataURL());
    if (annotationHistory.length > 20) {
        annotationHistory.shift(); // Keep max 20 states
    }
}

// Undo last annotation
function undoAnnotation() {
    if (annotationHistory.length > 0) {
        annotationHistory.pop(); // Remove current state
        const previousState = annotationHistory[annotationHistory.length - 1];
        
        if (previousState) {
            const img = new Image();
            img.onload = function() {
                annotationContext.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
                annotationContext.drawImage(img, 0, 0);
            };
            img.src = previousState;
        } else {
            clearAllAnnotations();
        }
    }
}

// Clear all annotations
function clearAllAnnotations() {
    if (annotationContext) {
        annotationContext.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        annotationHistory = [];
        showAdminNotification('✅ Annotations cleared');
    }
}

// Clean up annotations (called when screen sharing stops)
function cleanupAnnotations() {
    if (isAnnotating) {
        // Turn off annotation mode
        isAnnotating = false;
        const annotateBtn = document.getElementById('annotateBtn');
        if (annotateBtn) {
            annotateBtn.classList.remove('active');
        }
        document.getElementById('annotationToolbar').classList.add('hidden');
    }
    
    if (annotationCanvas) {
        removeAnnotationListeners();
        annotationCanvas.remove();
        annotationCanvas = null;
        annotationContext = null;
        annotationHistory = [];
    }
}

// Close annotation toolbar
function closeAnnotationToolbar() {
    toggleAnnotationMode();
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

// Copy room link from admin panel
function copyRoomLinkFromAdmin() {
    const roomLink = window.location.href;
    navigator.clipboard.writeText(roomLink).then(() => {
        showAdminNotification('✅ Room link copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showAdminNotification('❌ Failed to copy room link');
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
    
    // Update room info visibility based on role and lock status
    updateRoomInfoVisibility();
}

// Update room info visibility based on host status and room lock
function updateRoomInfoVisibility() {
    const roomIdElement = document.getElementById('roomId');
    const copyLinkBtn = document.querySelector('.btn-copy');
    
    // If room is locked and user is not host, blur/hide sensitive info
    if (isRoomLocked && !isHost) {
        // Blur the room ID
        if (roomIdElement) {
            roomIdElement.style.filter = 'blur(8px)';
            roomIdElement.style.userSelect = 'none';
            roomIdElement.style.pointerEvents = 'none';
            roomIdElement.title = 'Room ID hidden - Room is locked';
        }
        // Hide copy button
        if (copyLinkBtn) {
            copyLinkBtn.style.display = 'none';
        }
    } else {
        // Show room ID normally
        if (roomIdElement) {
            roomIdElement.style.filter = 'none';
            roomIdElement.style.userSelect = 'text';
            roomIdElement.style.pointerEvents = 'auto';
            roomIdElement.title = '';
        }
        // Show copy button
        if (copyLinkBtn) {
            copyLinkBtn.style.display = 'flex';
        }
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
    
    // Clean up annotations when screen sharing stops
    cleanupAnnotations();
    
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
    const toggle = document.getElementById('lockRoomToggle');
    if (!toggle) {
        console.error('Lock Room toggle not found!');
        return;
    }
    
    const isLocked = toggle.checked;
    console.log('Toggling room lock:', isLocked);
    
    // Update toggle visual state
    toggle.parentElement.classList.toggle('active', isLocked);
    
    // Update room header indicator
    const indicator = document.getElementById('roomLockedIndicator');
    if (indicator) {
        indicator.style.display = isLocked ? 'inline' : 'none';
    }
    
    // Update local state
    isRoomLocked = isLocked;
    
    sendSignalingMessage({
        event: isLocked ? 'lock-room' : 'unlock-room',
        data: {}
    });
    
    // Update room info visibility immediately for host
    updateRoomInfoVisibility();
    
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
    
    // Show poll button for host
    const pollBtn = document.getElementById('pollBtn');
    if (pollBtn && isHost) {
        pollBtn.style.display = 'flex';
    }
}

// ============= EMOJI REACTIONS =============

function sendReaction(emoji) {
    // Show reaction locally
    showReactionAnimation(emoji, myPeerId);
    
    // Broadcast to others via WebSocket
    sendSignalingMessage({
        event: 'reaction',
        data: {
            peerId: myPeerId,
            username: myUsername,
            emoji: emoji
        }
    });
}

function showReactionAnimation(emoji, peerId) {
    // Find the video container for the peer
    const container = peerId === myPeerId ? 
        localVideo.parentElement : 
        document.getElementById(`video-${peerId}`);
    
    if (!container) return;
    
    // Create reaction element
    const reaction = document.createElement('div');
    reaction.className = 'reaction-animation';
    reaction.textContent = emoji;
    reaction.style.cssText = `
        position: absolute;
        font-size: 3rem;
        z-index: 100;
        pointer-events: none;
        bottom: 20%;
        left: ${20 + Math.random() * 60}%;
        animation: floatUp 3s ease-out forwards;
    `;
    
    container.style.position = 'relative';
    container.appendChild(reaction);
    
    // Remove after animation
    setTimeout(() => reaction.remove(), 3000);
}

// ============= RAISE HAND =============

function toggleRaiseHand() {
    isHandRaised = !isHandRaised;
    const handBtn = document.getElementById('raiseHandBtn');
    
    if (isHandRaised) {
        if (handBtn) handBtn.classList.add('active');
        showAdminNotification('✋ Hand raised');
        
        // Notify others
        sendSignalingMessage({
            event: 'hand-raised',
            data: {
                peerId: myPeerId,
                username: myUsername,
                raised: true
            }
        });
    } else {
        if (handBtn) handBtn.classList.remove('active');
        showAdminNotification('Hand lowered');
        
        // Notify others
        sendSignalingMessage({
            event: 'hand-raised',
            data: {
                peerId: myPeerId,
                username: myUsername,
                raised: false
            }
        });
    }
}

function handleHandRaised(peerId, username, raised) {
    if (raised) {
        raisedHands.set(peerId, username);
        
        // Show indicator on video
        const container = document.getElementById(`video-${peerId}`);
        if (container && !container.querySelector('.hand-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'hand-indicator';
            indicator.innerHTML = '✋';
            container.appendChild(indicator);
        }
        
        // Notify host
        if (isHost) {
            showAdminNotification(`✋ ${username} raised their hand`);
            updateRaisedHandsList();
        }
    } else {
        raisedHands.delete(peerId);
        
        // Remove indicator
        const container = document.getElementById(`video-${peerId}`);
        if (container) {
            const indicator = container.querySelector('.hand-indicator');
            if (indicator) indicator.remove();
        }
        
        if (isHost) {
            updateRaisedHandsList();
        }
    }
}

function updateRaisedHandsList() {
    const handsList = document.getElementById('raisedHandsList');
    if (!handsList) return;
    
    handsList.innerHTML = '';
    
    if (raisedHands.size === 0) {
        handsList.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 1rem;">No hands raised</p>';
        return;
    }
    
    raisedHands.forEach((username, peerId) => {
        const handItem = document.createElement('div');
        handItem.className = 'hand-item';
        handItem.innerHTML = `
            <span>✋ ${username}</span>
            <button class="btn-icon" onclick="lowerHand('${peerId}')" title="Lower hand">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        `;
        handsList.appendChild(handItem);
    });
}

function lowerHand(peerId) {
    if (!isHost) return;
    
    sendSignalingMessage({
        event: 'lower-hand',
        data: { peerId: peerId }
    });
    
    raisedHands.delete(peerId);
    updateRaisedHandsList();
}

// ============= POLLING =============

function createPoll() {
    if (!isHost) return;
    
    const question = prompt('Enter poll question:');
    if (!question) return;
    
    const optionsStr = prompt('Enter options (comma-separated):');
    if (!optionsStr) return;
    
    const options = optionsStr.split(',').map(o => o.trim()).filter(o => o);
    if (options.length < 2) {
        alert('Please provide at least 2 options');
        return;
    }
    
    activePoll = {
        question: question,
        options: options.map((opt, idx) => ({
            id: idx,
            text: opt,
            votes: 0,
            voters: []
        })),
        active: true
    };
    
    hasVoted = false;
    
    // Broadcast poll to all participants
    sendSignalingMessage({
        event: 'poll-created',
        data: activePoll
    });
    
    showPollUI();
    showAdminNotification('📊 Poll created and sent to participants');
}

function showPollUI() {
    let pollContainer = document.getElementById('pollContainer');
    
    if (!pollContainer) {
        pollContainer = document.createElement('div');
        pollContainer.id = 'pollContainer';
        pollContainer.className = 'poll-container';
        document.body.appendChild(pollContainer);
    }
    
    if (!activePoll) {
        pollContainer.style.display = 'none';
        return;
    }
    
    const totalVotes = activePoll.options.reduce((sum, opt) => sum + opt.votes, 0);
    
    pollContainer.innerHTML = `
        <div class="poll-header">
            <h4>📊 ${activePoll.question}</h4>
            ${isHost ? `<button class="btn-icon" onclick="closePoll()" title="Close poll">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>` : ''}
        </div>
        <div class="poll-options">
            ${activePoll.options.map(opt => {
                const percentage = totalVotes > 0 ? (opt.votes / totalVotes * 100).toFixed(1) : 0;
                const isDisabled = hasVoted || !activePoll.active ? 'disabled' : '';
                return `
                    <button class="poll-option ${isDisabled}" onclick="votePoll(${opt.id})" ${isDisabled}>
                        <div class="poll-option-text">${opt.text}</div>
                        <div class="poll-option-bar" style="width: ${percentage}%"></div>
                        <div class="poll-option-votes">${opt.votes} votes (${percentage}%)</div>
                    </button>
                `;
            }).join('')}
        </div>
        <div class="poll-footer">
            ${hasVoted ? '<span style="color: #22c55e;">✓ You voted</span>' : ''}
            <span>Total votes: ${totalVotes}</span>
        </div>
    `;
    
    pollContainer.style.display = 'block';
}

function votePoll(optionId) {
    if (hasVoted || !activePoll || !activePoll.active) return;
    
    hasVoted = true;
    
    // Send vote to server/host
    sendSignalingMessage({
        event: 'poll-vote',
        data: {
            optionId: optionId,
            peerId: myPeerId,
            username: myUsername
        }
    });
    
    // Update local UI optimistically
    activePoll.options[optionId].votes++;
    showPollUI();
}

function handlePollVote(optionId, peerId, username) {
    if (!activePoll) return;
    
    const option = activePoll.options[optionId];
    if (!option) return;
    
    // Check if user already voted
    const alreadyVoted = activePoll.options.some(opt => opt.voters.includes(peerId));
    if (alreadyVoted) return;
    
    option.votes++;
    option.voters.push(peerId);
    
    showPollUI();
    
    if (isHost) {
        showAdminNotification(`${username} voted on poll`);
    }
}

function closePoll() {
    if (!isHost || !activePoll) return;
    
    activePoll.active = false;
    
    sendSignalingMessage({
        event: 'poll-closed',
        data: {}
    });
    
    showAdminNotification('📊 Poll closed');
    
    setTimeout(() => {
        const pollContainer = document.getElementById('pollContainer');
        if (pollContainer) pollContainer.style.display = 'none';
        activePoll = null;
        hasVoted = false;
    }, 5000);
}

// ============= Q&A MODE =============

function toggleQA() {
    const qaContainer = document.getElementById('qaContainer');
    if (!qaContainer) {
        createQAUI();
    } else {
        qaContainer.style.display = qaContainer.style.display === 'none' ? 'block' : 'none';
    }
}

function createQAUI() {
    const qaContainer = document.createElement('div');
    qaContainer.id = 'qaContainer';
    qaContainer.className = 'qa-container';
    qaContainer.innerHTML = `
        <div class="qa-header">
            <h4>❓ Q&A</h4>
            <button class="btn-icon" onclick="toggleQA()" title="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        <div id="qaQuestions" class="qa-questions"></div>
        <div class="qa-input">
            <input type="text" id="qaInput" placeholder="Ask a question..." />
            <button class="btn-send" onclick="askQuestion()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
            </button>
        </div>
    `;
    
    document.body.appendChild(qaContainer);
    updateQAUI();
}

function askQuestion() {
    const input = document.getElementById('qaInput');
    if (!input || !input.value.trim()) return;
    
    const question = {
        id: ++questionIdCounter,
        peerId: myPeerId,
        username: myUsername,
        question: input.value.trim(),
        upvotes: 0,
        voters: [],
        answered: false,
        answer: null,
        timestamp: Date.now()
    };
    
    questions.push(question);
    input.value = '';
    
    // Broadcast question
    sendSignalingMessage({
        event: 'question-asked',
        data: question
    });
    
    updateQAUI();
}

function upvoteQuestion(questionId) {
    const question = questions.find(q => q.id === questionId);
    if (!question || question.voters.includes(myPeerId)) return;
    
    question.upvotes++;
    question.voters.push(myPeerId);
    
    sendSignalingMessage({
        event: 'question-upvote',
        data: {
            questionId: questionId,
            peerId: myPeerId
        }
    });
    
    updateQAUI();
}

function answerQuestion(questionId) {
    if (!isHost) return;
    
    const question = questions.find(q => q.id === questionId);
    if (!question) return;
    
    const answer = prompt('Enter your answer:');
    if (!answer) return;
    
    question.answered = true;
    question.answer = answer;
    
    sendSignalingMessage({
        event: 'question-answered',
        data: {
            questionId: questionId,
            answer: answer
        }
    });
    
    updateQAUI();
    showAdminNotification('✅ Question answered');
}

function updateQAUI() {
    const qaQuestions = document.getElementById('qaQuestions');
    if (!qaQuestions) return;
    
    if (questions.length === 0) {
        qaQuestions.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 1rem;">No questions yet</p>';
        return;
    }
    
    // Sort by upvotes, then by timestamp
    const sortedQuestions = [...questions].sort((a, b) => {
        if (a.answered !== b.answered) return a.answered ? 1 : -1;
        if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
        return b.timestamp - a.timestamp;
    });
    
    qaQuestions.innerHTML = sortedQuestions.map(q => `
        <div class="qa-item ${q.answered ? 'answered' : ''}">
            <div class="qa-question-header">
                <div class="qa-user">${q.username}</div>
                ${q.answered ? '<span class="qa-answered-badge">✓ Answered</span>' : ''}
            </div>
            <div class="qa-question-text">${q.question}</div>
            ${q.answer ? `<div class="qa-answer"><strong>Answer:</strong> ${q.answer}</div>` : ''}
            <div class="qa-actions">
                <button class="qa-upvote ${q.voters.includes(myPeerId) ? 'voted' : ''}" 
                        onclick="upvoteQuestion(${q.id})" 
                        ${q.voters.includes(myPeerId) ? 'disabled' : ''}>
                    👍 ${q.upvotes}
                </button>
                ${isHost && !q.answered ? `
                    <button class="btn-action-small" onclick="answerQuestion(${q.id})">
                        Answer
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

