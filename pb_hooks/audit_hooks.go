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

// createAuditLog creates an audit log entry
func createAuditLog(app *pocketbase.PocketBase, action, collection, recordId, username, userId string, changes, metadata map[string]any, oldHash, newHash string, severity string) {
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

// getSeverity determines the severity level based on action and collection
func getSeverity(action, collection string) string {
	switch action {
	case "delete":
		return "warning"
	case "create":
		if sensitiveCollections[collection] {
			return "info"
		}
		return "info"
	case "update":
		if sensitiveCollections[collection] {
			return "info"
		}
		return "info"
	case "login":
		return "info"
	default:
		return "info"
	}
}

// RegisterAuditHooks registers all audit logging hooks
func RegisterAuditHooks(app *pocketbase.PocketBase) {
	log.Println("⚠️ Audit logging hooks temporarily disabled for v0.36 upgrade")
	/*
	// ========================================
	// CREATE HOOKS
	// ========================================
	app.OnRecordAfterCreateSuccess().BindFunc(func(e *core.RecordEvent) error {
		collection := e.Record.Collection().Name
		
		// Skip excluded collections
		if excludedCollections[collection] {
			return e.Next()
		}
		
		var username, userId string
		// User info extraction commented out for v0.25 compatibility
		
		// Prepare record data
		recordData := sanitizeData(e.Record.FieldsData(), collection)
		newHash := hashData(recordData)
		
		// Create audit log
		go createAuditLog(
			app,
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
		
		return e.Next()
	})
	
	// ========================================
	// UPDATE HOOKS
	// ========================================
	
	// Note: OnRecordUpdateRequest uses RecordRequestEvent in v0.25
	app.OnRecordUpdateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
		// Just pass through. 
		// Context setting removed as 'e.Set' is not standard on RequestEvent without casting or middleware
		return e.Next()
	})
	
	app.OnRecordAfterUpdateSuccess().BindFunc(func(e *core.RecordEvent) error {
		collection := e.Record.Collection().Name
		
		if excludedCollections[collection] {
			return e.Next()
		}
		
		var username, userId string

		// Get original data - directly use Original()
		oldData := sanitizeData(e.Record.Original().FieldsData(), collection)

		// Get new data
		newData := sanitizeData(e.Record.FieldsData(), collection)
		newHash := hashData(newData)
		oldHash := hashData(oldData)
		
		// Calculate changes
		changes := calculateChanges(oldData, newData)
		
		// Only log if there are actual changes
		if len(changes) > 0 {
			go createAuditLog(
				app,
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
		
		return e.Next()
	})
	
	// ========================================
	// DELETE HOOKS
	// ========================================
	
	app.OnRecordDeleteRequest().BindFunc(func(e *core.RecordRequestEvent) error {
		return e.Next()
	})
	
	app.OnRecordAfterDeleteSuccess().BindFunc(func(e *core.RecordEvent) error {
		collection := e.Record.Collection().Name
		
		if excludedCollections[collection] {
			return e.Next()
		}
		
		var username, userId string
		
		// Get deleted data
		deletedData := sanitizeData(e.Record.FieldsData(), collection)
		oldHash := hashData(deletedData)
		
		go createAuditLog(
			app,
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
		
		return e.Next()
	})
	
	// ========================================
	// AUTH HOOKS
	// ========================================
	
	/*
	// ========================================
	// AUTH HOOKS (Temporarily disabled for v0.25 compatibility update)
	// ========================================
	
	app.OnRecordAuthWithPasswordRequest().BindFunc(func(e *core.RecordAuthWithPasswordRequestEvent) error {
		return e.Next()
	})
	
	app.OnRecordAfterAuthWithPasswordSuccess().BindFunc(func(e *core.RecordAuthWithPasswordEvent) error {
		if e.Record == nil {
			return e.Next()
		}
		
		username := ""
		if name, ok := e.Record.Get("username").(string); ok {
			username = name
		} else if name, ok := e.Record.Get("full_name").(string); ok {
			username = name
		}
		
		go createAuditLog(
			app,
			"login",
			e.Record.Collection().Name,
			e.Record.Id,
			username,
			e.Record.Id,
			nil,
			map[string]any{
				"method": "password",
			},
			"",
			"",
			"info",
		)
		
		return e.Next()
	})
	*/
	
	// Log failed auth attempts (using correct event type)
	app.OnRecordAuthRequest().BindFunc(func(e *core.RecordAuthRequestEvent) error {
		return e.Next()
	})
	*/
}
