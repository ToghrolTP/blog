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

# ponytail: zip command below only includes specific production files, making exclusions unnecessary

# ---------------------------------------------------------------------------
# Copy production assets to prod_build/
# ---------------------------------------------------------------------------
info "Cleaning and preparing prod_build/ directory..."
rm -rf prod_build
mkdir -p prod_build

# Copy backend binary
if [[ -f "backend/target/release/backend" ]]; then
    cp backend/target/release/backend prod_build/
    ok "Copied backend binary to prod_build/"
else
    error "Compiled backend binary not found at backend/target/release/backend. Run: cargo build --release"
    exit 1
fi

# Copy frontend assets
if [[ -d "frontend/dist" ]]; then
    cp -r frontend/dist prod_build/
    ok "Copied frontend assets to prod_build/"
else
    error "Compiled frontend assets not found at frontend/dist. Run: npm run build --prefix frontend"
    exit 1
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
