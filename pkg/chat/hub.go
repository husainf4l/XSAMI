package chat

type Hub struct {
	client   map[*Client]bool
	broadcast chan []byte
	register   chan *Client
	unregister chan *Client
}