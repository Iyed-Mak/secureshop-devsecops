#!/bin/bash

# SecureShop DevSecOps Test Data Setup Script

echo "Setting up test data for SecureShop..."

# Wait for services to be ready
echo "Waiting for services to be healthy..."
sleep 30

# Create test user
echo "Creating test user..."
curl -X POST http://localhost/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}' \
  --silent --output /dev/null

# Login to get JWT token
echo "Logging in to get JWT token..."
TOKEN=$(curl -X POST http://localhost/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}' \
  --silent | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

echo "JWT Token: $TOKEN"

# Create test category
echo "Creating test category..."
curl -X POST http://localhost/api/product/categories/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Electronics", "description": "Electronic devices"}' \
  --silent --output /dev/null

# Create test product
echo "Creating test product..."
curl -X POST http://localhost/api/product/products/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Laptop",
    "description": "A test laptop for DevSecOps testing",
    "price": 999.99,
    "stock_quantity": 10,
    "category_id": 1
  }' \
  --silent --output /dev/null

# Update inventory
echo "Updating inventory..."
curl -X PUT http://localhost/api/inventory/inventory/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 10}' \
  --silent --output /dev/null

# Create test order
echo "Creating test order..."
curl -X POST http://localhost/api/order/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "items": [
      {
        "product_id": 1,
        "quantity": 1,
        "price": 999.99
      }
    ]
  }' \
  --silent --output /dev/null

# Process payment
echo "Processing payment..."
curl -X POST http://localhost/api/payment/payments/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": 1,
    "amount": 999.99,
    "currency": "USD",
    "payment_method": "credit_card"
  }' \
  --silent --output /dev/null

echo "Test data setup complete!"
echo ""
echo "Test the vulnerable endpoints (for DevSecOps training):"
echo "SQL Injection: curl 'http://localhost/api/user/vulnerable-search?username=admin%27%20OR%20%271%27=%271'"
echo "Command Injection: curl -X POST http://localhost/api/user/vulnerable-exec -H 'Content-Type: application/json' -d '{\"cmd\": \"ls -la\"}'"