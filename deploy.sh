#!/bin/bash

# Bash Deploy Script with Tests
# Usage: ./deploy.sh [--skip-tests]

set -e

SKIP_TESTS=false

for arg in "$@"; do
    case $arg in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
    esac
done

echo "========================================"
echo "  Musicas Igreja - Deploy Script"
echo "========================================"
echo ""

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
TESTS_DIR="$ROOT_DIR/backend.tests"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Step 1: Run Tests
if [ "$SKIP_TESTS" = false ]; then
    echo "[1/4] Running Backend Tests..."
    echo ""
    
    cd "$TESTS_DIR"
    dotnet restore --verbosity quiet
    dotnet build --no-restore --configuration Release --verbosity quiet
    
    if ! dotnet test --no-build --configuration Release --verbosity normal; then
        echo ""
        echo "========================================"
        echo "  DEPLOY ABORTED: Tests failed!"
        echo "========================================"
        exit 1
    fi
    
    echo ""
    echo "Tests passed successfully!"
else
    echo "[1/4] Skipping tests (--skip-tests flag used)"
fi

echo ""

# Step 2: Build Backend
echo "[2/4] Building Backend..."
cd "$BACKEND_DIR"
dotnet build --configuration Release --verbosity quiet
echo "Backend build successful!"

echo ""

# Step 3: Build Frontend
echo "[3/4] Building Frontend..."
cd "$FRONTEND_DIR"
npm ci --silent
npm run build
echo "Frontend build successful!"

echo ""

# Step 4: Docker Build (optional)
echo "[4/4] Building Docker Images..."
cd "$ROOT_DIR"
if command -v docker &> /dev/null; then
    docker build -t musicas-backend:latest ./backend
    docker build -t musicas-frontend:latest ./frontend
    echo "Docker images built successfully!"
else
    echo "Docker not available, skipping image build"
fi

echo ""
echo "========================================"
echo "  Deploy preparation complete!"
echo "========================================"
echo ""
echo "To start the services, run:"
echo "  ./start-all.sh"
