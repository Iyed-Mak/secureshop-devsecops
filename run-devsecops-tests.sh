#!/bin/bash

# SecureShop DevSecOps Testing Script

echo "=== SecureShop DevSecOps Testing ==="
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# SAST Testing
echo "=== SAST (Static Application Security Testing) ==="

if command_exists bandit; then
    echo "Running Bandit on Python services..."
    echo "User Service:"
    bandit -r services/user-service/ -f json -o reports/sast/bandit-user-service.json
    echo "Product Service:"
    bandit -r services/product-service/ -f json -o reports/sast/bandit-product-service.json
    echo "Payment Service:"
    bandit -r services/payment-service/ -f json -o reports/sast/bandit-payment-service.json
else
    echo "Bandit not installed. Install with: pip install bandit"
fi

if command_exists semgrep; then
    echo "Running Semgrep..."
    semgrep --config auto --json-output reports/sast/semgrep-results.json .
else
    echo "Semgrep not installed. Install with: pip install semgrep"
fi

echo ""

# SCA Testing
echo "=== SCA (Software Composition Analysis) ==="

if command_exists trivy; then
    echo "Running Trivy container scanning..."
    # Build images first
    docker-compose build
    trivy image secureshop-user-service --format json --output reports/sca/user-service-image.json
    trivy image secureshop-product-service --format json --output reports/sca/product-service-image.json
    trivy image secureshop-order-service --format json --output reports/sca/order-service-image.json
    trivy image secureshop-payment-service --format json --output reports/sca/payment-service-image.json
    trivy image secureshop-notification-service --format json --output reports/sca/notification-service-image.json
    trivy image secureshop-inventory-service --format json --output reports/sca/inventory-service-image.json
else
    echo "Trivy not installed. Install from: https://aquasecurity.github.io/trivy/"
fi

if command_exists dependency-check; then
    echo "Running OWASP Dependency-Check..."
    dependency-check --scan . --format JSON --out reports/sca/dependency-check-report.json
else
    echo "OWASP Dependency-Check not installed. Download from: https://owasp.org/www-project-dependency-check/"
fi

echo ""

# DAST Testing
echo "=== DAST (Dynamic Application Security Testing) ==="

if command_exists zap.sh; then
    echo "OWASP ZAP is available. Start ZAP daemon and configure scan for http://localhost"
    echo "Command: zap.sh -daemon -port 8080"
    echo "Then use ZAP UI or API to scan the application"
elif docker ps | grep -q zap; then
    echo "ZAP Docker container detected. Use ZAP UI at http://localhost:8080"
else
    echo "OWASP ZAP not running. Start with Docker:"
    echo "docker run -p 8080:8080 -i owasp/zap2docker-stable zap.sh -daemon -port 8080"
fi

echo ""

# Vulnerability Testing
echo "=== Testing Known Vulnerabilities ==="

echo "Testing SQL Injection vulnerability..."
curl -s "http://localhost/api/user/vulnerable-search?username=admin'%20OR%20'1'='1" | head -c 200
echo ""

echo "Testing Command Injection vulnerability..."
curl -s -X POST http://localhost/api/user/vulnerable-exec \
  -H "Content-Type: application/json" \
  -d '{"cmd": "echo VULNERABLE"}' | head -c 200
echo ""

echo "=== DevSecOps Testing Complete ==="
echo "Check reports/ directory for detailed results"
echo "Review README.md for more testing guidance"