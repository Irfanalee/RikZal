#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> RikZal dev mode"

# Check dependencies
command -v cargo >/dev/null || { echo "Error: Rust/Cargo not found. Run: curl https://sh.rustup.rs | sh"; exit 1; }
command -v uv >/dev/null || { echo "Error: uv not found. Run: curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }
command -v pnpm >/dev/null || { echo "Error: pnpm not found. Run: npm i -g pnpm"; exit 1; }
command -v ollama >/dev/null || echo "Warning: Ollama not found — LLM calls will fail. Install from https://ollama.com"

# Install Python deps
echo "==> Installing Python dependencies..."
cd "$ROOT" && uv sync

# Install Node deps
echo "==> Installing Node dependencies..."
cd "$ROOT" && pnpm install

echo ""
echo "Starting processes (Ctrl+C to stop all):"
echo "  1. rikzal-daemon (Rust)"
echo "  2. rikzal-core   (Python)"
echo "  3. ui dev server (Vite)"
echo ""

# Start all processes
(cd "$ROOT" && source "$HOME/.cargo/env" && cargo run -p rikzal-daemon 2>&1 | sed 's/^/[daemon] /') &
DAEMON_PID=$!

(cd "$ROOT" && uv run rikzal-core 2>&1 | sed 's/^/[core]   /') &
CORE_PID=$!

(cd "$ROOT/ui" && pnpm dev 2>&1 | sed 's/^/[ui]     /') &
UI_PID=$!

cleanup() {
    echo ""
    echo "==> Shutting down..."
    kill $DAEMON_PID $CORE_PID $UI_PID 2>/dev/null
    wait
}
trap cleanup EXIT INT TERM

wait
