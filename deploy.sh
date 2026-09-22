#!/bin/bash

# ==========================================
# Deployment Configuration
# ==========================================
SERVER_IP="185.181.252.217"
USERNAME="trailmandu"
REMOTE_PATH="public_html"
BUILD_CMD="npm run build"
UPLOAD_DIR="./frontend/.output"
ZIP_NAME="deploy.zip"

echo "====================================="
echo "🚀 Starting Deployment Process..."
echo "====================================="

# Step 1: Build the project
echo "[1/5] Building the project ($BUILD_CMD)..."
cd frontend || { echo "❌ frontend directory not found"; exit 1; }
$BUILD_CMD

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Aborting deployment."
  exit 1
fi

cd ..

# Step 2: Sync files to server
echo "[2/4] Syncing files to server ($SERVER_IP) using rsync..."
# Sync the output folder directly into the remote path. 
rsync -avz --progress ${UPLOAD_DIR}/ ${USERNAME}@${SERVER_IP}:${REMOTE_PATH}/

if [ $? -ne 0 ]; then
  echo "❌ Sync failed. Please check your SSH connection."
  exit 1
fi

# Step 3 & 4: Cleanup and Restart via SSH
echo "[3/4] Cleaning up .DS_Store files on server..."
echo "[4/4] Restarting Node app..."

# Connect via SSH and run multiple commands
ssh ${USERNAME}@${SERVER_IP} << EOF
  cd ${REMOTE_PATH} || { echo "Remote directory not found!"; exit 1; }
  
  echo "Cleaning up .DS_Store files..."
  find . -name ".DS_Store" -type f -delete
  
  echo "Triggering Node.js app restart..."
  mkdir -p tmp
  touch tmp/restart.txt
EOF

if [ $? -ne 0 ]; then
  echo "❌ Remote execution failed."
  exit 1
fi

echo "====================================="
echo "✅ Deployment completed successfully!"
echo "====================================="
