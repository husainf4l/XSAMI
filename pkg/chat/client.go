package chat

import (
	"time"
	"github.com/fasthttp/websocket"

)

const(
	writeWait = 10 // seconds
	pongWait = 60 // seconds
	pingPeriod = (pongWait * 9) / 10
	maxMessageSize = 512
)

type Client struct {
	hub  *Hub
	Conn *WebSocket.Conn
	send chan []byte
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.Conn.Close()
	}()
}
	func(c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	}

func peerchatConn(){
	
}