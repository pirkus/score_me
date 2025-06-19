#!/bin/bash

# Script to recreate the pebbles project locally
echo "Recreating pebbles project..."

# Clone from the workspace git
git clone -b feature/initial-pebbles-implementation git@github.com:pirkus/pebbles.git pebbles

# If the above doesn't work (repo not pushed yet), create manually:
if [ ! -d "pebbles" ]; then
    echo "Creating pebbles project structure manually..."
    mkdir -p pebbles
    cd pebbles
    
    # Initialize git
    git init
    git checkout -b feature/initial-pebbles-implementation
    
    # The project files would need to be created here
    # Since this is quite large, it's better to:
    # 1. Push to GitHub first, or
    # 2. Use the download option in your environment
fi

echo "Done! Check the pebbles directory."