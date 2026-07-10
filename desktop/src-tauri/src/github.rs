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
    pub ai_review: Option<String>,
    pub ai_verdict: Option<String>,
}

fn get_github_token() -> Result<String, String> {    let output = Command::new("git")
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

const AI_REVIEW_TITLE: &str = "Product Proposal AI 审核";

/// Fetch the latest "Product Proposal AI 审核" comment for a PR.
/// Returns (full_body, verdict) where verdict is "PASS" | "FAIL" | "UNKNOWN".
async fn fetch_ai_review(
    client: &reqwest::Client,
    token: &str,
    pr_number: u64,
) -> Option<(String, String)> {
    let url = format!(
        "https://api.github.com/repos/{REPO}/issues/{pr_number}/comments?per_page=100"
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "KerFlow")
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let comments: serde_json::Value = resp.json().await.ok()?;
    let arr = comments.as_array()?;

    // find latest comment whose body contains the AI review title
    let mut latest: Option<&serde_json::Value> = None;
    for c in arr {
        let body = c["body"].as_str().unwrap_or("");
        let is_bot = c["user"]["type"].as_str() == Some("Bot");
        if is_bot && body.contains(AI_REVIEW_TITLE) {
            latest = Some(c);
        }
    }

    let comment = latest?;
    let body = comment["body"].as_str().unwrap_or("").to_string();

    let verdict = infer_verdict(&body);
    Some((body, verdict))
}

/// Look at the 结论 section to decide PASS / FAIL.
fn infer_verdict(body: &str) -> String {
    // Find text after "结论"
    let after = body.split("结论").nth(1).unwrap_or(body);
    // Take a window to avoid matching later sections
    let window: String = after.chars().take(200).collect();
    if window.contains("FAIL") {
        "FAIL".to_string()
    } else if window.contains("PASS") {
        "PASS".to_string()
    } else {
        "UNKNOWN".to_string()
    }
}

pub async fn fetch_pull_requests() -> Result<Vec<PullRequest>, String> {
    let token = get_github_token()?;
    let client = reqwest::Client::new();

    let url = format!(
        "https://api.github.com/repos/{REPO}/pulls?state=all&per_page=100&sort=updated&direction=desc"
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

    let mut result = Vec::new();
    if let Some(arr) = pulls.as_array() {
        for pr in arr {
            let title = pr["title"].as_str().unwrap_or("").to_string();
            // Only show product proposal PRs (title starts with "docs(proposal):").
            if !title.trim_start().to_lowercase().starts_with("docs(proposal):") {
                continue;
            }
            let author = pr["user"]["login"].as_str().unwrap_or("").to_string();
            let number = pr["number"].as_u64().unwrap_or(0);
            let (ai_review, ai_verdict) = match fetch_ai_review(&client, &token, number).await {
                Some((body, verdict)) => (Some(body), Some(verdict)),
                None => (None, None),
            };
            result.push(PullRequest {
                number,
                title,
                state: pr["state"].as_str().unwrap_or("").to_string(),
                merged: !pr["merged_at"].is_null(),
                branch: pr["head"]["ref"].as_str().unwrap_or("").to_string(),
                author,
                updated_at: pr["updated_at"].as_str().unwrap_or("").to_string(),
                created_at: pr["created_at"].as_str().unwrap_or("").to_string(),
                review_comments: pr["review_comments"].as_u64().unwrap_or(0),
                html_url: pr["html_url"].as_str().unwrap_or("").to_string(),
                body: pr["body"].as_str().map(|s| s.to_string()),
                ai_review,
                ai_verdict,
            });
        }
    }

    Ok(result)
}

/// Create a pull request via GitHub API.
#[tauri::command]
pub async fn create_pull_request(
    title: String,
    body: String,
    head: String,
    base: String,
) -> Result<String, String> {
    let token = get_github_token()?;
    let client = reqwest::Client::new();

    let url = format!("https://api.github.com/repos/{REPO}/pulls");
    let payload = serde_json::json!({
        "title": title,
        "body": body,
        "head": head,
        "base": base,
    });

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "KerFlow")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let status = resp.status();
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("parse error: {e}"))?;

    if !status.is_success() {
        let msg = json["message"].as_str().unwrap_or("unknown error");
        let details = json["errors"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|e| e["message"].as_str())
            .unwrap_or("");
        return Err(format!("创建 PR 失败：{msg} {details}"));
    }

    let html_url = json["html_url"].as_str().unwrap_or("").to_string();
    Ok(html_url)
}

/// Append a revision note to an existing PR's body (title & existing body unchanged).
/// Finds the open PR whose head branch matches `head`.
#[tauri::command]
pub async fn append_pr_body(head: String, note: String) -> Result<String, String> {
    let token = get_github_token()?;
    let client = reqwest::Client::new();

    let owner = REPO.split('/').next().unwrap_or("");
    // Find open PR for this head branch.
    let list_url =
        format!("https://api.github.com/repos/{REPO}/pulls?state=open&head={owner}:{head}");
    let resp = client
        .get(&list_url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "KerFlow")
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let pulls: serde_json::Value = resp.json().await.map_err(|e| format!("parse error: {e}"))?;
    let pr = pulls
        .as_array()
        .and_then(|arr| arr.first())
        .ok_or("未找到该分支对应的开放 PR")?;

    let number = pr["number"].as_u64().ok_or("PR number missing")?;
    let old_body = pr["body"].as_str().unwrap_or("");
    let new_body = format!("{old_body}\n\n{note}");

    let patch_url = format!("https://api.github.com/repos/{REPO}/pulls/{number}");
    let payload = serde_json::json!({ "body": new_body });
    let patch_resp = client
        .patch(&patch_url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "KerFlow")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("update failed: {e}"))?;

    if !patch_resp.status().is_success() {
        return Err(format!("更新 PR body 失败：{}", patch_resp.status()));
    }

    let updated: serde_json::Value = patch_resp
        .json()
        .await
        .map_err(|e| format!("parse error: {e}"))?;
    Ok(updated["html_url"].as_str().unwrap_or("").to_string())
}
