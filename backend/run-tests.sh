#!/bin/bash

# Bash script to run tests locally
# Usage: ./run-tests.sh

echo "========================================"
echo "  Running Musicas Igreja API Tests"
echo "========================================"
echo ""

# Navigate to tests directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$SCRIPT_DIR/../backend.tests"

cd "$TESTS_DIR" || exit 1

# Restore packages
echo "Restoring packages..."
dotnet restore

# Build
echo "Building test project..."
dotnet build --no-restore --configuration Debug

# Run tests
echo ""
echo "Running tests..."
echo ""

dotnet test --no-build --verbosity normal --configuration Debug --logger "console;verbosity=detailed"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "  All tests passed!"
    echo "========================================"
else
    echo ""
    echo "========================================"
    echo "  Some tests failed!"
    echo "========================================"
fi

exit $EXIT_CODE
