import { PRItem } from "./types";

const GITHUB_API = "https://api.github.com";

export async function fetchUserPRs(
  accessToken: string,
  repo: string
): Promise<PRItem[]> {
  const [owner, repoName] = repo.split("/");

  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repoName}/pulls?state=all&per_page=30&sort=updated&direction=desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
      next: { revalidate: 0 },
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const pulls = await res.json();

  const userRes = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const user = await userRes.json();
  const username = user.login;

  const userPRs = pulls.filter(
    (pr: any) => pr.user.login === username
  );

  return userPRs.map((pr: any) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: pr.merged_at !== null,
    branch: pr.head.ref,
    author: pr.user.login,
    updatedAt: pr.updated_at,
    createdAt: pr.created_at,
    reviewComments: pr.review_comments,
    htmlUrl: pr.html_url,
    body: pr.body,
  }));
}
