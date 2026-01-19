# PocketBase Audit Hooks

This directory contains custom PocketBase hooks for automatic server-side audit logging.

## Features

- **Automatic Audit Logging**: All Create, Update, and Delete operations are logged
- **Change Tracking**: Updates include a diff of what changed
- **Data Integrity**: SHA256 hashes of old/new data for verification
- **Sensitive Data Protection**: Passwords and tokens are automatically redacted
- **Auth Logging**: Login success/failure events are captured
- **Async Processing**: Audit logs are created asynchronously to not block operations

## Excluded Collections

The following collections are NOT audited (to prevent infinite loops or noise):
- `audit_logs` - The audit logs themselves
- `sessions` - Internal session management
- `backup_logs` - Already audit-like in nature

## Building

### Prerequisites

1. Go 1.21 or later
2. PocketBase SDK

### Build Steps

```bash
# Navigate to the pb_hooks directory
cd pb_hooks

# Download dependencies
go mod tidy

# Build the custom PocketBase binary
go build -o pocketbase

# Or for production (optimized build)
CGO_ENABLED=0 go build -ldflags="-s -w" -o pocketbase
```

### Running

```bash
# Development
./pocketbase serve

# Production with custom port
./pocketbase serve --http=0.0.0.0:8090

# With HTTPS
./pocketbase serve --https=0.0.0.0:443
```

## Deployment to Fly.io

If you're deploying to Fly.io, update your Dockerfile:

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY pb_hooks/go.mod pb_hooks/go.sum ./
RUN go mod download

COPY pb_hooks/*.go ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o pocketbase

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/pocketbase .
COPY pb_data ./pb_data

EXPOSE 8090
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
```

## Audit Log Schema

Each audit log entry contains:

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | relation | Reference to the user who performed the action |
| `username` | text | Username for quick reference |
| `action` | select | create, update, delete, login, logout, etc. |
| `collection` | text | The collection that was modified |
| `record_id` | text | ID of the affected record |
| `changes` | json | Object showing what changed (for updates) |
| `old_data_hash` | text | SHA256 hash of original data |
| `new_data_hash` | text | SHA256 hash of new data |
| `timestamp` | date | When the action occurred |
| `severity` | select | debug, info, warning, error, critical |
| `metadata` | json | Additional context information |

## Security Notes

1. **Password Protection**: Password fields are automatically redacted in logs
2. **Admin Only Access**: Only admins can view audit logs (per schema rules)
3. **Immutable Logs**: Update and delete rules are `null` - logs cannot be modified
4. **Hash Verification**: Data hashes allow verification of log integrity

## Integration with Flutter App

The Flutter app also has a client-side `AuditService` located at:
`lib/core/services/audit_service.dart`

This provides:
- High-level logging methods for business operations
- Consistent action types matching the schema
- Async non-blocking logging

### Usage in Flutter

```dart
import 'package:al_salam_accounting_flutter/core/services/audit_service.dart';

// Log a salary payment
await AuditService.instance.logSalaryPayment(
  employeeId: 'emp123',
  payrollEntryId: 'pe456',
  receiptId: 'rcpt789',
  amount: 1500000,
  isPartialPayment: true,
  paymentNumber: 2,
);

// Log employee termination
await AuditService.instance.logTerminateEmployee(
  employeeId: 'emp123',
  employeeName: 'محمد علي',
  reason: 'انتهاء العقد',
);
```

## Troubleshooting

### Logs not appearing?
1. Check that `audit_logs` collection exists in your schema
2. Verify the `createRule` allows authenticated users
3. Check PocketBase logs for errors

### Performance issues?
- Audit logging is async and shouldn't impact performance
- If needed, add rate limiting or batch logging

## License

Part of Al-Salam Accounting System
