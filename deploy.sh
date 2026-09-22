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

# Step 2: Compress the output directory
echo "[2/5] Compressing files..."
# Remove old local zip if it exists
rm -f $ZIP_NAME

# Go into the output dir and zip its contents so it extracts directly into the root on the server
cd $UPLOAD_DIR || { echo "❌ Directory $UPLOAD_DIR not found. Did the build fail? Aborting."; exit 1; }
zip -r ../../$ZIP_NAME .
cd ../..

# Step 3: Upload to server
echo "[3/5] Uploading to server ($SERVER_IP)..."
scp $ZIP_NAME ${USERNAME}@${SERVER_IP}:${REMOTE_PATH}/

if [ $? -ne 0 ]; then
  echo "❌ Upload failed. Please check your SSH connection, IP address, and remote path."
  exit 1
fi

# Step 4 & 5: Extract, Cleanup, and Restart via SSH
echo "[4/5] Extracting files and cleaning up .DS_Store on server..."
echo "[5/5] Restarting Node app..."

# Connect via SSH and run multiple commands
ssh ${USERNAME}@${SERVER_IP} << EOF
  cd ${REMOTE_PATH} || { echo "Remote directory not found!"; exit 1; }
  
  echo "Extracting ${ZIP_NAME}..."
  unzip -o ${ZIP_NAME}
  
  echo "Removing ${ZIP_NAME} from server..."
  rm ${ZIP_NAME}
  
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

# Clean up the local zip file
rm -f $ZIP_NAME

echo "====================================="
echo "✅ Deployment completed successfully!"
echo "====================================="
