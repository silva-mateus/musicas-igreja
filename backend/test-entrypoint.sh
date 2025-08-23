#!/bin/bash

echo "🧪 Testing entrypoint.sh existence and permissions..."

# Test 1: Check if file exists
echo "📋 Test 1: File existence"
if [ -f "./entrypoint.sh" ]; then
    echo "✅ entrypoint.sh exists in current directory"
    ls -la ./entrypoint.sh
else
    echo "❌ entrypoint.sh NOT found in current directory"
    ls -la . | grep entry || echo "No entrypoint files found"
fi

# Test 2: Check permissions
echo ""
echo "📋 Test 2: File permissions"
if [ -x "./entrypoint.sh" ]; then
    echo "✅ entrypoint.sh is executable"
else
    echo "❌ entrypoint.sh is NOT executable"
    echo "🔧 Making it executable..."
    chmod +x ./entrypoint.sh
fi

# Test 3: Check Docker build context
echo ""
echo "📋 Test 3: Docker build test"
echo "Building test Docker image to verify entrypoint..."

# Create minimal Dockerfile for testing
cat > Dockerfile.test << 'EOF'
FROM alpine:latest
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && ls -la /entrypoint.sh
CMD ["sh", "-c", "ls -la /entrypoint.sh && echo 'Entrypoint test passed'"]
EOF

# Build test image
if docker build -f Dockerfile.test -t test-entrypoint . 2>/dev/null; then
    echo "✅ Docker build succeeded"
    
    echo "🏃 Running test container..."
    docker run --rm test-entrypoint
    
    echo "🧹 Cleaning up..."
    docker rmi test-entrypoint >/dev/null 2>&1
    rm -f Dockerfile.test
    
    echo "✅ Test completed successfully!"
else
    echo "❌ Docker build failed"
    echo "📋 Files in current directory:"
    ls -la
    rm -f Dockerfile.test
fi

echo ""
echo "🎯 If all tests passed, the entrypoint issue should be resolved!"
