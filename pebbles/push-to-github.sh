#!/bin/bash

# Script to push pebbles project to GitHub

echo "Pushing pebbles to git@github.com:pirkus/pebbles.git"

# Initialize git if needed
[ ! -d .git ] && git init && git branch -m main

# Add remote if needed
git remote | grep -q origin || git remote add origin git@github.com:pirkus/pebbles.git

# Commit if needed
git add .
git diff --cached --quiet || git commit -m "Pebbles: File progress tracking service"

# Push to GitHub
git push -u origin main

echo ""
echo "Done! Your code should now be at https://github.com/pirkus/pebbles"