package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"videochat/pkg/chat"
	w "videochat/pkg/webrtc"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
	"github.com/pion/webrtc/v3"
)

// RoomCreate creates a new room and redirects to it
func RoomCreate(c *fiber.Ctx) error {
	newUUID := uuid.New()
	return c.Redirect(fmt.Sprintf("/room/%s", newUUID.String()))
}

// Room renders the room page
func Room(c *fiber.Ctx) error {
	roomUUID := c.Params("uuid")
	if roomUUID == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Room UUID is required")
	}

	// Ensure room exists
	room := w.CreateRoom(roomUUID)
	
	return c.Render("room", fiber.Map{
		"RoomID": roomUUID,
		"Title":  "Video Conference Room",
		"Users":  room.Peers.GetConnectionCount(),
	}, "layouts/main")
}

// RoomWebSocket handles WebRTC signaling via WebSocket
func RoomWebSocket(c *websocket.Conn) {
	roomUUID := c.Params("uuid")
	if roomUUID == "" {
		log.Println("Room UUID is required")
		c.Close()
		return
	}

	room := w.CreateRoom(roomUUID)
	
	// Generate a unique peer ID for this connection
	peerID := uuid.New().String()
	
	log.Printf("Peer %s joining room %s", peerID, roomUUID)

	// Check if this is the first person (make them host)
	isFirstPerson := len(room.Peers.Connections) == 0
	if isFirstPerson {
		room.SetHost(peerID)
	} else {
		// Check if room is locked (only if not the first person/host)
		if room.IsRoomLocked() {
			log.Printf("Room %s is locked. Peer %s denied entry.", roomUUID, peerID)
			// Send locked message
			lockedMsg := map[string]interface{}{
				"event": "room-locked",
				"data": map[string]interface{}{
					"message": "This room is locked and not accepting new participants",
				},
			}
			c.WriteJSON(lockedMsg)
			c.Close()
			return
		}
	}

	// Send current list of peers to the new peer
	room.Peers.ListLock.RLock()
	existingPeers := make([]string, 0)
	for _, conn := range room.Peers.Connections {
		if conn.PeerID != "" && conn.PeerID != peerID {
			existingPeers = append(existingPeers, conn.PeerID)
		}
	}
	room.Peers.ListLock.RUnlock()

	// Send peers list and role info to new joiner
	peersMsg := map[string]interface{}{
		"event": "peers",
		"data": map[string]interface{}{
			"peers":    existingPeers,
			"yourId":   peerID,
			"isHost":   room.IsHost(peerID),
			"hostId":   room.GetHostPeerID(),
		},
	}
	c.WriteJSON(peersMsg)

	// Create new peer connection
	peerConnection, err := webrtc.NewPeerConnection(w.RoomConfig)
	if err != nil {
		log.Printf("Failed to create peer connection: %v", err)
		c.Close()
		return
	}

	// Add this peer to the room with peer ID
	room.Peers.AddPeerConnectionWithID(peerConnection, c, peerID)
	
	// Notify all other peers about the new peer
	joinMsg := map[string]interface{}{
		"event": "peer-joined",
		"data": map[string]interface{}{
			"peerId": peerID,
		},
	}
	room.Peers.BroadcastToOthers(joinMsg, peerID)

	defer func() {
		// Notify others that peer left
		leaveMsg := map[string]interface{}{
			"event": "peer-left",
			"data": map[string]interface{}{
				"peerId": peerID,
			},
		}
		room.Peers.BroadcastToOthers(leaveMsg, peerID)
		
		room.Peers.RemovePeerConnection(peerConnection)
		peerConnection.Close()
		log.Printf("Peer %s left room %s", peerID, roomUUID)
	}()

	// Handle incoming tracks (video/audio from this peer)
	peerConnection.OnTrack(func(remoteTrack *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		log.Printf("Track received from peer %s: %s, Type: %s", peerID, remoteTrack.ID(), remoteTrack.Kind())

		// Create a local track to relay this stream to other peers
		localTrack := room.Peers.AddTrack(remoteTrack)
		if localTrack == nil {
			return
		}

		defer room.Peers.RemoveTrack(localTrack)

		// Read RTP packets and relay to local track
		rtpBuf := make([]byte, 1400)
		for {
			i, _, readErr := remoteTrack.Read(rtpBuf)
			if readErr != nil {
				return
			}

			// Write RTP packet to all other peers
			if _, err := localTrack.Write(rtpBuf[:i]); err != nil {
				return
			}
		}
	})

	// Handle ICE connection state changes
	peerConnection.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		log.Printf("Peer %s ICE Connection State: %s", peerID, state.String())
		
		if state == webrtc.ICEConnectionStateFailed || 
		   state == webrtc.ICEConnectionStateClosed {
			room.Peers.RemovePeerConnection(peerConnection)
		}
	})

	// Handle peer connection state changes
	peerConnection.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		log.Printf("Peer %s Connection State: %s", peerID, state.String())
	})

	// Handle WebSocket messages (SDP, ICE candidates)
	for {
		var msg map[string]interface{}
		if err := c.ReadJSON(&msg); err != nil {
			log.Printf("WebSocket read error from peer %s: %v", peerID, err)
			break
		}

		event, ok := msg["event"].(string)
		if !ok {
			log.Println("Invalid message format")
			continue
		}

		// Add sender peer ID to the message
		if data, ok := msg["data"].(map[string]interface{}); ok {
			// Messages are forwarded to target peer
			if targetPeerID, hasTarget := data["targetPeerId"].(string); hasTarget {
				// This is a direct message to another peer
				log.Printf("Forwarding %s from %s to %s", event, peerID, targetPeerID)
				data["peerId"] = peerID // Add sender ID
				delete(data, "targetPeerId") // Remove target from forwarded message
				
				forwardMsg := map[string]interface{}{
					"event": event,
					"data":  data,
				}
				
				room.Peers.SendToPeer(forwardMsg, targetPeerID)
				continue
			}
		}

		// Handle messages for the server
		switch event {
		case "join":
			// Already handled above
			log.Printf("Peer %s joined", peerID)
			
		case "request-screen-share":
			// Participant requesting screen share permission
			if room.IsHost(peerID) {
				// Host can always share
				room.GrantScreenShare(peerID)
				responseMsg := map[string]interface{}{
					"event": "screen-share-response",
					"data": map[string]interface{}{
						"approved": true,
					},
				}
				room.Peers.SendToPeer(responseMsg, peerID)
			} else {
				// Forward request to host
				hostID := room.GetHostPeerID()
				if hostID != "" {
					if msgData, ok := msg["data"].(map[string]interface{}); ok {
						requestMsg := map[string]interface{}{
							"event": "screen-share-request",
							"data": map[string]interface{}{
								"peerId":   peerID,
								"peerName": msgData["peerName"],
							},
						}
						room.Peers.SendToPeer(requestMsg, hostID)
					}
				}
			}
			
		case "approve-screen-share":
			// Host approving screen share request
			if room.IsHost(peerID) {
				if data, ok := msg["data"].(map[string]interface{}); ok {
					if targetPeerID, ok := data["peerId"].(string); ok {
						room.GrantScreenShare(targetPeerID)
						
						// Notify the requester
						responseMsg := map[string]interface{}{
							"event": "screen-share-response",
							"data": map[string]interface{}{
								"approved": true,
							},
						}
						room.Peers.SendToPeer(responseMsg, targetPeerID)
					}
				}
			}
			
		case "deny-screen-share":
			// Host denying screen share request
			if room.IsHost(peerID) {
				if data, ok := msg["data"].(map[string]interface{}); ok {
					if targetPeerID, ok := data["peerId"].(string); ok {
						// Notify the requester
						responseMsg := map[string]interface{}{
							"event": "screen-share-response",
							"data": map[string]interface{}{
								"approved": false,
							},
						}
						room.Peers.SendToPeer(responseMsg, targetPeerID)
					}
				}
			}
			
		case "revoke-screen-share":
			// Host revoking someone's screen share
			if room.IsHost(peerID) {
				if data, ok := msg["data"].(map[string]interface{}); ok {
					if targetPeerID, ok := data["peerId"].(string); ok {
						room.RevokeScreenShare(targetPeerID)
						
						// Notify the user
						responseMsg := map[string]interface{}{
							"event": "screen-share-revoked",
							"data": map[string]interface{}{},
						}
						room.Peers.SendToPeer(responseMsg, targetPeerID)
					}
				}
			}
			
		case "screen-share-started":
			// Broadcast to all other peers that someone started sharing
			if data, ok := msg["data"].(map[string]interface{}); ok {
				data["peerId"] = peerID
				broadcastMsg := map[string]interface{}{
					"event": "screen-share-started",
					"data":  data,
				}
				room.Peers.BroadcastToOthers(broadcastMsg, peerID)
				log.Printf("Peer %s started screen sharing", peerID)
			}
			
		case "screen-share-stopped":
			// Broadcast to all other peers that someone stopped sharing
			broadcastMsg := map[string]interface{}{
				"event": "screen-share-stopped",
				"data": map[string]interface{}{
					"peerId": peerID,
				},
			}
			room.Peers.BroadcastToOthers(broadcastMsg, peerID)
			log.Printf("Peer %s stopped screen sharing", peerID)
			
		// ============= CO-HOST CONTROLS =============
		case "add-cohost":
			if room.IsHostOrCoHost(peerID) {
				if data, ok := msg["data"].(map[string]interface{}); ok {
					if targetPeerID, ok := data["peerId"].(string); ok {
						room.AddCoHost(targetPeerID)
						
						// Notify the new co-host
						notification := map[string]interface{}{
							"event": "cohost-promoted",
							"data": map[string]interface{}{
								"message": "You have been promoted to co-host",
							},
						}
						room.Peers.SendToPeer(notification, targetPeerID)
						
						// Broadcast to all
						broadcast := map[string]interface{}{
							"event": "cohost-added",
							"data": map[string]interface{}{
								"peerId": targetPeerID,
							},
						}
						room.Peers.BroadcastToOthers(broadcast, peerID)
					}
				}
			}
			
		case "remove-cohost":
			if room.IsHost(peerID) {
				if data, ok := msg["data"].(map[string]interface{}); ok {
					if targetPeerID, ok := data["peerId"].(string); ok {
						room.RemoveCoHost(targetPeerID)
						
						notification := map[string]interface{}{
							"event": "cohost-demoted",
							"data": map[string]interface{}{},
						}
						room.Peers.SendToPeer(notification, targetPeerID)
						
						broadcast := map[string]interface{}{
							"event": "cohost-removed",
							"data": map[string]interface{}{
								"peerId": targetPeerID,
							},
						}
						room.Peers.BroadcastToOthers(broadcast, peerID)
					}
				}
			}
			
		// ============= ROOM SECURITY =============
		case "lock-room":
			if room.IsHostOrCoHost(peerID) {
				room.LockRoom()
				broadcast := map[string]interface{}{
					"event": "room-locked",
					"data": map[string]interface{}{
						"message": "Room has been locked by host",
					},
				}
				room.Peers.BroadcastToAll(broadcast)
			}
			
		case "unlock-room":
			if room.IsHostOrCoHost(peerID) {
				room.UnlockRoom()
				broadcast := map[string]interface{}{
					"event": "room-unlocked",
					"data": map[string]interface{}{},
				}
				room.Peers.BroadcastToAll(broadcast)
			}
			
		// ============= CHAT CONTROLS =============
		case "disable-chat":
			if room.IsHostOrCoHost(peerID) {
				room.DisableChat()
				broadcast := map[string]interface{}{
					"event": "chat-disabled",
					"data": map[string]interface{}{
						"message": "Chat has been disabled by host",
					},
				}
				room.Peers.BroadcastToAll(broadcast)
			}
			
		case "enable-chat":
			if room.IsHostOrCoHost(peerID) {
				room.EnableChat()
				broadcast := map[string]interface{}{
					"event": "chat-enabled",
					"data": map[string]interface{}{},
				}
				room.Peers.BroadcastToAll(broadcast)
			}
			
		// ============= MUTE CONTROLS =============
		case "mute-participant":
			if room.IsHostOrCoHost(peerID) {
				if data, ok := msg["data"].(map[string]interface{}); ok {
					if targetPeerID, ok := data["peerId"].(string); ok {
						room.MuteParticipant(targetPeerID)
						
						notification := map[string]interface{}{
							"event": "muted-by-host",
							"data": map[string]interface{}{
								"message": "You have been muted by the host",
							},
						}
						room.Peers.SendToPeer(notification, targetPeerID)
					}
				}
			}
			
		case "unmute-participant":
			if room.IsHostOrCoHost(peerID) {
				if data, ok := msg["data"].(map[string]interface{}); ok {
					if targetPeerID, ok := data["peerId"].(string); ok {
						room.UnmuteParticipant(targetPeerID)
						
						notification := map[string]interface{}{
							"event": "unmuted-by-host",
							"data": map[string]interface{}{},
						}
						room.Peers.SendToPeer(notification, targetPeerID)
					}
				}
			}
			
		case "mute-all":
			if room.IsHostOrCoHost(peerID) {
				room.MuteAll()
				broadcast := map[string]interface{}{
					"event": "all-muted",
					"data": map[string]interface{}{
						"message": "All participants have been muted",
					},
				}
				room.Peers.BroadcastToAll(broadcast)
			}
			
		case "unmute-all":
			if room.IsHostOrCoHost(peerID) {
				room.UnmuteAll()
				broadcast := map[string]interface{}{
					"event": "all-unmuted",
					"data": map[string]interface{}{},
				}
				room.Peers.BroadcastToAll(broadcast)
			}
			
		// ============= WAITING ROOM =============
		case "admit-participant":
			if room.IsHostOrCoHost(peerID) {
				if data, ok := msg["data"].(map[string]interface{}); ok {
					if targetPeerID, ok := data["peerId"].(string); ok {
						participant := room.AdmitFromWaitingRoom(targetPeerID)
						if participant != nil {
							notification := map[string]interface{}{
								"event": "admitted-to-room",
								"data": map[string]interface{}{
									"message": "You have been admitted to the meeting",
								},
							}
							room.Peers.SendToPeer(notification, targetPeerID)
						}
					}
				}
			}
			
		case "deny-participant":
			if room.IsHostOrCoHost(peerID) {
				if data, ok := msg["data"].(map[string]interface{}); ok {
					if targetPeerID, ok := data["peerId"].(string); ok {
						room.RemoveFromWaitingRoom(targetPeerID)
						// Connection will be closed
					}
				}
			}
			
		case "get-waiting-room":
			if room.IsHostOrCoHost(peerID) {
				participants := room.GetWaitingParticipants()
				response := map[string]interface{}{
					"event": "waiting-room-list",
					"data": map[string]interface{}{
						"participants": participants,
					},
				}
				c.WriteJSON(response)
			}
			
		// ============= RECORDING =============
		case "start-recording":
			if room.IsHostOrCoHost(peerID) {
				room.StartRecording()
				broadcast := map[string]interface{}{
					"event": "recording-started",
					"data": map[string]interface{}{
						"message": "This meeting is being recorded",
					},
				}
				room.Peers.BroadcastToAll(broadcast)
			}
			
		case "stop-recording":
			if room.IsHostOrCoHost(peerID) {
				duration := room.StopRecording()
				broadcast := map[string]interface{}{
					"event": "recording-stopped",
					"data": map[string]interface{}{
						"duration": duration.String(),
					},
				}
				room.Peers.BroadcastToAll(broadcast)
			}
			
		// ============= REMOVE PARTICIPANT =============
		case "remove-participant":
			if room.IsHostOrCoHost(peerID) {
				if data, ok := msg["data"].(map[string]interface{}); ok {
					if targetPeerID, ok := data["peerId"].(string); ok {
						notification := map[string]interface{}{
							"event": "removed-from-room",
							"data": map[string]interface{}{
								"message": "You have been removed from the meeting",
							},
						}
						room.Peers.SendToPeer(notification, targetPeerID)
						
						// Remove the peer connection
						room.Peers.RemovePeer(targetPeerID)
					}
				}
			}
			
		// ============= RAISED HANDS =============
		case "raise-hand":
			// Add participant to raised hands list
			room.RaiseHand(peerID)
			
			// Broadcast to all participants
			broadcast := map[string]interface{}{
				"event": "hand-raised",
				"data": map[string]interface{}{
					"peerId": peerID,
					"timestamp": time.Now().Unix(),
				},
			}
			room.Peers.BroadcastToAll(broadcast)
			log.Printf("Hand raised by peer %s", peerID)
			
		case "lower-hand":
			// Remove participant from raised hands list
			room.LowerHand(peerID)
			
			// Broadcast to all participants
			broadcast := map[string]interface{}{
				"event": "hand-lowered",
				"data": map[string]interface{}{
					"peerId": peerID,
				},
			}
			room.Peers.BroadcastToAll(broadcast)
			log.Printf("Hand lowered by peer %s", peerID)
			
		case "clear-all-hands":
			// Host/co-host can clear all raised hands
			if room.IsHostOrCoHost(peerID) {
				room.ClearAllHands()
				
				broadcast := map[string]interface{}{
					"event": "all-hands-cleared",
					"data": map[string]interface{}{
						"message": "All hands have been cleared",
					},
				}
				room.Peers.BroadcastToAll(broadcast)
				log.Println("All hands cleared")
			}
			
		// ============= REACTIONS =============
		case "reaction":
			// Broadcast reaction to all participants
			if data, ok := msg["data"].(map[string]interface{}); ok {
				emoji, hasEmoji := data["emoji"].(string)
				if hasEmoji {
					broadcast := map[string]interface{}{
						"event": "reaction",
						"data": map[string]interface{}{
							"peerId": peerID,
							"emoji":  emoji,
						},
					}
					room.Peers.BroadcastToAll(broadcast)
					log.Printf("Reaction %s from peer %s", emoji, peerID)
				}
			}
		}
	}
}

// handleOffer processes an SDP offer from a peer
func handleOffer(pc *webrtc.PeerConnection, ws *websocket.Conn, msg map[string]interface{}, room *w.Room) {
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		log.Println("Invalid offer data")
		return
	}

	sdpStr, ok := data["sdp"].(string)
	if !ok {
		log.Println("Invalid SDP in offer")
		return
	}

	// Set remote description
	if err := pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  sdpStr,
	}); err != nil {
		log.Printf("Failed to set remote description: %v", err)
		return
	}

	// Add all existing tracks to this peer
	room.Peers.ListLock.RLock()
	for _, track := range room.Peers.TrackLocals {
		if _, err := pc.AddTrack(track); err != nil {
			log.Printf("Failed to add track: %v", err)
		}
	}
	room.Peers.ListLock.RUnlock()

	// Create answer
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		log.Printf("Failed to create answer: %v", err)
		return
	}

	// Set local description
	if err := pc.SetLocalDescription(answer); err != nil {
		log.Printf("Failed to set local description: %v", err)
		return
	}

	// Send answer back
	response := map[string]interface{}{
		"event": "answer",
		"data": map[string]interface{}{
			"sdp": answer.SDP,
		},
	}

	if err := ws.WriteJSON(response); err != nil {
		log.Printf("Failed to send answer: %v", err)
	}
}

// handleAnswer processes an SDP answer from a peer
func handleAnswer(pc *webrtc.PeerConnection, msg map[string]interface{}) {
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		log.Println("Invalid answer data")
		return
	}

	sdpStr, ok := data["sdp"].(string)
	if !ok {
		log.Println("Invalid SDP in answer")
		return
	}

	if err := pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  sdpStr,
	}); err != nil {
		log.Printf("Failed to set remote description: %v", err)
	}
}

// handleCandidate processes an ICE candidate from a peer
func handleCandidate(pc *webrtc.PeerConnection, msg map[string]interface{}) {
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		log.Println("Invalid candidate data")
		return
	}

	candidateStr, ok := data["candidate"].(string)
	if !ok {
		log.Println("Invalid candidate string")
		return
	}

	var candidate webrtc.ICECandidateInit
	if err := json.Unmarshal([]byte(candidateStr), &candidate); err != nil {
		log.Printf("Failed to unmarshal candidate: %v", err)
		return
	}

	if err := pc.AddICECandidate(candidate); err != nil {
		log.Printf("Failed to add ICE candidate: %v", err)
	}
}

// RoomChat handles the chat websocket for a room
func RoomChatWebSocket(c *websocket.Conn) {
	roomUUID := c.Params("uuid")
	if roomUUID == "" {
		c.Close()
		return
	}

	room, exists := w.GetRoom(roomUUID)
	if !exists {
		c.Close()
		return
	}

	client := chat.NewClient(room.Hub, c)
	room.Hub.Register <- client

	go client.WritePump()
	client.ReadPump()
}

// RoomViewerWebSocket provides viewer count updates
func RoomViewerWebSocket(c *websocket.Conn) {
	roomUUID := c.Params("uuid")
	if roomUUID == "" {
		c.Close()
		return
	}

	room := w.CreateRoom(roomUUID)

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			count := room.Peers.GetConnectionCount()
			msg := map[string]interface{}{
				"event": "viewer_count",
				"data": map[string]interface{}{
					"count": count,
				},
			}
			if err := c.WriteJSON(msg); err != nil {
				return
			}
		}
	}
}
