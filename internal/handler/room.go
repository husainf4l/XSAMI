package handlers

import (
	"fmt"
	"os"
	"time"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
)

func RoomCreate(c *fiber.Ctx) error {
	newUUID := uuid.New()
	return c.Redirect(fmt.Sprintf("/room/%s", newUUID.String()))
}
func Room(c *fiber.Ctx) error {
	uuid := c.Params("uuid")
	if uuid == "" {
		c.Status(400)
		return nil
	}
uuid,suuid,_ :=createOrGetRoom(uuid)


}
func RoomWebSocket(c *websocket.Conn) {
	uuid := c.Params("uuid")
	if uuid == "" {
		c.Close()
		return
	}

	room := createOrGetRoom(uuid)

}

func createOrGetRoom(uuid string) (*Room, string, error) {
}
