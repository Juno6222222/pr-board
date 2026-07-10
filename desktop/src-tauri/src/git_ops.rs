use serde::Serialize;
use std::process::Command;

fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("failed to run git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Current branch + list of local branches.
#[derive(Serialize)]
pub struct BranchInfo {
    pub current: String,
    pub branches: Vec<String>,
}

#[tauri::command]
pub fn git_branch_info(cwd: String) -> Result<BranchInfo, String> {
    let current = run_git(&cwd, &["rev-parse", "--abbrev-ref", "HEAD"])?
        .trim()
        .to_string();

    let raw = run_git(&cwd, &["branch", "--format=%(refname:short)"])?;
    let branches: Vec<String> = raw
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    Ok(BranchInfo { current, branches })
}

/// Working tree status: list of changed file paths.
#[derive(Serialize)]
pub struct GitStatus {
    pub current_branch: String,
    pub changed_files: Vec<String>,
}

#[tauri::command]
pub fn git_status(cwd: String) -> Result<GitStatus, String> {
    let current_branch = run_git(&cwd, &["rev-parse", "--abbrev-ref", "HEAD"])?
        .trim()
        .to_string();

    let raw = run_git(&cwd, &["status", "--porcelain"])?;
    let changed_files: Vec<String> = raw
        .lines()
        .map(|l| l.get(3..).unwrap_or("").trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    Ok(GitStatus {
        current_branch,
        changed_files,
    })
}

/// Create a new branch from a base branch and check it out.
#[tauri::command]
pub fn git_create_branch(cwd: String, base: String, new_branch: String) -> Result<String, String> {
    // Ensure base is up to date, then branch from it.
    run_git(&cwd, &["checkout", &base])?;
    run_git(&cwd, &["checkout", "-b", &new_branch])?;
    Ok(format!("已从 {base} 创建并切换到 {new_branch}"))
}

/// Stage all, commit, and push to origin on the current branch.
#[tauri::command]
pub fn git_commit_push(cwd: String, message: String) -> Result<String, String> {
    let branch = run_git(&cwd, &["rev-parse", "--abbrev-ref", "HEAD"])?
        .trim()
        .to_string();

    run_git(&cwd, &["add", "-A"])?;
    run_git(&cwd, &["commit", "-m", &message])?;
    run_git(&cwd, &["push", "-u", "origin", &branch])?;

    Ok(format!("已提交并推送到 origin/{branch}"))
}
