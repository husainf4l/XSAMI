package webrtc

// Stream is an alias for Room as they share the same structure
// Streams are used for one-to-many broadcasting (like live streaming)
// while Rooms are used for many-to-many conferencing
type Stream = Room

