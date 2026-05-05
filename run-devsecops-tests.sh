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

    scan_image() {
        local service="$1"
        local output_file="$2"
        local image_id

        image_id=$(docker-compose images -q "$service" | head -n 1)
        if [ -z "$image_id" ]; then
            echo "Could not find built image for $service"
            return 1
        fi

        trivy image "$image_id" --format json --output "$output_file"
    }

    scan_image user-service reports/sca/user-service-image.json
    scan_image product-service reports/sca/product-service-image.json
    scan_image order-service reports/sca/order-service-image.json
    scan_image payment-service reports/sca/payment-service-image.json
    scan_image notification-service reports/sca/notification-service-image.json
    scan_image inventory-service reports/sca/inventory-service-image.json
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

echo "Verifying known vulnerable endpoints are removed or blocked..."
status_search=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/api/user/vulnerable-search?username=admin")
if [ "$status_search" = "000" ]; then
    echo "vulnerable-search endpoint HTTP status: $status_search (service not reachable)"
else
    echo "vulnerable-search endpoint HTTP status: $status_search"
fi

status_exec=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost/api/user/vulnerable-exec \
  -H "Content-Type: application/json" \
  -d '{"cmd": "echo VULNERABLE"}')
if [ "$status_exec" = "000" ]; then
    echo "vulnerable-exec endpoint HTTP status: $status_exec (service not reachable)"
else
    echo "vulnerable-exec endpoint HTTP status: $status_exec"
fi

echo ""
echo "Note: These endpoint checks require the application to be running and accessible at localhost."
echo "If testing locally, start the service or use docker-compose up before running this script."
echo ""
echo "=== DevSecOps Testing Complete ==="
echo "Check reports/ directory for detailed results"
echo "Review README.md for more testing guidance"