/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import * as branching from "./branching";
import * as commit from "@dev-build-deploy/commit-it";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as octokit from "@octokit/plugin-rest-endpoint-methods";
import * as versioning from "./versioning";

import { SemVer } from "@dev-build-deploy/version-it";

/**
 * Creates a new GitHub Release, incl:
 *   Generated Release Notes
 *   Uploaded artifacts
 * @param version
 * @param commits
 * @returns
 */
export async function createRelease(
  version: versioning.Version,
  body: string
): Promise<octokit.RestEndpointMethodTypes["repos"]["createRelease"]["response"]["data"]> {
  core.info(`🎁 Creating GitHub Release ${version.toString()}...`);
  const octokit = github.getOctokit(core.getInput("token"));

  const { data: release } = await octokit.rest.repos.createRelease({
    ...github.context.repo,
    name: version.toString(),
    body,
    draft: false,
    prerelease: version instanceof SemVer ? version.preRelease !== undefined : false,
    make_latest: branching.getBranch().type === "default" ? "true" : "false",
    tag_name: version.toString(),
    target_commitish: github.context.ref,
    generate_release_notes: false,
    discussion_category_name: undefined,
  });

  return release;
}

/**
 * Retrieve a GitHub Release by tag
 * @param version
 * @returns
 */
export async function getRelease(
  version: string
): Promise<octokit.RestEndpointMethodTypes["repos"]["createRelease"]["response"]["data"]> {
  const octokit = github.getOctokit(core.getInput("token"));
  const { data: release } = await octokit.rest.repos.getReleaseByTag({ ...github.context.repo, tag: version });
  return release;
}

/**
 * Retrieve GitHub Releases, sorted by SemVer
 * @returns List of releases
 */
async function getReleases(branch: branching.IBranch, versionScheme: versioning.VersionScheme) {
  const octokit = github.getOctokit(core.getInput("token"));
  const releases: octokit.RestEndpointMethodTypes["repos"]["listReleases"]["response"]["data"] = [];

  for await (const page of octokit.paginate.iterator(octokit.rest.repos.listReleases, {
    ...github.context.repo,
  })) {
    releases.push(...page.data);
  }

  const sortedreleases = releases
    .filter(r => versionScheme.isValid(r.tag_name))
    .sort((a, b) =>
      versioning.compareVersions(versionScheme.createVersion(a.tag_name), versionScheme.createVersion(b.tag_name))
    );

  if (branch.type === "release" && branch.modifier !== undefined) {
    const modifier = branch.modifier;
    const hotfixReleases = sortedreleases.filter(r => r.tag_name.startsWith(modifier));
    if (hotfixReleases.length === 0) {
      throw new Error("Incorrect release branch pattern, no releases found!");
    }
    return hotfixReleases;
  }

  return sortedreleases;
}

/**
 * Retrieves the latest GitHub Release associated with your current versioning strategy and branch.
 * @param branch
 * @param versionScheme
 * @returns
 */
export async function getLatestRelease(
  branch: branching.IBranch,
  versionScheme: versioning.VersionScheme
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<octokit.RestEndpointMethodTypes["repos"]["createRelease"]["response"]["data"] | undefined> {
  core.info("🔍 Retrieving GitHub Releases");
  const releases = await getReleases(branch, versionScheme);
  if (releases.length === 0) {
    core.warning("⚠️ No releases matching current configuration found...");
    return;
  }
  return releases[releases.length - 1];
}

/**
 * Retrieve the commits since the provided tag
 * @param tag The tag to compare against
 * @returns List of commits
 */
export async function getChangesSinceRelease(tag: string): Promise<commit.ICommit[]> {
  const octokit = github.getOctokit(core.getInput("token"));

  const { data: commits } = await octokit.rest.repos.compareCommitsWithBasehead({
    ...github.context.repo,
    basehead: `refs/tags/${tag}...${github.context.sha}`,
  });

  return commits.commits.map(c => commit.getCommit({ hash: c.sha, message: c.commit.message }));
}
