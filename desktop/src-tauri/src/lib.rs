mod github;
mod kerminal;
mod kerminal_binary;
mod kerminal_commands;

use kerminal_commands::KerminalState;

#[tauri::command]
async fn fetch_pull_requests() -> Result<Vec<github::PullRequest>, String> {
    github::fetch_pull_requests().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info"),
    )
    .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(KerminalState::default())
        .invoke_handler(tauri::generate_handler![
            fetch_pull_requests,
            kerminal_commands::kerminal_start,
            kerminal_commands::kerminal_new_conversation,
            kerminal_commands::kerminal_send_message,
            kerminal_commands::kerminal_respond_approval,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
