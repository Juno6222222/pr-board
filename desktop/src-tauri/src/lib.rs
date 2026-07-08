mod github;

#[tauri::command]
async fn fetch_pull_requests() -> Result<Vec<github::PullRequest>, String> {
    github::fetch_pull_requests().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![fetch_pull_requests])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
