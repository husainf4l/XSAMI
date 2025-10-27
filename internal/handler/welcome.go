package handlers

import (
"github.com/gofiber/fiber/v2"
)

// Welcome renders the home page
func Welcome(c *fiber.Ctx) error {
return c.Render("welcome", fiber.Map{
"Title": "XSAMI - Video Conferencing",
}, "layouts/main")
}
