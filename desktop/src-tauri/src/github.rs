use serde::Serialize;
use std::process::Command;

const REPO: &str = "autokernel-sz/kerwork";

#[derive(Serialize)]
pub struct PullRequest {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub merged: bool,
    pub branch: String,
    pub author: String,
    pub updated_at: String,
    pub created_at: String,
    pub review_comments: u64,
    pub html_url: String,
    pub body: Option<String>,
}

fn get_github_token() -> Result<String, String> {
    let output = Command::new("git")
        .arg("credential-osxkeychain")
        .arg("get")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(b"protocol=https\nhost=github.com\n\n")?;
            }
            child.wait_with_output()
        })
        .map_err(|e| format!("failed to run git credential: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(token) = line.strip_prefix("password=") {
            return Ok(token.trim().to_string());
        }
    }
    Err("no GitHub token found in git credential helper".to_string())
}

pub async fn fetch_pull_requests() -> Result<Vec<PullRequest>, String> {
    let token = get_github_token()?;
    let client = reqwest::Client::new();

    let url = format!(
        "https://api.github.com/repos/{REPO}/pulls?state=all&per_page=30&sort=updated&direction=desc"
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "KerFlow")
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let pulls: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("parse error: {e}"))?;

    // get current user
    let user_resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "KerFlow")
        .send()
        .await
        .map_err(|e| format!("user request failed: {e}"))?;

    let user: serde_json::Value = user_resp
        .json()
        .await
        .map_err(|e| format!("user parse error: {e}"))?;
    let username = user["login"].as_str().unwrap_or("").to_string();

    let mut result = Vec::new();
    if let Some(arr) = pulls.as_array() {
        for pr in arr {
            let author = pr["user"]["login"].as_str().unwrap_or("").to_string();
            if author != username {
                continue;
            }
            result.push(PullRequest {
                number: pr["number"].as_u64().unwrap_or(0),
                title: pr["title"].as_str().unwrap_or("").to_string(),
                state: pr["state"].as_str().unwrap_or("").to_string(),
                merged: !pr["merged_at"].is_null(),
                branch: pr["head"]["ref"].as_str().unwrap_or("").to_string(),
                author,
                updated_at: pr["updated_at"].as_str().unwrap_or("").to_string(),
                created_at: pr["created_at"].as_str().unwrap_or("").to_string(),
                review_comments: pr["review_comments"].as_u64().unwrap_or(0),
                html_url: pr["html_url"].as_str().unwrap_or("").to_string(),
                body: pr["body"].as_str().map(|s| s.to_string()),
            });
        }
    }

    Ok(result)
}
