package main

import (
	"log"
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// RegisterUserHooks registers custom hooks for user management
func RegisterUserHooks(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// POST endpoint to reset password by admin
		se.Router.POST("/api/custom/reset-password", func(e *core.RequestEvent) error {
			// 1. Check Authorization
			isAuthorized := false

			// e.Auth holds the authenticated record (superuser or regular user)
			if e.Auth != nil {
				// Check for Superuser (collection "_superusers" or IsSuperuser() helper)
				if e.Auth.IsSuperuser() {
					isAuthorized = true
				} else if e.Auth.Collection().Name == "users" {
					// Check for regular user with 'admin' role
					role := e.Auth.GetString("role")
					// Allow 'admin' or 'manager' to reset passwords (case-insensitive)
					if strings.EqualFold(role, "admin") || strings.EqualFold(role, "manager") {
						isAuthorized = true
					}
				}
			}

			if !isAuthorized {
				if e.Auth != nil {
					log.Printf("Auth Fail: ID=%s, Collection=%s, Role=%s, IsSuperuser=%v",
						e.Auth.Id,
						e.Auth.Collection().Name,
						e.Auth.GetString("role"),
						e.Auth.IsSuperuser())
				} else {
					log.Println("Auth Fail: e.Auth is nil")
				}
				return apis.NewForbiddenError("Only admins can perform this action.", nil)
			}

			// 2. Parse Request Data
			data := struct {
				TargetId    string `json:"targetId"`
				NewPassword string `json:"newPassword"`
			}{}

			if err := e.BindBody(&data); err != nil {
				return apis.NewBadRequestError("Invalid request data.", err)
			}

			if data.TargetId == "" {
				return apis.NewBadRequestError("targetId is required.", nil)
			}

			if len(data.NewPassword) < 8 {
				return apis.NewBadRequestError("Password must be at least 8 characters.", nil)
			}

			// 3. Find Target User
			targetRecord, err := app.FindRecordById("users", data.TargetId)
			if err != nil {
				return apis.NewNotFoundError("User not found.", err)
			}

			// 4. Update Password
			// This bypasses the 'oldPassword' check because we are modifying the record directly via DAO
			targetRecord.Set("password", data.NewPassword)
			targetRecord.Set("passwordConfirm", data.NewPassword)

			// 5. Save Record
			if err := app.Save(targetRecord); err != nil {
				log.Printf("Failed to reset password for user %s: %v", data.TargetId, err)
				return apis.NewBadRequestError("Failed to save user record.", err)
			}

			log.Printf("Password reset for user %s by admin/manager %s", data.TargetId, e.Auth.Id)

			return e.JSON(http.StatusOK, map[string]string{
				"message": "Password reset successfully",
			})
		})

		return se.Next()
	})
}
