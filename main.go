// This is a placeholder main.go for local development reference.
// The actual PocketBase application is built from the pb_hooks/ directory.
// See pb_hooks/main.go for the production entry point.

package main

import (
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	app := pocketbase.New()

	// Serve static files from pb_public directory
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), false))
		return e.Next()
	})

	// Start the PocketBase server
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
