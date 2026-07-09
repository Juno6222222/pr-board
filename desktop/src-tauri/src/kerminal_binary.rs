use std::path::PathBuf;

const BINARY_NAME: &str = "kerminal-aarch64-apple-darwin";

/// Resolve the kerminal binary path (dev + bundled).
pub fn resolve_kerminal_binary() -> Result<String, String> {
    // Dev mode: binaries/ next to Cargo manifest
    #[cfg(debug_assertions)]
    {
        let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(BINARY_NAME);
        if dev_path.exists() {
            return Ok(dev_path.to_string_lossy().to_string());
        }
    }

    // Bundled: next to the executable, or in Resources (macOS .app)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let candidate = parent.join(BINARY_NAME);
            if candidate.exists() {
                return Ok(candidate.to_string_lossy().to_string());
            }
            #[cfg(target_os = "macos")]
            {
                if let Some(contents) = parent.parent() {
                    let res = contents.join("Resources").join(BINARY_NAME);
                    if res.exists() {
                        return Ok(res.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    Err(format!("kerminal binary not found: {BINARY_NAME}"))
}
