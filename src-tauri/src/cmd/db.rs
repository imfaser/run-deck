use super::{CmdResult, StringifyErr};
use crate::kernel::context::AppContext;
use crate::kernel::notification::FrontendEvent;
use db::ops::annotation_ops::{self, AnnotationCount, AnnotationInput, NearestVisual};
use db::ops::image_ops;
use db::ops::label_ops;
use logging::{logging, Type};

// ─── Input types ───────────────────────────────────────────────────

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelOrderInput {
    pub id: uuid::Uuid,
    pub order: i32,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageUpsertInput {
    pub hash: String,
    pub image_name: Option<String>,
    pub width: i32,
    pub height: i32,
    pub image_type: db::models::image::ImageType,
    pub volume_id: Option<String>,
    pub slice_index: Option<i32>,
    pub mask_hash: Option<String>,
}

// ─── Label commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn db_create_label(
    name: String,
    color: String,
    order: i32,
    sub_labels: Vec<String>,
) -> CmdResult<db::models::label::Label> {
    logging!(info, Type::Cmd, "db_create_label: name={}", name);
    let mut db = AppContext::db().clone();
    let result = label_ops::create_label(&mut db, &name, &color, order, sub_labels)
        .await
        .stringify_err()?;
    AppContext::send_event(FrontendEvent::DbChanged);
    Ok(result)
}

#[tauri::command]
pub async fn db_list_labels() -> CmdResult<Vec<db::models::label::Label>> {
    logging!(info, Type::Cmd, "db_list_labels");
    let mut db = AppContext::db().clone();
    label_ops::list_labels(&mut db).await.stringify_err()
}

#[tauri::command]
pub async fn db_update_label(
    id: uuid::Uuid,
    name: Option<String>,
    color: Option<String>,
    order: Option<i32>,
    sub_labels: Option<Vec<String>>,
) -> CmdResult<db::models::label::Label> {
    logging!(info, Type::Cmd, "db_update_label: id={}", id);
    let mut db = AppContext::db().clone();
    let result = label_ops::update_label(
        &mut db,
        id,
        name.as_deref(),
        color.as_deref(),
        order,
        sub_labels,
    )
    .await
    .stringify_err()?;
    AppContext::send_event(FrontendEvent::DbChanged);
    Ok(result)
}

#[tauri::command]
pub async fn db_reorder_labels(inputs: Vec<LabelOrderInput>) -> CmdResult {
    logging!(info, Type::Cmd, "db_reorder_labels: {} labels", inputs.len());
    let mut db = AppContext::db().clone();
    let pairs: Vec<(uuid::Uuid, i32)> = inputs.into_iter().map(|i| (i.id, i.order)).collect();
    label_ops::reorder_labels(&mut db, pairs).await.stringify_err()?;
    AppContext::send_event(FrontendEvent::DbChanged);
    Ok(())
}

#[tauri::command]
pub async fn db_delete_label(id: uuid::Uuid) -> CmdResult {
    logging!(info, Type::Cmd, "db_delete_label: id={}", id);
    let mut db = AppContext::db().clone();
    label_ops::delete_label(&mut db, id).await.stringify_err()?;
    AppContext::send_event(FrontendEvent::DbChanged);
    Ok(())
}

// ─── Image commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn db_upsert_image(input: ImageUpsertInput) -> CmdResult<db::models::image::Image> {
    logging!(info, Type::Cmd, "db_upsert_image: hash={}", input.hash);
    let mut db = AppContext::db().clone();
    let result = image_ops::upsert_image(
        &mut db,
        &input.hash,
        input.image_name.as_deref(),
        input.width,
        input.height,
        input.image_type,
        input.volume_id.as_deref(),
        input.slice_index,
        input.mask_hash.as_deref(),
    )
    .await
    .stringify_err()?;
    AppContext::send_event(FrontendEvent::DbChanged);
    Ok(result)
}

#[tauri::command]
pub async fn db_get_image_by_hash(hash: String) -> CmdResult<Option<db::models::image::Image>> {
    logging!(info, Type::Cmd, "db_get_image_by_hash: hash={}", hash);
    let mut db = AppContext::db().clone();
    image_ops::get_image_by_hash(&mut db, &hash)
        .await
        .stringify_err()
}

#[tauri::command]
pub async fn db_list_images_by_volume(
    volume_id: String,
) -> CmdResult<Vec<db::models::image::Image>> {
    logging!(info, Type::Cmd, "db_list_images_by_volume: volume_id={}", volume_id);
    let mut db = AppContext::db().clone();
    image_ops::list_images_by_volume(&mut db, &volume_id)
        .await
        .stringify_err()
}

#[tauri::command]
pub async fn db_update_mask_hash(
    hash: String,
    mask_hash: Option<String>,
) -> CmdResult<db::models::image::Image> {
    logging!(info, Type::Cmd, "db_update_mask_hash: hash={}", hash);
    let mut db = AppContext::db().clone();
    let result = image_ops::update_mask_hash(&mut db, &hash, mask_hash.as_deref())
        .await
        .stringify_err()?;
    AppContext::send_event(FrontendEvent::DbChanged);
    Ok(result)
}

// ─── Annotation commands ───────────────────────────────────────────

#[tauri::command]
pub async fn db_set_annotations(
    hash: String,
    annotations: Vec<AnnotationInput>,
) -> CmdResult<db::models::image::Image> {
    logging!(
        info,
        Type::Cmd,
        "db_set_annotations: hash={}, count={}",
        hash,
        annotations.len()
    );
    let mut db = AppContext::db().clone();
    let result = annotation_ops::set_annotations(&mut db, &hash, annotations)
        .await
        .stringify_err()?;
    AppContext::send_event(FrontendEvent::DbChanged);
    Ok(result)
}

#[tauri::command]
pub async fn db_nearest_visual_box(
    image_hash: String,
    label_id: uuid::Uuid,
) -> CmdResult<Option<NearestVisual>> {
    logging!(
        info,
        Type::Cmd,
        "db_nearest_visual_box: image_hash={}, label_id={}",
        image_hash,
        label_id
    );
    let mut db = AppContext::db().clone();
    annotation_ops::nearest_visual_box(&mut db, &image_hash, label_id)
        .await
        .stringify_err()
}

#[tauri::command]
pub async fn db_list_annotations_by_image(hash: String) -> CmdResult<Vec<db::models::annotation::Annotation>> {
    logging!(info, Type::Cmd, "db_list_annotations_by_image: hash={}", hash);
    let mut db = AppContext::db().clone();
    annotation_ops::list_annotations_by_image(&mut db, &hash)
        .await
        .stringify_err()
}

#[tauri::command]
pub async fn db_list_annotation_counts(volume_id: String) -> CmdResult<Vec<AnnotationCount>> {
    logging!(
        info,
        Type::Cmd,
        "db_list_annotation_counts: volume_id={}",
        volume_id
    );
    let mut db = AppContext::db().clone();
    annotation_ops::list_annotation_counts(&mut db, &volume_id)
        .await
        .stringify_err()
}
