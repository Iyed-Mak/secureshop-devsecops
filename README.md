# SecureShop - DevSecOps Microservices E-commerce Platform

A lightweight microservices-based e-commerce platform designed for DevSecOps learning and security testing.

## Architecture

The platform consists of 6 independent microservices:

- **User Service** (Python/Flask) - User registration, authentication, JWT tokens
- **Product Service** (Python/FastAPI) - Product catalog, categories, search
- **Order Service** (Node.js/Express) - Cart management and order lifecycle
- **Payment Service** (Python/FastAPI) - Payment processing and transaction records
- **Notification Service** (Node.js/Express) - Email/SMS notifications via RabbitMQ
- **Inventory Service** (Node.js/Express) - Stock management and reservation

All services use PostgreSQL databases and communicate via REST APIs through an Nginx API Gateway.

## Features

- JWT-based authentication
- Rate limiting and basic security
- Health check endpoints for all services
- Docker containerization
- Database per service architecture
- Message queue for notifications
- API Gateway with routing and basic auth validation

## DevSecOps Features

### Intentionally Vulnerable Endpoints (For Testing)

**User Service:**
- `/vulnerable-search?username=...` - SQL Injection vulnerability
- `/vulnerable-exec` - Command Injection vulnerability

**WARNING:** These endpoints are intentionally insecure for DevSecOps tool testing. Never deploy to production!

### Security Testing Tools

The project is prepared for the following DevSecOps tools:

#### SAST (Static Application Security Testing)
- **Bandit** - Python security linter
- **Semgrep** - Semantic code analysis
- **SpotBugs** - Java bytecode analysis (if Java services added)

#### SCA (Software Composition Analysis)
- **Trivy** - Container vulnerability scanning
- **OWASP Dependency-Check** - Dependency vulnerability analysis

#### DAST (Dynamic Application Security Testing)
- **OWASP ZAP** - API security testing

## Quick Start

1. **Clone and navigate:**
   ```bash
   cd secureshop-devsecops
   ```

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Services will be available at:**
   - API Gateway: http://localhost
   - User Service: http://localhost:8001
   - Product Service: http://localhost:8002
   - Order Service: http://localhost:8003
   - Payment Service: http://localhost:8004
   - Notification Service: http://localhost:8005
   - Inventory Service: http://localhost:8006

## API Usage Examples

### User Registration
```bash
curl -X POST http://localhost/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass"}'
```

### User Login
```bash
curl -X POST http://localhost/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass"}'
```

### Get Products
```bash
curl http://localhost/api/product/products/
```

### Create Order (requires JWT token)
```bash
curl -X POST http://localhost/api/order/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "items": [{"product_id": 1, "quantity": 2, "price": 29.99}]}'
```

## DevSecOps Testing

### Run SAST Tools

**Bandit (Python services):**
```bash
# Install bandit
pip install bandit

# Scan user service
bandit -r services/user-service/

# Scan product service
bandit -r services/product-service/

# Scan payment service
bandit -r services/payment-service/
```

**Semgrep:**
```bash
# Install semgrep
pip install semgrep

# Scan for vulnerabilities
semgrep --config auto .
```

### Run SCA Tools

**Trivy (Container scanning):**
```bash
# Install trivy
# Scan all images
docker-compose build
trivy image secureshop-user-service:latest
trivy image secureshop-product-service:latest
# etc.
```

**OWASP Dependency-Check:**
```bash
# Download and run dependency-check
dependency-check --scan . --format ALL
```

### Run DAST Tools

**OWASP ZAP:**
```bash
# Start ZAP in daemon mode
zap.sh -daemon -port 8080

# Or use ZAP Docker
docker run -p 8080:8080 -i owasp/zap2docker-stable zap.sh -daemon -port 8080
```

Then configure ZAP to scan http://localhost

## Security Best Practices Implemented

- JWT token authentication
- Password hashing with bcrypt
- Input validation
- Rate limiting
- Health checks
- Container security (non-root users, minimal images)
- Environment variable configuration
- Database connection pooling

## Development

Each service can be developed independently:

```bash
# User service (Python)
cd services/user-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app/main.py

# Product service (Python)
cd services/product-service
pip install -r requirements.txt
uvicorn app.main:app --reload

# Order service (Node.js)
cd services/order-service
npm install
npm run dev

# Other Node.js services similar
```

## Database Schema

Each service has its own PostgreSQL database:

- **userdb**: users table
- **productdb**: categories, products tables
- **orderdb**: orders, order_items tables
- **paymentdb**: payments table
- **inventorydb**: inventory table

## Monitoring

All services include health check endpoints at `/health`.

## License

This project is for educational purposes in DevSecOps learning.