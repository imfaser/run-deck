set windows-shell := ["powershell", "-NoProfile"]
export PATH := "./node_modules/.bin;" + env('PATH')

# ===== 开发命令 =====
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

# ===== 构建命令 =====
build:
    cross-env NODE_OPTIONS='--max-old-space-size=4096' tauri build

build-fast:
    cross-env NODE_OPTIONS='--max-old-space-size=4096' tauri build -- -- --profile fast-release
build-dev:
    cross-env NODE_OPTIONS='--max-old-space-size=4096' tauri build -- -- --profile dev
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

# ===== 快捷启动 =====
run:
    just dev

test:
    vitest run

test-rust:
    cargo test --workspace