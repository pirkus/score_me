#!/bin/bash

# Script to initialize SSL certificates
# Usage: ./certbot-init.sh <domain> <email>
# Example: ./certbot-init.sh example.com admin@example.com

# Check if domain and email are provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Error: Both domain name and email are required"
  echo "Usage: ./certbot-init.sh <domain> <email>"
  exit 1
fi

# Get domain and email from arguments
DOMAIN="$1"
EMAIL="$2"

echo "Generating certificates for $DOMAIN using $EMAIL"

# Create required directories
mkdir -p certbot/www

# Run certbot in standalone mode
docker run --rm -it \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  -v "$(pwd)/ssl_certs:/etc/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  --agree-tos --no-eff-email \
  --email "$EMAIL" \
  -d "$DOMAIN"

echo "Certificates generated. You can now run docker-compose up" 