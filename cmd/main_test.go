package main

import (
	"testing"
	_ "videochat/internal/handler"
	_ "videochat/internal/server"
	_ "videochat/pkg/chat"
	_ "videochat/pkg/webrtc"
)

func TestImports(t *testing.T) {
	t.Log("All packages import successfully")
}
