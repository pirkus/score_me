#!/bin/bash

# Set your SSH key and server details
SSH_KEY="YOUR_SSH_KEY_HERE"
SERVER="YOUR_SERVER_HERE"
REMOTE_DIR="score_me"
REMOTE_MONGO_URI="YOUR_MONGO_URI_HERE"

# SSH to the server and execute the deployment
echo "Deploying on remote server..."
ssh -i $SSH_KEY $SERVER "cd $REMOTE_DIR && \
  export MONGO_URI=\"$REMOTE_MONGO_URI\" && \
  git pull && \
  docker-compose -f docker-compose-ssl.yml down && \
  docker-compose build && \
  docker-compose -f docker-compose-ssl.yml up -d"

echo "Deployment complete!" 