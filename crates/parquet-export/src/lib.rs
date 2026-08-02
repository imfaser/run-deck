//! Volume 切片标注导出为 Parquet。
//!
//! 核心是纯函数 [`build_slices_batch`]：把扁平数据组装成 Arrow `RecordBatch`，
//! 与 DB / volume / Tauri 解耦，方便单元测试。写入由 [`write_slices_parquet`] 负责。

pub mod batch;
