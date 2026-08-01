use crate::config::dirs;
use tauri::Builder;

pub fn setup_plugins(builder: Builder<tauri::Wry>) -> Builder<tauri::Wry> {
    let store_dir = dirs::app_store_dir().expect("failed to resolve store directory");
    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_pinia::Builder::new()
                .path(&store_dir)
                .build(),
        )
}

pub fn setup_protocols(builder: Builder<tauri::Wry>) -> Builder<tauri::Wry> {
    builder.register_uri_scheme_protocol("cache", crate::utils::cache_protocol::cache_protocol_handler)
}

pub fn generate_handlers() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static
{
    tauri::generate_handler![
        crate::cmd::general::greet,
        crate::cmd::general::log_message,
        crate::cmd::general::cache_store_path,
        crate::cmd::log::set_log_level,
        crate::cmd::mcp::mcp_list_tools,
        crate::cmd::mcp::mcp_server_status,
        crate::cmd::mcp::mcp_server_info,
        crate::cmd::mcp::mcp_list_prompts,
        crate::cmd::mcp::mcp_list_resources,
        crate::cmd::config::get_config,
        crate::cmd::config::update_config,
        crate::cmd::raw3d::open_raw,
        crate::cmd::raw3d::has_raw,
        crate::cmd::raw3d::raw_slice,
        crate::cmd::raw3d::parquet_export_masks,
        crate::cmd::raw3d::raw_close,
        crate::cmd::db::db_create_label,
        crate::cmd::db::db_list_labels,
        crate::cmd::db::db_update_label,
        crate::cmd::db::db_reorder_labels,
        crate::cmd::db::db_delete_label,
        crate::cmd::db::db_upsert_image,
        crate::cmd::db::db_get_image_by_hash,
        crate::cmd::db::db_list_images_by_volume,
        crate::cmd::db::db_update_mask_hash,
        crate::cmd::db::db_set_annotations,
        crate::cmd::db::db_nearest_visual_box,
    ]
}
