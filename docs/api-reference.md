# Nexus Apollo API Reference

## Base URL
- Development: `http://localhost:8001/api`
- Production: `https://nexus.automatacontrols.com/api`

## Authentication

All API endpoints require JWT authentication except `/auth/login`.

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "jwt_token_string",
  "user": {
    "id": 1,
    "username": "string",
    "role": "admin|technician|viewer"
  }
}
```

## Customer Endpoints

### Get All Customers
```http
GET /customers
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Customer Name",
    "address": "123 Main St",
    "city": "City",
    "state": "ST",
    "zip": "12345",
    "contact_name": "John Doe",
    "contact_phone": "555-1234",
    "contact_email": "john@example.com",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Get Single Customer
```http
GET /customers/:id
Authorization: Bearer <token>
```

### Create Customer
```http
POST /customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Customer Name",
  "address": "123 Main St",
  "city": "City",
  "state": "ST",
  "zip": "12345",
  "contact_name": "John Doe",
  "contact_phone": "555-1234",
  "contact_email": "john@example.com"
}
```

### Update Customer
```http
PUT /customers/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "address": "456 Oak Ave"
}
```

### Delete Customer
```http
DELETE /customers/:id
Authorization: Bearer <token>
```

## Equipment Endpoints

### Get All Equipment
```http
GET /equipment
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "name": "RTU-01",
    "type": "ROOFTOP_UNIT",
    "model": "Carrier 48TC",
    "serial_number": "1234567890",
    "installation_date": "2023-01-15",
    "last_maintenance": "2024-11-01",
    "status": "operational",
    "notes": "Zone 1 primary unit"
  }
]
```

### Get Equipment by Customer
```http
GET /equipment/customer/:customerId
Authorization: Bearer <token>
```

### Create Equipment
```http
POST /equipment
Authorization: Bearer <token>
Content-Type: application/json

{
  "customer_id": 1,
  "name": "RTU-02",
  "type": "ROOFTOP_UNIT",
  "model": "Trane XR14",
  "serial_number": "9876543210",
  "installation_date": "2024-01-01"
}
```

### Update Equipment
```http
PUT /equipment/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "maintenance",
  "last_maintenance": "2024-12-01",
  "notes": "Compressor replacement scheduled"
}
```

### Delete Equipment
```http
DELETE /equipment/:id
Authorization: Bearer <token>
```

## Sensor Endpoints

### Get Current Sensor Data
```http
GET /sensors/current
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "equipment_id": 1,
    "sensor_type": "SUPPLY_TEMP",
    "value": 55.2,
    "unit": "°F",
    "timestamp": "2024-12-15T10:30:00Z",
    "status": "normal"
  }
]
```

### Get Historical Sensor Data
```http
GET /sensors/history/:equipmentId
Authorization: Bearer <token>
Query Parameters:
  - start: ISO 8601 date string
  - end: ISO 8601 date string
  - interval: 1m|5m|15m|1h|1d
```

### Get Sensor Statistics
```http
GET /sensors/stats/:equipmentId
Authorization: Bearer <token>
Query Parameters:
  - period: 1h|24h|7d|30d
```

**Response:**
```json
{
  "supply_temp": {
    "min": 52.1,
    "max": 58.3,
    "avg": 55.2,
    "current": 55.5
  },
  "return_temp": {
    "min": 72.0,
    "max": 78.5,
    "avg": 75.2,
    "current": 74.8
  },
  "compressor_amps": {
    "min": 0,
    "max": 45.2,
    "avg": 32.1,
    "current": 35.5
  }
}
```

## Reports Endpoints

### Generate Equipment Report
```http
POST /reports/equipment/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "maintenance|performance|diagnostic",
  "period": "24h|7d|30d|custom",
  "start_date": "2024-12-01",
  "end_date": "2024-12-15",
  "include_predictions": true
}
```

**Response:**
```json
{
  "report_id": "uuid",
  "generated_at": "2024-12-15T10:30:00Z",
  "equipment": { },
  "summary": {
    "health_score": 85,
    "runtime_hours": 168,
    "energy_consumption": 1250.5,
    "alerts_count": 3,
    "predicted_failures": []
  },
  "data": { },
  "recommendations": []
}
```

### Get Report by ID
```http
GET /reports/:reportId
Authorization: Bearer <token>
```

### List Reports
```http
GET /reports
Authorization: Bearer <token>
Query Parameters:
  - equipment_id: number
  - customer_id: number
  - type: maintenance|performance|diagnostic
  - limit: number (default: 50)
  - offset: number (default: 0)
```

## AI/ML Endpoints

### Get Predictions
```http
POST /ai/predict
Authorization: Bearer <token>
Content-Type: application/json

{
  "equipment_id": 1,
  "model": "apollo|fault_detection|energy_optimization",
  "horizon": "1h|24h|7d"
}
```

**Response:**
```json
{
  "predictions": [
    {
      "timestamp": "2024-12-15T11:00:00Z",
      "type": "compressor_failure",
      "probability": 0.78,
      "confidence": 0.92,
      "recommended_action": "Schedule immediate inspection"
    }
  ],
  "model_version": "1.2.0",
  "processed_at": "2024-12-15T10:30:00Z"
}
```

### Vector Search (TiDB)
```http
POST /ai/vector-search
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "compressor high temperature vibration",
  "equipment_type": "ROOFTOP_UNIT",
  "limit": 10,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "results": [
    {
      "id": 1,
      "equipment_type": "ROOFTOP_UNIT",
      "fault_description": "Compressor overheating due to refrigerant leak",
      "similarity_score": 0.95,
      "resolution": "Check refrigerant levels, inspect for leaks, replace filter drier",
      "historical_cases": 12
    }
  ],
  "query_embedding": [],
  "search_time_ms": 45
}
```

## WebSocket Events

### Connection
```javascript
const socket = io('wss://nexus.automatacontrols.com', {
  auth: {
    token: 'jwt_token'
  }
});
```

### Real-time Sensor Updates
```javascript
socket.on('sensor:update', (data) => {
  console.log('Sensor update:', data);
  // {
  //   equipment_id: 1,
  //   sensors: [
  //     { type: 'SUPPLY_TEMP', value: 55.2, timestamp: '...' }
  //   ]
  // }
});
```

### Alert Notifications
```javascript
socket.on('alert:new', (alert) => {
  console.log('New alert:', alert);
  // {
  //   id: 1,
  //   equipment_id: 1,
  //   severity: 'critical|warning|info',
  //   message: 'Compressor current exceeds threshold',
  //   timestamp: '...'
  // }
});
```

### Model Predictions
```javascript
socket.on('prediction:update', (prediction) => {
  console.log('New prediction:', prediction);
  // {
  //   equipment_id: 1,
  //   predictions: [...],
  //   timestamp: '...'
  // }
});
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { },
    "timestamp": "2024-12-15T10:30:00Z"
  }
}
```

### Common Error Codes
- `AUTH_REQUIRED`: Missing authentication token
- `AUTH_INVALID`: Invalid or expired token
- `PERMISSION_DENIED`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Request validation failed
- `DATABASE_ERROR`: Database operation failed
- `SENSOR_OFFLINE`: Sensor not responding
- `MODEL_ERROR`: AI model prediction failed

## Rate Limiting

- Default: 100 requests per minute per IP
- Authenticated: 1000 requests per minute per user
- WebSocket: 50 messages per second per connection

## Response Headers

All responses include:
```http
X-Request-ID: uuid
X-Response-Time: 125ms
X-Rate-Limit-Remaining: 95
X-Rate-Limit-Reset: 1734265800
```