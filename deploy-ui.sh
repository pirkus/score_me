#!/bin/bash

# Print commands as they're executed
set -x

# Exit on first error
set -e

echo "🚀 Starting UI build and deployment process..."

# Navigate to UI directory
cd scoreboard-ui

# Set the API URL for production
export REACT_APP_API_URL=https://score-me.lovich.net

# Run build command
echo "📦 Building UI..."
npm run build

# Navigate back to root
cd ..

# Deploy to Cloudflare Pages
echo "🌐 Deploying to Cloudflare Pages..."
wrangler pages deploy scoreboard-ui/build --project-name score-me --commit-dirty=true

echo "✅ Deployment complete!" 