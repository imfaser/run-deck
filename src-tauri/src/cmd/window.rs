use tauri::Manager;

#[tauri::command]
pub async fn open_label_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("label-settings") {
        w.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(
        &app,
        "label-settings",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("标注设置")
    .inner_size(600.0, 500.0)
    .resizable(true)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
