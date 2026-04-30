#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-deploy@homelab}"
LOCAL_PG_CONTAINER="${LOCAL_PG_CONTAINER:-homelab-postgres}"
DB_NAME="${DB_NAME:-musicas_igreja}"
DB_OWNER="${DB_OWNER:-musicas_user}"
FILES_VOLUME="${FILES_VOLUME:-homelab_musicas_organized}"
# Local filesystem path the dev backend reads from (relative to project root)
# Set to empty string to skip filesystem extraction
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ORGANIZED_DIR="${LOCAL_ORGANIZED_DIR:-${SCRIPT_DIR}/../backend/organized}"
DOCKER_BIN=""
SSH_BIN=""
SKIP_FS=false

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --skip-fs) SKIP_FS=true ;;
  esac
done

log() {
  printf "\n[%s] %s\n" "$(date +"%H:%M:%S")" "$1"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf "Missing required command: %s\n" "$command_name" >&2
    exit 1
  fi
}

detect_docker() {
  if command -v docker >/dev/null 2>&1; then
    if docker ps >/dev/null 2>&1; then
      DOCKER_BIN="docker"
      return
    fi
  fi

  if command -v docker.exe >/dev/null 2>&1; then
    if docker.exe ps >/dev/null 2>&1; then
      DOCKER_BIN="docker.exe"
      return
    fi
  fi

  printf "Docker CLI not available. Ensure Docker Desktop is running.\n" >&2
  exit 1
}

check_local_container() {
  if ! "$DOCKER_BIN" inspect "$LOCAL_PG_CONTAINER" >/dev/null 2>&1; then
    printf "Local container not found: %s\n" "$LOCAL_PG_CONTAINER" >&2
    exit 1
  fi
}

check_local_volume() {
  if ! "$DOCKER_BIN" volume inspect "$FILES_VOLUME" >/dev/null 2>&1; then
    printf "Local volume not found: %s\n" "$FILES_VOLUME" >&2
    exit 1
  fi
}

check_ssh() {
  "$SSH_BIN" -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE_HOST" "echo ok" >/dev/null
}

detect_ssh() {
  if command -v ssh.exe >/dev/null 2>&1; then
    SSH_BIN="ssh.exe"
    return
  fi

  if command -v ssh >/dev/null 2>&1; then
    SSH_BIN="ssh"
    return
  fi

  printf "Missing required command: ssh or ssh.exe\n" >&2
  exit 1
}

sync_database() {
  log "Syncing database: $DB_NAME"

  "$DOCKER_BIN" exec "$LOCAL_PG_CONTAINER" psql -U postgres -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid<>pg_backend_pid();"

  "$DOCKER_BIN" exec "$LOCAL_PG_CONTAINER" psql -U postgres -d postgres -c \
    "DROP DATABASE IF EXISTS ${DB_NAME};"

  "$DOCKER_BIN" exec "$LOCAL_PG_CONTAINER" psql -U postgres -d postgres -c \
    "CREATE DATABASE ${DB_NAME} OWNER ${DB_OWNER};"

  "$SSH_BIN" "$REMOTE_HOST" "docker exec ${LOCAL_PG_CONTAINER} pg_dump -U postgres -Fc ${DB_NAME}" \
    | "$DOCKER_BIN" exec -i "$LOCAL_PG_CONTAINER" pg_restore -U postgres -d "$DB_NAME"
}

sync_volume() {
  log "Syncing volume: $FILES_VOLUME"

  MSYS2_ARG_CONV_EXCL="*" "$DOCKER_BIN" run --rm -v "${FILES_VOLUME}:/data" alpine sh -c \
    "rm -rf /data/* /data/.[!.]* /data/..?*"

  "$SSH_BIN" "$REMOTE_HOST" \
    "docker run --rm -v ${FILES_VOLUME}:/vol:ro alpine tar czf - -C /vol ." \
    | MSYS2_ARG_CONV_EXCL="*" "$DOCKER_BIN" run --rm -i -v "${FILES_VOLUME}:/data" alpine tar xzf - -C /data
}

sync_filesystem() {
  if [ "$SKIP_FS" = true ]; then
    log "Skipping filesystem sync (--skip-fs)"
    return
  fi

  if [ -z "$LOCAL_ORGANIZED_DIR" ]; then
    log "Skipping filesystem sync (LOCAL_ORGANIZED_DIR is empty)"
    return
  fi

  local dest
  dest="$(realpath "$LOCAL_ORGANIZED_DIR" 2>/dev/null || echo "$LOCAL_ORGANIZED_DIR")"

  log "Exporting volume to filesystem: $dest"

  rm -rf "${dest:?}/"*
  mkdir -p "$dest"

  MSYS2_ARG_CONV_EXCL="*" "$DOCKER_BIN" run --rm -v "${FILES_VOLUME}:/vol:ro" alpine tar czf - -C /vol . \
    | tar xzf - -C "$dest"

  local pdf_count
  pdf_count=$(find "$dest" -name "*.pdf" | wc -l | tr -d '[:space:]')
  log "Extracted ${pdf_count} PDF files to $dest"
}

print_summary() {
  log "Summary"

  local pdf_count
  local file_count

  pdf_count="$("$DOCKER_BIN" exec "$LOCAL_PG_CONTAINER" psql -U postgres -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM pdf_files;" | tr -d '[:space:]')"

  file_count="$(MSYS2_ARG_CONV_EXCL="*" "$DOCKER_BIN" run --rm -v "${FILES_VOLUME}:/vol" alpine sh -c \
    "find /vol -name '*.pdf' | wc -l" | tr -d '[:space:]')"

  printf "Database pdf_files count: %s\n" "${pdf_count:-unknown}"
  printf "Volume PDF count: %s\n" "${file_count:-unknown}"
}

main() {
  detect_ssh
  detect_docker

  log "Validating local environment"
  check_local_container
  check_local_volume

  log "Checking SSH connectivity to ${REMOTE_HOST}"
  check_ssh

  sync_database
  sync_volume
  sync_filesystem
  print_summary

  log "Sync complete"
}

main "$@"
