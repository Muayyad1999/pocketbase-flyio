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
