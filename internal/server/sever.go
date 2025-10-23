package server

import(
	"flag"
	"os"
	"time"
	"videochat/internal/handler"
	w "videochat/pkg/webRTC"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/template/html/v2"
	"github.com/gofiber/websocket/v2"
)


var (
	addr = flag.String("addr", ":" + os.Getenv("PORT"),"")
	cert = flag.String("cert","","")
	key = flag.String("key","","")
)

func Run() error {
	flag.Parse()

	if *addr == ":" {
		*addr = ":8080"
	}
	engine := html.New("./views",".html")
	app := fiber.New(fiber.Config{Views: engine,})
	app.Use(logger.New())
	app.Use(cors.New())

	app.Get("/", handlers.Welcome)
	app.Get("/room/create", handlers.RoomCreate)
	app.Get("/room/uuid", handlers.Room)
	app.Get("/room/:uuid/websocket",websocket.New(handlers.RoomWebSocket, websocket.Config{
		HandshakeTimeout: 10 * time.Second,
	}))
	app.Get("/room/:uuid", handlers.RoomChat)
	app.Get("/room/:uuid/chat/websocket", websocket.New(handlers.RoomChatWebSocket))
	app.Get("/room/:uuid/viewer/websocket", websocket.New(handlers.RoomViewerWebSocket))
	app.Get("/stream/:ssuid", handlers.Stream)
	app.Get("/stream/:ssuid/websocket", websocket.New(handlers.StreamWebSocket, websocket.Config{HandshakeTimeout: 10 * time.Second,}))
	app.Get("/stream/:ssuid/chat/websocket", websocket.New(handlers.StreamChatWebSocket))
	app.Get("/stream/:ssuid/viewer/websocket", websocket.New(handlers.StreamViewerWebSocket))
	app.Static("/", "./assets")

	w.Rooms = make(map[string]*w.Stream)
	w.Streams = make(map[string]*w.Stream)
	go dispatchkeyFrames()
	if *cert != "" && *key != "" {
		return app.ListenTLS(*addr,*cert,*key)
	}
	return app.Listen(*addr)

	
}
func dispatchkeyFrames() {
	for range time.Tick(3 * time.Second) {
		for _, room := range w.Rooms {
			room.Peers.DispatchKeyFrames()
		}
	}
}
