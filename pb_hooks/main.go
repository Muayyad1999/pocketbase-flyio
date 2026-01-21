// PocketBase Main Entry Point with Audit Hooks
// This file serves as the main entry point for PocketBase with custom hooks
//
// To use these hooks:
// 1. Build PocketBase with: go build -o pocketbase
// 2. Run: ./pocketbase serve
//
// Or during development:
//   go run . serve

package main

import (
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

func main() {
	app := pocketbase.New()

	// Register migration command for auto-migrations
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: true,
	})

	// Add Fly-Client-IP to trusted headers to fix IP spoofing warning
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		settings := app.Settings()

		// Check if Fly-Client-IP is already in the trusted headers
		hasFlyHeader := false
		for _, h := range settings.TrustedProxy.Headers {
			if h == "Fly-Client-IP" {
				hasFlyHeader = true
				break
			}
		}

		// If not present, add it and save
		if !hasFlyHeader {
			log.Println("Configuring TrustedProxy headers for Fly.io...")
			settings.TrustedProxy.Headers = append(settings.TrustedProxy.Headers, "Fly-Client-IP")

			// Also ensure UseLeftmostIP is false implies we trust the specific header content provided by Fly?
			// Default is usually fine.

			if err := app.Save(settings); err != nil {
				log.Printf("Warning: Failed to save trusted proxy settings: %v", err)
				// Don't block startup, just warn
			}
		}

		return e.Next()
	})

	// Register audit logging hooks
	RegisterAuditHooks(app)

	// Serve static files from pb_public directory
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		// serves static files from the provided public dir (if exists)
		e.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), false))
		return e.Next()
	})

	// Start the PocketBase server
	if err := app.Start(); err != nil {
		log.Fatal(err)
		os.Exit(1)
	}
}
