package handlers

import (
	"encoding/json"
	"log"
	"time"

	"videochat/pkg/chat"
	w "videochat/pkg/webrtc"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/pion/webrtc/v3"
)

// Stream renders the stream viewer page
func Stream(c *fiber.Ctx) error {
	streamUUID := c.Params("ssuid")
	if streamUUID == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Stream UUID is required")
	}

	stream := w.CreateStream(streamUUID)

	return c.Render("stream", fiber.Map{
		"StreamID": streamUUID,
		"Title":    "Live Stream",
		"Viewers":  stream.Peers.GetConnectionCount(),
	}, "layouts/main")
}

// StreamWebSocket handles WebRTC streaming via WebSocket
func StreamWebSocket(c *websocket.Conn) {
	streamUUID := c.Params("ssuid")
	if streamUUID == "" {
		log.Println("Stream UUID is required")
		c.Close()
		return
	}

	stream := w.CreateStream(streamUUID)

	peerConnection, err := webrtc.NewPeerConnection(w.RoomConfig)
	if err != nil {
		log.Printf("Failed to create peer connection: %v", err)
		c.Close()
		return
	}

	stream.Peers.AddPeerConnection(peerConnection, c)

	defer func() {
		stream.Peers.RemovePeerConnection(peerConnection)
		peerConnection.Close()
	}()

	peerConnection.OnTrack(func(remoteTrack *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		log.Printf("Stream track received: %s, Type: %s", remoteTrack.ID(), remoteTrack.Kind())

		localTrack := stream.Peers.AddTrack(remoteTrack)
		if localTrack == nil {
			return
		}

		defer stream.Peers.RemoveTrack(localTrack)

		rtpBuf := make([]byte, 1400)
		for {
			i, _, readErr := remoteTrack.Read(rtpBuf)
			if readErr != nil {
				return
			}

			if _, err := localTrack.Write(rtpBuf[:i]); err != nil {
				return
			}
		}
	})

	peerConnection.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		log.Printf("Stream ICE State: %s", state.String())
	})

	stream.Peers.SignalPeerConnections()

	for {
		var msg map[string]interface{}
		if err := c.ReadJSON(&msg); err != nil {
			break
		}

		event, ok := msg["event"].(string)
		if !ok {
			continue
		}

		switch event {
		case "offer":
			handleStreamOffer(peerConnection, c, msg, stream)
		case "answer":
			handleStreamAnswer(peerConnection, msg)
		case "candidate":
			handleStreamCandidate(peerConnection, msg)
		}
	}
}

func handleStreamOffer(pc *webrtc.PeerConnection, ws *websocket.Conn, msg map[string]interface{}, stream *w.Room) {
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		return
	}

	sdpStr, ok := data["sdp"].(string)
	if !ok {
		return
	}

	if err := pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  sdpStr,
	}); err != nil {
		return
	}

	stream.Peers.ListLock.RLock()
	for _, track := range stream.Peers.TrackLocals {
		pc.AddTrack(track)
	}
	stream.Peers.ListLock.RUnlock()

	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		return
	}

	pc.SetLocalDescription(answer)

	ws.WriteJSON(map[string]interface{}{
		"event": "answer",
		"data":  map[string]interface{}{"sdp": answer.SDP},
	})
}

func handleStreamAnswer(pc *webrtc.PeerConnection, msg map[string]interface{}) {
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		return
	}

	sdpStr, ok := data["sdp"].(string)
	if !ok {
		return
	}

	pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  sdpStr,
	})
}

func handleStreamCandidate(pc *webrtc.PeerConnection, msg map[string]interface{}) {
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		return
	}

	candidateStr, ok := data["candidate"].(string)
	if !ok {
		return
	}

	var candidate webrtc.ICECandidateInit
	json.Unmarshal([]byte(candidateStr), &candidate)
	pc.AddICECandidate(candidate)
}

// StreamChatWebSocket handles chat for a stream
func StreamChatWebSocket(c *websocket.Conn) {
	streamUUID := c.Params("ssuid")
	if streamUUID == "" {
		c.Close()
		return
	}

	stream, exists := w.GetStream(streamUUID)
	if !exists {
		c.Close()
		return
	}

	client := chat.NewClient(stream.Hub, c)
	stream.Hub.Register <- client

	go client.WritePump()
	client.ReadPump()
}

// StreamViewerWebSocket provides viewer count updates
func StreamViewerWebSocket(c *websocket.Conn) {
	streamUUID := c.Params("ssuid")
	if streamUUID == "" {
		c.Close()
		return
	}

	stream := w.CreateStream(streamUUID)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if err := c.WriteJSON(map[string]interface{}{
			"event": "viewer_count",
			"data":  map[string]interface{}{"count": stream.Peers.GetConnectionCount()},
		}); err != nil {
			return
		}
	}
}
