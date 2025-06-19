# Pebbles API Usage Examples

## Prerequisites
- Pebbles service running on `http://localhost:8081`
- Valid Google JWT token

## Example: Processing a CSV File

### 1. Start processing - First update with total
```bash
curl -X POST http://localhost:8081/progress \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "sales_data_2024.csv",
    "counts": {
      "done": 100,
      "warn": 0,
      "failed": 0
    },
    "total": 10000
  }'
```

Response:
```json
{
  "result": "created",
  "filename": "sales_data_2024.csv",
  "counts": {
    "done": 100,
    "warn": 0,
    "failed": 0
  },
  "total": 10000,
  "isCompleted": false
}
```

### 2. Update progress - Incremental updates
```bash
curl -X POST http://localhost:8081/progress \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "sales_data_2024.csv",
    "counts": {
      "done": 500,
      "warn": 10,
      "failed": 2
    }
  }'
```

Response:
```json
{
  "result": "updated",
  "filename": "sales_data_2024.csv",
  "counts": {
    "done": 600,
    "warn": 10,
    "failed": 2
  },
  "total": 10000,
  "isCompleted": false
}
```

### 3. Complete processing - Mark as finished
```bash
curl -X POST http://localhost:8081/progress \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "sales_data_2024.csv",
    "counts": {
      "done": 9388,
      "warn": 0,
      "failed": 0
    },
    "isLast": true
  }'
```

Response:
```json
{
  "result": "updated",
  "filename": "sales_data_2024.csv",
  "counts": {
    "done": 9988,
    "warn": 10,
    "failed": 2
  },
  "total": 10000,
  "isCompleted": true
}
```

### 4. Get progress for specific file
```bash
curl -X GET "http://localhost:8081/progress?filename=sales_data_2024.csv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
{
  "id": "507f1f77bcf86cd799439011",
  "filename": "sales_data_2024.csv",
  "email": "user@example.com",
  "counts": {
    "done": 9988,
    "warn": 10,
    "failed": 2
  },
  "total": 10000,
  "isCompleted": true,
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:15:00Z"
}
```

### 5. Get all progress for user
```bash
curl -X GET http://localhost:8081/progress \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "filename": "sales_data_2024.csv",
    "email": "user@example.com",
    "counts": {
      "done": 9988,
      "warn": 10,
      "failed": 2
    },
    "total": 10000,
    "isCompleted": true,
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:15:00Z"
  },
  {
    "id": "507f1f77bcf86cd799439012",
    "filename": "inventory_update.csv",
    "email": "user@example.com",
    "counts": {
      "done": 450,
      "warn": 0,
      "failed": 0
    },
    "total": 500,
    "isCompleted": false,
    "createdAt": "2024-01-01T11:00:00Z",
    "updatedAt": "2024-01-01T11:05:00Z"
  }
]
```

## Error Examples

### Attempting to update completed progress
```bash
curl -X POST http://localhost:8081/progress \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "sales_data_2024.csv",
    "counts": {
      "done": 10,
      "warn": 0,
      "failed": 0
    }
  }'
```

Response:
```json
{
  "error": "This file processing has already been completed"
}
```

### Missing authorization
```bash
curl -X GET http://localhost:8081/progress
```

Response:
```json
{
  "status": 401,
  "body": "Missing Authorization header"
}
```