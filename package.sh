#!/usr/bin/env bash
# ==============================================================================
# package.sh — Create a deploy-ready zip for Liara.ir (Drag & Drop upload)
#
# Usage:  ./package.sh
#
# The script:
#   1. Reads .dockerignore to determine what to exclude (single source of truth)
#   2. Creates a timestamped zip at the project root
#   3. Reports size, contents, and warnings
#
# The resulting zip has Dockerfile/liara.json at the ROOT level, matching
# Liara's expected build context structure.
# ==============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
ZIP_NAME="blog-deploy-${TIMESTAMP}.zip"
DOCKERIGNORE=".dockerignore"
SIZE_WARN_MB=50

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { echo -e "${CYAN}ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}✔${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
error() { echo -e "${RED}✖${NC}  $*" >&2; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if [[ ! -f "Dockerfile" ]]; then
    error "No Dockerfile found in project root. Are you in the right directory?"
    exit 1
fi

if [[ ! -f "liara.json" ]]; then
    error "No liara.json found in project root."
    exit 1
fi

if ! command -v zip &>/dev/null; then
    error "'zip' command not found. Install it with: sudo apt-get install zip"
    exit 1
fi

if [[ ! -f "$DOCKERIGNORE" ]]; then
    warn "No .dockerignore found — all files will be included in the zip."
fi

# ---------------------------------------------------------------------------
# Build exclusion list from .dockerignore
# ---------------------------------------------------------------------------
# zip's -x flag uses glob patterns. We translate .dockerignore entries:
#   - Strip comments and blank lines
#   - Trailing / means directory → append *
#   - Leading / is relative to root → strip it
#   - Also always exclude: the zip outputs, this script, and .git/
# ---------------------------------------------------------------------------
EXCLUDE_ARGS=()

# Always exclude regardless of .dockerignore
EXCLUDE_ARGS+=("-x" "*.zip")
EXCLUDE_ARGS+=("-x" "package.sh")
EXCLUDE_ARGS+=("-x" ".git/*")
EXCLUDE_ARGS+=("-x" ".git/**/*")

if [[ -f "$DOCKERIGNORE" ]]; then
    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^[[:space:]]*# ]] && continue

        # Trim whitespace
        line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        [[ -z "$line" ]] && continue

        # Strip leading /
        line="${line#/}"

        # If pattern ends with /, it's a directory — match everything inside
        if [[ "$line" == */ ]]; then
            EXCLUDE_ARGS+=("-x" "${line}*")
            EXCLUDE_ARGS+=("-x" "${line}**/*")
        else
            # Could be a file or a directory without trailing slash
            # Add both the pattern itself and a recursive glob
            EXCLUDE_ARGS+=("-x" "$line")
            # If it looks like a directory pattern (no extension, no glob),
            # also add recursive match
            if [[ "$line" != *.* ]] && [[ "$line" != *\** ]]; then
                EXCLUDE_ARGS+=("-x" "${line}/*")
                EXCLUDE_ARGS+=("-x" "${line}/**/*")
            fi
        fi
    done < "$DOCKERIGNORE"
fi

# ---------------------------------------------------------------------------
# Create the zip
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}📦 Packaging project for Liara deployment...${NC}"
echo -e "   Output: ${CYAN}${ZIP_NAME}${NC}"
echo ""

# Remove old zip with same name if somehow it exists
[[ -f "$ZIP_NAME" ]] && rm -f "$ZIP_NAME"

# Create zip from the project root directory
# -r  = recursive
# -q  = quiet (we'll show our own output)
# -9  = best compression
zip -r -q -9 "$ZIP_NAME" Dockerfile liara.json prod_build

# ---------------------------------------------------------------------------
# Post-packaging report
# ---------------------------------------------------------------------------
echo -e "${BOLD}─── Packaging Report ───${NC}"
echo ""

# 1. File size
ZIP_SIZE_BYTES="$(stat --format=%s "$ZIP_NAME" 2>/dev/null || stat -f%z "$ZIP_NAME" 2>/dev/null)"
ZIP_SIZE_MB="$(echo "scale=2; $ZIP_SIZE_BYTES / 1048576" | bc)"

ok "Created: ${BOLD}${ZIP_NAME}${NC}"
ok "Size:    ${BOLD}${ZIP_SIZE_MB} MB${NC}"

# 2. Size warning
SIZE_INT="${ZIP_SIZE_MB%.*}"
if [[ "${SIZE_INT:-0}" -ge "$SIZE_WARN_MB" ]]; then
    echo ""
    warn "${YELLOW}Zip exceeds ${SIZE_WARN_MB} MB! Liara upload may be slow or fail.${NC}"
    warn "Check if large files are leaking in. Run: ${CYAN}unzip -l ${ZIP_NAME} | sort -k3 -nr | head -20${NC}"
fi

# 3. Top-level contents
echo ""
echo -e "${BOLD}─── Top-Level Contents ───${NC}"
# List the root-level entries inside the zip
zipinfo -1 "$ZIP_NAME" | sed 's|/.*|/|' | sort -u | while read -r entry; do
    # Only show root-level items (no nested /)
    if [[ "$entry" != */* ]] || [[ "$entry" == */ && "$(echo "$entry" | tr -cd '/')" == "/" ]]; then
        echo "   $entry"
    fi
done

echo ""
echo -e "${GREEN}${BOLD}✅ Ready to upload!${NC}"
echo -e "   1. Go to ${CYAN}https://console.liara.ir${NC}"
echo -e "   2. Open your app → click ${BOLD}\"استقرار جدید\"${NC} (New Deployment)"
echo -e "   3. Go to the ${BOLD}Drag & Drop${NC} tab"
echo -e "   4. Upload ${CYAN}${ZIP_NAME}${NC}"
echo ""
