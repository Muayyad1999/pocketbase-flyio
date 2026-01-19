// PocketBase Hooks for Automatic Audit Logging
// Place this file in your PocketBase pb_hooks directory
// The hooks will automatically log all CUD operations to the audit_logs collection

package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// Collections to exclude from audit logging
var excludedCollections = map[string]bool{
	"audit_logs":  true, // Don't audit the audit logs themselves
	"sessions":    true, // Session management is internal
	"backup_logs": true, // Backup logs are already audit-like
}

// Collections that require special handling
var sensitiveCollections = map[string]bool{
	"users":            true,
	"employees":        true,
	"payroll_entries":  true,
	"receipts":         true,
	"salary_payments":  true,
}

// hashData creates a SHA256 hash of the data for integrity verification
func hashData(data map[string]any) string {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return ""
	}
	hash := sha256.Sum256(jsonBytes)
	return fmt.Sprintf("%x", hash)
}

// sanitizeData removes sensitive fields from data before logging
func sanitizeData(data map[string]any, collection string) map[string]any {
	sanitized := make(map[string]any)
	
	// Fields to always exclude
	sensitiveFields := map[string]bool{
		"password":     true,
		"tokenKey":     true,
		"passwordHash": true,
	}
	
	for key, value := range data {
		if sensitiveFields[key] {
			sanitized[key] = "[REDACTED]"
		} else {
			sanitized[key] = value
		}
	}
	
	return sanitized
}

// calculateChanges computes the difference between old and new data
func calculateChanges(oldData, newData map[string]any) map[string]any {
	changes := make(map[string]any)
	
	// Check for modified and new fields
	for key, newVal := range newData {
		oldVal, exists := oldData[key]
		if !exists {
			changes[key] = map[string]any{"old": nil, "new": newVal}
		} else if fmt.Sprintf("%v", oldVal) != fmt.Sprintf("%v", newVal) {
			changes[key] = map[string]any{"old": oldVal, "new": newVal}
		}
	}
	
	// Check for deleted fields
	for key, oldVal := range oldData {
		if _, exists := newData[key]; !exists {
			changes[key] = map[string]any{"old": oldVal, "new": nil}
		}
	}
	
	return changes
}

// Get user info from the event
// In v0.36, Auth record is available directly on RequestEvent
func getUserInfo(e *core.RecordRequestEvent) (string, string) {
	userId := ""
	username := "guest"

	if e.Auth != nil {
		userId = e.Auth.Id
		if name, ok := e.Auth.Get("username").(string); ok && name != "" {
			username = name
		} else if name, ok := e.Auth.Get("full_name").(string); ok && name != "" {
			username = name
		} else if email, ok := e.Auth.Get("email").(string); ok && email != "" {
			username = email
		} else {
			username = e.Auth.Id
		}
	} else {
		// Admin access handling removed or different in v0.36
		// For now, treat as guest if not a record auth
		if e.Auth == nil {
			username = "guest (or admin)"
		}
	}

	return username, userId
}

// createAuditLog creates an audit log entry
// Updated for v0.36 App API
func createAuditLog(app core.App, action, collection, recordId, username, userId string, changes, metadata map[string]any, oldHash, newHash string, severity string) {
	auditCollection, err := app.FindCollectionByNameOrId("audit_logs")
	if err != nil {
		log.Printf("Audit: Failed to find audit_logs collection: %v", err)
		return
	}
	
	record := core.NewRecord(auditCollection)
	record.Set("action", action)
	record.Set("collection", collection)
	record.Set("record_id", recordId)
	record.Set("username", username)
	record.Set("user_id", userId)
	record.Set("timestamp", time.Now().UTC())
	record.Set("severity", severity)
	
	if changes != nil && len(changes) > 0 {
		record.Set("changes", changes)
	}
	
	if metadata != nil && len(metadata) > 0 {
		record.Set("metadata", metadata)
	}
	
	if oldHash != "" {
		record.Set("old_data_hash", oldHash)
	}
	
	if newHash != "" {
		record.Set("new_data_hash", newHash)
	}
	
	if err := app.Save(record); err != nil {
		log.Printf("Audit: Failed to create audit log: %v", err)
	}
}

// getSeverity determines the severity level based on collection
func getSeverity(action, collection string) string {
	switch action {
	case "delete":
		return "warning"
	case "create", "update":
		if sensitiveCollections[collection] {
			return "info"
		}
		return "info"
	default:
		return "info"
	}
}

// RegisterAuditHooks registers all audit logging hooks
func RegisterAuditHooks(app *pocketbase.PocketBase) {
	
	// ========================================
	// CREATE HOOKS
	// ========================================
	app.OnRecordCreateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
		// execute the action first (create the record)
		if err := e.Next(); err != nil {
			return err
		}

		collection := e.Record.Collection().Name
		if excludedCollections[collection] {
			return nil
		}

		username, userId := getUserInfo(e)
		
		// Prepare record data
		// e.Record contains the newly created record data after success
		recordData := sanitizeData(e.Record.FieldsData(), collection)
		newHash := hashData(recordData)

		go createAuditLog(
			e.App,
			"create",
			collection,
			e.Record.Id,
			username,
			userId,
			recordData,
			nil,
			"",
			newHash,
			getSeverity("create", collection),
		)

		return nil
	})

	// ========================================
	// UPDATE HOOKS
	// ========================================
	app.OnRecordUpdateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
		collection := e.Record.Collection().Name
		if excludedCollections[collection] {
			return e.Next()
		}

		// Store original data BEFORE update
		// In v0.36, loaded record is in e.Record
		// Verify if e.Record holds the OLD data at this point. 
		// Yes, for update requests, e.Record is the record loaded from DB.
		// The changes are in `e.Record` after `e.Next()` presumably applied them? 
		// Actually, standard pattern: 
		// e.Record is the record TO BE updated. 
		// PocketBase v0.36 usually applies binding to e.Record.
		// So we capture "Original" state here.
		// Or better: Clone the record data before calling Next().
		
		oldData := sanitizeData(e.Record.Original().FieldsData(), collection)
		oldHash := hashData(oldData)

		// Execute update
		if err := e.Next(); err != nil {
			return err
		}

		// Now e.Record has the NEW data
		username, userId := getUserInfo(e)
		newData := sanitizeData(e.Record.FieldsData(), collection)
		newHash := hashData(newData)

		changes := calculateChanges(oldData, newData)

		if len(changes) > 0 {
			go createAuditLog(
				e.App,
				"update",
				collection,
				e.Record.Id,
				username,
				userId,
				changes,
				nil,
				oldHash,
				newHash,
				getSeverity("update", collection),
			)
		}

		return nil
	})

	// ========================================
	// DELETE HOOKS
	// ========================================
	app.OnRecordDeleteRequest().BindFunc(func(e *core.RecordRequestEvent) error {
		collection := e.Record.Collection().Name
		if excludedCollections[collection] {
			return e.Next()
		}

		// Capture data BEFORE delete
		deletedData := sanitizeData(e.Record.FieldsData(), collection)
		oldHash := hashData(deletedData)
		username, userId := getUserInfo(e)

		// Execute delete
		if err := e.Next(); err != nil {
			return err
		}

		// Log after success
		go createAuditLog(
			e.App,
			"delete",
			collection,
			e.Record.Id,
			username,
			userId,
			deletedData,
			nil,
			oldHash,
			"",
			getSeverity("delete", collection),
		)

		return nil
	})

	// ========================================
	// AUTH HOOKS
	// ========================================
	app.OnRecordAuthWithPasswordRequest().BindFunc(func(e *core.RecordAuthWithPasswordRequestEvent) error {
		// Execute auth
		if err := e.Next(); err != nil {
			return err
		}

		// Log success
		if e.Record == nil {
			return nil
		}

		username := "unknown"
		if name, ok := e.Record.Get("username").(string); ok {
			username = name
		}

		go createAuditLog(
			e.App,
			"login",
			e.Record.Collection().Name,
			e.Record.Id,
			username,
			e.Record.Id,
			nil,
			map[string]any{
				"method": "password",
				// "ip": e.RealIP(), // v0.36 method
			},
			"",
			"",
			"info",
		)

		return nil
	})

	log.Println("✓ Audit logging hooks registered (v0.36 compatible)")
}
