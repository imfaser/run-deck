set windows-shell := ["powershell", "-NoProfile"]
export PATH := "./node_modules/.bin;" + env('PATH')

# ===== 开发 =====
dev:
    cross-env RUST_BACKTRACE=full tauri dev

dev-trace:
    cross-env RUST_BACKTRACE=full RUSTFLAGS="--cfg tokio_unstable" tauri dev tokio-trace

web-dev:
    vite

web-build:
    vue-tsc --noEmit && vite build

web-serve:
    vite preview

# ===== 构建 =====
build:
    cross-env NODE_OPTIONS='--max-old-space-size=4096' tauri build -f prod

build-fast:
    cross-env NODE_OPTIONS='--max-old-space-size=4096' tauri build -f prod -- -- --profile fast-release

build-dev:
    cross-env NODE_OPTIONS='--max-old-space-size=4096' tauri build -f prod -- -- --profile dev

# ===== 代码质量 =====
lint:
    eslint -c eslint.config.js --max-warnings=0 --cache --cache-location .eslintcache src

lint-fix:
    eslint -c eslint.config.js --max-warnings=0 --cache --cache-location .eslintcache --fix src

format:
    prettier --write .

format-check:
    prettier --check .

typecheck:
    vue-tsc --noEmit
    cargo check

# ===== 测试 =====
test:
    vitest run

test-rust:
    cargo test --workspace

test-all:
    just test
    just test-rust