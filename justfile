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
    tsc -b
    vite build

web-serve:
    vite preview

# ===== 构建 =====
build:
    cross-env NODE_OPTIONS='--max-old-space-size=4096' tauri build -f prod

build-fast:
    cross-env NODE_OPTIONS='--max-old-space-size=4096' tauri build -f prod
    -- --profile fast-release

build-dev:
    cross-env NODE_OPTIONS='--max-old-space-size=4096' tauri build -f prod
    -- --profile dev

# ===== 代码质量 =====
lint:
    oxlint src

lint-fix:
    oxlint --fix src

format:
    oxfmt --write .

format-check:
    oxfmt --check .

typecheck:
    tsc -b
    cargo check

# ===== 测试 =====
test:
    vitest run

test-rust:
    cargo test --workspace

test-all:
    just test
    just test-rust
