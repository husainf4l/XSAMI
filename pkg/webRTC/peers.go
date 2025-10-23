type Room struct {
	Peers *Peers
	hub *chat.Hub
}

type Peers struct {
	Listlock sync.RWMutex
	connections []peerConnectionState
	TrackLockals map[string]*webRTC.TrackLocalStaticRTP
}


func (p *Peers) DispatchKeyFrames() {
	for _, peer := range p.List {
		peer.SendKeyFrame()
	}
}