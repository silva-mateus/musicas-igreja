#!/bin/bash
set -euo pipefail

# Migrate existing organized files into workspace-scoped subdirectories.
# Before: organized/{category}/{file}.pdf
# After:  organized/igreja/{category}/{file}.pdf
#
# Run from the backend directory (where the "organized" folder lives)
# or pass the organized folder path as $1.

ORGANIZED_DIR="${1:-organized}"
DEFAULT_WORKSPACE_SLUG="igreja"
TARGET_DIR="${ORGANIZED_DIR}/${DEFAULT_WORKSPACE_SLUG}"

if [ ! -d "$ORGANIZED_DIR" ]; then
    echo "ERROR: Directory '$ORGANIZED_DIR' not found."
    echo "Usage: $0 [path/to/organized]"
    exit 1
fi

if [ -d "$TARGET_DIR" ] && [ "$(ls -A "$TARGET_DIR" 2>/dev/null)" ]; then
    echo "WARNING: '$TARGET_DIR' already exists and is not empty."
    echo "Files may have already been migrated. Aborting."
    exit 0
fi

mkdir -p "$TARGET_DIR"

MOVED=0
SKIPPED=0

for item in "$ORGANIZED_DIR"/*/; do
    dirname=$(basename "$item")

    # Skip the workspace slug directory itself
    if [ "$dirname" = "$DEFAULT_WORKSPACE_SLUG" ]; then
        continue
    fi

    echo "Moving: $item -> $TARGET_DIR/$dirname"
    mv "$item" "$TARGET_DIR/$dirname"
    MOVED=$((MOVED + 1))
done

# Move any loose files at the root of organized/ into the workspace dir
for file in "$ORGANIZED_DIR"/*; do
    if [ -f "$file" ]; then
        echo "Moving file: $file -> $TARGET_DIR/"
        mv "$file" "$TARGET_DIR/"
        MOVED=$((MOVED + 1))
    fi
done

echo ""
echo "Migration complete."
echo "  Moved: $MOVED items"
echo "  Target: $TARGET_DIR"
