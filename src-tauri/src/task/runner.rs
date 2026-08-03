use std::collections::{HashSet, VecDeque};
use std::sync::{Mutex, OnceLock};

use base64::Engine as _;
use db::models::annotation::{Annotation, BoxType, PointSign};
use db::models::image::ImageType;
use db::models::task::{Task, TaskKind, TaskStatus};
use db::ops::{annotation_ops, image_ops, label_ops, task_ops};
use logging::{logging, Type};
use mcp::ContentBlock;
use nimg::ops::{
    BoxPrompt, DetectTarget, MappedBox, PointPrompt, map_boxes_to_annotations,
};
use sha2::{Digest, Sha256};

use crate::kernel::context::AppContext;
use crate::kernel::notification::FrontendEvent;
use crate::kernel::volume_store::VolumeEntry;

const SEGMENT_SERVER: &str = "sam3";
const SEGMENT_TOOL: &str = "segment_image";
const DETECT_SERVER: &str = "locate-anything";
const DETECT_TOOL: &str = "locate";

/// 执行结果：完成 / 取消 / 失败。
#[derive(Debug)]
enum ExecOutcome {
    Done,
    Cancelled,
    Failed(String),
}

struct RunnerState {
    running: Option<uuid::Uuid>,
    queue: VecDeque<uuid::Uuid>,
    cancelled: HashSet<uuid::Uuid>,
}

/// 全局单执行器：顺序队列单并发，取消在 slice 边界生效。
pub struct TaskRunner {
    inner: Mutex<RunnerState>,
}

static TASK_RUNNER: OnceLock<TaskRunner> = OnceLock::new();

impl TaskRunner {
    pub(crate) fn global() -> &'static Self {
        TASK_RUNNER.get_or_init(|| Self {
            inner: Mutex::new(RunnerState {
                running: None,
                queue: VecDeque::new(),
                cancelled: HashSet::new(),
            }),
        })
    }

    /// 是否有任务在运行或排队（busy 检查）。
    pub fn is_running() -> bool {
        let state = Self::global().inner.lock().expect("task runner lock poisoned");
        state.running.is_some() || !state.queue.is_empty()
    }

    /// 入队；队列空闲则立即启动。
    pub fn enqueue(&self, task_id: uuid::Uuid) {
        let should_run = {
            let mut state = self.inner.lock().expect("task runner lock poisoned");
            if state.running.is_some() {
                state.queue.push_back(task_id);
                false
            } else {
                state.running = Some(task_id);
                true
            }
        };
        if should_run {
            logging!(info, Type::Task, "TaskRunner: starting task {task_id}");
            tokio::spawn(async move {
                Self::process(task_id).await;
                Self::pump().await;
            });
        } else {
            logging!(info, Type::Task, "TaskRunner: task {task_id} queued");
        }
    }

    /// 标记取消（slice 边界生效）。
    pub fn cancel(&self, task_id: uuid::Uuid) {
        let mut state = self.inner.lock().expect("task runner lock poisoned");
        state.cancelled.insert(task_id);
        logging!(info, Type::Task, "TaskRunner: cancel requested for {task_id}");
    }

    fn is_cancelled(&self, task_id: uuid::Uuid) -> bool {
        let state = self.inner.lock().expect("task runner lock poisoned");
        state.cancelled.contains(&task_id)
    }

    fn clear_cancel(task_id: uuid::Uuid) {
        let mut state = Self::global().inner.lock().expect("task runner lock poisoned");
        state.cancelled.remove(&task_id);
    }

    async fn pump() {
        loop {
            let next = {
                let mut state = Self::global().inner.lock().expect("task runner lock poisoned");
                match state.queue.pop_front() {
                    Some(id) => {
                        state.running = Some(id);
                        Some(id)
                    }
                    None => {
                        state.running = None;
                        None
                    }
                }
            };
            match next {
                Some(id) => Self::process(id).await,
                None => break,
            }
        }
    }

    async fn process(task_id: uuid::Uuid) {
        let cancel_requested = {
            let state = Self::global().inner.lock().expect("task runner lock poisoned");
            state.cancelled.contains(&task_id)
        };
        if cancel_requested {
            logging!(info, Type::Task, "Task {task_id} cancelled before start");
            let mut db = AppContext::db().clone();
            let _ = task_ops::set_task_status(&mut db, task_id, TaskStatus::Cancelled).await;
            Self::emit(task_id);
            Self::clear_cancel(task_id);
            return;
        }

        let mut db = AppContext::db().clone();
        let task = match task_ops::get_task_by_id(&mut db, task_id).await {
            Ok(Some(t)) => t,
            _ => {
                logging!(warn, Type::Task, "Task {task_id} not found (deleted); skipping");
                Self::clear_cancel(task_id);
                return;
            }
        };

        if let Err(e) = task_ops::set_task_status(&mut db, task_id, TaskStatus::Running).await {
            logging!(error, Type::Task, "Task {task_id}: failed to set Running: {e}");
            Self::clear_cancel(task_id);
            return;
        }
        Self::emit(task_id);

        let outcome = Self::execute(&mut db, &task).await;

        Self::clear_cancel(task_id);

        match outcome {
            ExecOutcome::Done => {
                if let Err(e) = task_ops::set_task_status(&mut db, task_id, TaskStatus::Done).await {
                    logging!(warn, Type::Task, "Task {task_id}: failed to set Done (deleted?): {e}");
                }
            }
            ExecOutcome::Cancelled => {
                let _ = task_ops::set_task_status(&mut db, task_id, TaskStatus::Cancelled).await;
            }
            ExecOutcome::Failed(err) => {
                logging!(error, Type::Task, "Task {task_id} failed: {err}");
                let _ = task_ops::fail_task(&mut db, task_id, err).await;
            }
        }
        Self::emit(task_id);
        logging!(info, Type::Task, "Task {task_id} finished");
    }

    fn emit(task_id: uuid::Uuid) {
        AppContext::send_event(FrontendEvent::TaskChanged { task_id });
    }

    async fn execute(db: &mut toasty::Db, task: &Task) -> ExecOutcome {
        let start = task.range_start.max(0);
        let end = task.range_end;
        let total = end.saturating_sub(start).saturating_add(1).max(0);

        if total == 0 {
            return ExecOutcome::Done;
        }

        let mut done = 0;
        for index in start..=end {
            if Self::global().is_cancelled(task.id) {
                return ExecOutcome::Cancelled;
            }

            let slice = match Self::read_slice(task, index) {
                Ok(s) => s,
                Err(e) => return ExecOutcome::Failed(e),
            };

            let image_hash = hex::encode(Sha256::digest(&slice.hash_bytes));

            if let Err(e) = ensure_image(db, &image_hash, &slice, &task.volume_id).await {
                return ExecOutcome::Failed(e);
            }

            let result = match task.kind {
                TaskKind::Segment => {
                    Self::segment_slice(db, task, &image_hash, &slice).await
                }
                TaskKind::Detect => Self::detect_slice(db, task, &image_hash, &slice).await,
            };
            if let Err(e) = result {
                return ExecOutcome::Failed(e);
            }

            done += 1;
            if let Err(e) =
                task_ops::update_task_progress(db, task.id, done, total).await
            {
                logging!(warn, Type::Task, "Task {}: progress update failed: {e}", task.id);
            }
            // 写库（mask/annotations）后通知主窗口刷新 slice 面板
            AppContext::send_event(FrontendEvent::DbChanged);
            Self::emit(task.id);
        }

        ExecOutcome::Done
    }

    fn read_slice(task: &Task, index: i32) -> Result<SliceRead, String> {
        let store = AppContext::volume_store();
        let guard = store.lock();
        let entry = guard
            .as_ref()
            .ok_or_else(|| "volume not loaded".to_string())?;
        if entry.volume_id != task.volume_id {
            return Err("volume does not match task".to_string());
        }
        read_slice_from_entry(entry, index)
    }

    /// segment：已有标注转 prompts + 最近向前 mask + 调 sam3 + 存 mask。
    async fn segment_slice(
        db: &mut toasty::Db,
        task: &Task,
        image_hash: &str,
        slice: &SliceRead,
    ) -> Result<(), String> {
        let annotations = annotation_ops::list_annotations_by_image(db, image_hash)
            .await
            .map_err(|e| e.to_string())?;
        let groups = annotations_to_segment_groups(&annotations);
        let segment = nimg::ops::build_segment_objects(&groups);
        if segment.dropped_points > 0 {
            logging!(
                warn,
                Type::Task,
                "Task {}: dropped {} box-less point(s)",
                task.id,
                segment.dropped_points
            );
        }
        let objects_json = nimg::ops::annotations_to_segment_objects(&segment.objects);

        let mut prev_mask_b64 = None;
        if task.params.use_prev_mask {
            if let Some(prev) = find_prev_mask_hash(db, &task.volume_id, slice.index)
                .await
                .map_err(|e| e.to_string())?
            {
                let path = AppContext::content_cache().get_path(&prev);
                if path.exists() {
                    if let Ok(bytes) = std::fs::read(&path) {
                        prev_mask_b64 =
                            Some(base64::engine::general_purpose::STANDARD.encode(&bytes));
                    }
                }
            }
        }

        if objects_json.as_array().map_or(true, |arr| arr.is_empty())
            && prev_mask_b64.is_none()
        {
            logging!(debug, Type::Task, "Task {}: slice {} has no prompts, skip", task.id, slice.index);
            return Ok(());
        }

        let png = nimg::ops::slice_to_png_bytes(&slice.gray8, slice.width, slice.height)
            .map_err(|e| e.to_string())?;
        let image_b64 = base64::engine::general_purpose::STANDARD.encode(&png);
        let request = nimg::ops::build_segment_request(
            &image_b64,
            &objects_json,
            prev_mask_b64.as_deref(),
            false,
        );

        let result = AppContext::mcp_manager()
            .call_tool(SEGMENT_SERVER, SEGMENT_TOOL, Some(request))
            .await
            .map_err(|e| format!("sam3 segment failed: {e}"))?;

        let mask_png = extract_mask(&result).ok_or_else(|| "sam3 returned no image mask".to_string())?;
        let mask_hash = AppContext::content_cache()
            .store_bytes(&mask_png)
            .await
            .map_err(|e| e.to_string())?;

        image_ops::update_mask_hash(db, image_hash, Some(&mask_hash))
            .await
            .map_err(|e| e.to_string())?;
        logging!(debug, Type::Task, "Task {}: slice {} mask stored hash={mask_hash}", task.id, slice.index);
        Ok(())
    }

    /// detect：categories 展开 → 调 locate → boxes → 像素坐标 → merge 写入。
    async fn detect_slice(
        db: &mut toasty::Db,
        task: &Task,
        image_hash: &str,
        slice: &SliceRead,
    ) -> Result<(), String> {
        let labels = label_ops::list_labels(db).await.map_err(|e| e.to_string())?;
        let targets: Vec<DetectTarget> = task
            .params
            .targets
            .iter()
            .filter_map(|t| {
                let label = labels.iter().find(|l| l.id == t.label_id)?;
                Some(DetectTarget {
                    label_id: t.label_id.to_string(),
                    label_name: label.name.clone(),
                    sub_labels: t.sub_labels.clone(),
                })
            })
            .collect();
        if targets.is_empty() {
            return Ok(());
        }

        let categories: Vec<String> = task
            .params
            .targets
            .iter()
            .filter_map(|t| {
                if !t.sub_labels.is_empty() {
                    Some(t.sub_labels.clone())
                } else {
                    labels
                        .iter()
                        .find(|l| l.id == t.label_id)
                        .map(|l| vec![l.name.clone()])
                }
            })
            .flatten()
            .collect();

        let png = nimg::ops::slice_to_png_bytes(&slice.gray8, slice.width, slice.height)
            .map_err(|e| e.to_string())?;
        let image_b64 = base64::engine::general_purpose::STANDARD.encode(&png);
        let request = nimg::ops::build_locate_request(&image_b64, &categories);

        let result = AppContext::mcp_manager()
            .call_tool(DETECT_SERVER, DETECT_TOOL, Some(request))
            .await
            .map_err(|e| format!("locate detect failed: {e}"))?;

        let text = extract_text(&result).ok_or_else(|| "locate returned no text result".to_string())?;
        let boxes = nimg::ops::parse_boxes(&text);
        let mapped: Vec<MappedBox> =
            map_boxes_to_annotations(&boxes, &targets, slice.width, slice.height);

        let additional: Vec<db::ops::annotation_ops::AnnotationInput> = mapped
            .into_iter()
            .map(|m| {
                let label_id = uuid::Uuid::parse_str(&m.label_id)
                    .unwrap_or_else(|_| uuid::Uuid::new_v4());
                db::ops::annotation_ops::AnnotationInput {
                    id: uuid::Uuid::new_v4().to_string(),
                    label_id,
                    boxes: vec![db::ops::annotation_ops::BoxInput {
                        id: uuid::Uuid::new_v4().to_string(),
                        box_type: BoxType::Annotate,
                        x1: m.x1,
                        y1: m.y1,
                        x2: m.x2,
                        y2: m.y2,
                    }],
                    points: vec![],
                }
            })
            .collect();

        if additional.is_empty() {
            return Ok(());
        }
        let box_count = additional.len();
        annotation_ops::merge_annotations_input(db, image_hash, additional)
            .await
            .map_err(|e| e.to_string())?;
        logging!(debug, Type::Task, "Task {}: slice {} merged {} box(es)", task.id, slice.index, box_count);
        Ok(())
    }
}

/// 单切片读取结果（跨 await 的 owned 数据）。
pub(crate) struct SliceRead {
    pub index: i32,
    pub width: usize,
    pub height: usize,
    pub gray8: Vec<u8>,
    pub hash_bytes: Vec<u8>,
}

pub(crate) fn read_slice_from_entry(
    entry: &VolumeEntry,
    index: i32,
) -> Result<SliceRead, String> {
    let axis = entry.axis;
    let (h, w) = entry.volume.shape().perpendicular(axis);
    let index_usize = usize::try_from(index).map_err(|_| "invalid slice index".to_string())?;

    match entry.voxel_size {
        1 => {
            let slice: nimg::raw::VoxBuf<u8> =
                entry.volume.slice_at(axis, index_usize).map_err(|e| e.to_string())?;
            let data = slice.as_slice().to_vec();
            let hash_bytes = data.clone();
            Ok(SliceRead {
                index,
                width: w,
                height: h,
                gray8: data,
                hash_bytes,
            })
        }
        2 => {
            let slice: nimg::raw::VoxBuf<u16> =
                entry.volume.slice_at(axis, index_usize).map_err(|e| e.to_string())?;
            let values = slice.as_slice();
            let min = values.iter().copied().min().unwrap_or(0) as f64;
            let max = values.iter().copied().max().unwrap_or(65535) as f64;
            let range = if max > min { max - min } else { 1.0 };
            let gray8: Vec<u8> = values
                .iter()
                .map(|&v| ((v as f64 - min) / range * 255.0).round() as u8)
                .collect();
            let hash_bytes = bytemuck::cast_slice(values).to_vec();
            Ok(SliceRead {
                index,
                width: w,
                height: h,
                gray8,
                hash_bytes,
            })
        }
        other => Err(format!("unsupported voxel size: {other}")),
    }
}

fn annotations_to_segment_groups(annos: &[Annotation]) -> Vec<nimg::ops::PromptGroup> {
    annos.iter()
        .map(|a| nimg::ops::PromptGroup {
            points: a
                .points
                .iter()
                .map(|p| PointPrompt {
                    x: p.x,
                    y: p.y,
                    label: if p.sign == PointSign::Positive { 1 } else { 0 },
                })
                .collect(),
            boxes: a
                .boxes
                .iter()
                .filter(|b| b.box_type == BoxType::Annotate)
                .map(|b| BoxPrompt {
                    x1: b.x1,
                    y1: b.y1,
                    x2: b.x2,
                    y2: b.y2,
                })
                .collect(),
        })
        .collect()
}

/// 确保 image 行存在（按 hash），供执行器与单帧 AI 复用。
pub(crate) async fn ensure_image(
    db: &mut toasty::Db,
    image_hash: &str,
    slice: &SliceRead,
    volume_id: &str,
) -> Result<(), String> {
    if image_ops::get_image_by_hash(db, image_hash)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Ok(());
    }
    image_ops::upsert_image(
        db,
        image_hash,
        None,
        slice.width as i32,
        slice.height as i32,
        ImageType::Slice,
        Some(volume_id),
        Some(slice.index as i32),
        None,
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 最近向前搜索带 mask 的 slice。
pub(crate) async fn find_prev_mask_hash(
    db: &mut toasty::Db,
    volume_id: &str,
    current_index: i32,
) -> Result<Option<String>, String> {
    let images = image_ops::list_images_by_volume(db, volume_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(images
        .iter()
        .filter(|i| i.slice_index.is_some() && i.slice_index.unwrap() < current_index)
        .filter(|i| i.mask_hash.is_some())
        .max_by_key(|i| i.slice_index.unwrap())
        .and_then(|i| i.mask_hash.clone()))
}

pub(crate) fn extract_mask(result: &mcp::CallToolResult) -> Option<Vec<u8>> {
    result.content.iter().find_map(|block| match block {
        ContentBlock::Image(img) => nimg::ops::parse_mask_png(&img.data),
        _ => None,
    })
}

pub(crate) fn extract_text(result: &mcp::CallToolResult) -> Option<String> {
    result.content.iter().find_map(|block| match block {
        ContentBlock::Text(t) => Some(t.text.clone()),
        _ => None,
    })
}
