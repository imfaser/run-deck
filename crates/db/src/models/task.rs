/// 自动打标任务类型。
#[derive(Debug, Clone, PartialEq, toasty::Embed, serde::Serialize, serde::Deserialize)]
pub enum TaskKind {
    #[column(variant = "segment")]
    Segment,
    #[column(variant = "detect")]
    Detect,
}

/// 自动打标任务状态。
#[derive(Debug, Clone, PartialEq, toasty::Embed, serde::Serialize, serde::Deserialize)]
pub enum TaskStatus {
    #[column(variant = "pending")]
    Pending,
    #[column(variant = "running")]
    Running,
    #[column(variant = "done")]
    Done,
    #[column(variant = "failed")]
    Failed,
    #[column(variant = "cancelled")]
    Cancelled,
}

/// 任务执行参数（序列化进 `Task.params` JSON 列）。
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct TaskParams {
    pub use_prev_mask: bool,
    pub targets: Vec<DetectTarget>,
}

/// detect 任务的单个目标标签。
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct DetectTarget {
    pub label_id: uuid::Uuid,
    /// 空表示使用 `label.name` 作为 category。
    pub sub_labels: Vec<String>,
}

#[derive(Debug, toasty::Model, serde::Serialize)]
pub struct Task {
    #[key]
    #[auto]
    pub id: uuid::Uuid,

    pub name: String,

    pub kind: TaskKind,

    pub status: TaskStatus,

    pub enabled: bool,

    pub order: i32,

    pub volume_id: String,

    pub range_start: i32,

    pub range_end: i32,

    #[column(type = "text")]
    pub params: toasty::Json<TaskParams>,

    pub error: Option<String>,

    pub progress_current: i32,

    pub progress_total: i32,

    pub created_at: i64,

    pub updated_at: i64,
}
