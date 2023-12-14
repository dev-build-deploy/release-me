/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import * as commit from "@dev-build-deploy/commit-it";
import { SemVer } from "@dev-build-deploy/version-it";
import type { components as octokitComponents } from "@octokit/openapi-types";

import * as branching from "./branching";
import * as versioning from "./versioning";

type Release = octokitComponents["schemas"]["release"];
type Commit = octokitComponents["schemas"]["commit"];

/**
 * Creates a new GitHub Release, incl:
 *   Generated Release Notes
 *   Uploaded artifacts
 * @param version
 * @param commits
 * @returns
 */
export async function createRelease(version: versioning.Version, body: string): Promise<Release> {
  core.info(`🎁 Creating GitHub Release ${version.toString()}...`);
  const octokit = github.getOctokit(core.getInput("token"));
  const { data: release } = await octokit.rest.repos.createRelease({
    ...github.context.repo,
    name: version.toString(),
    body,
    draft: core.getBooleanInput("draft"),
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
 * Retrieve a GitHub Release by tag or name
 * @param id The tag or name of the release
 * @param type The type of the release identifier
 * @returns The release object
 */
export async function getRelease(id: string, type: "tag" | "name"): Promise<Release | undefined> {
  const octokit = github.getOctokit(core.getInput("token"));

  switch (type) {
    case "tag": {
      const { data: release } = await octokit.rest.repos.getReleaseByTag({ ...github.context.repo, tag: id });
      return release;
    }

    case "name": {
      const releases: Release[] = [];

      for await (const page of octokit.paginate.iterator(octokit.rest.repos.listReleases, {
        ...github.context.repo,
        per_page: 100,
      })) {
        releases.push(...page.data);
      }

      const matches = releases.filter(r => r.name === id);
      if (matches.length > 1) {
        throw new Error("Multiple releases found with the same name!");
      }
      return matches.length === 1 ? matches[0] : undefined;
    }
  }
}

/**
 * Retrieve GitHub Releases, sorted by SemVer
 * @returns List of releases
 */
async function getReleases(branch: branching.IBranch, versionScheme: versioning.VersionScheme): Promise<Release[]> {
  const octokit = github.getOctokit(core.getInput("token"));
  const releases: Release[] = [];

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
): Promise<Release | undefined> {
  core.info("🔍 Retrieving GitHub Releases");
  const releases = await getReleases(branch, versionScheme);
  if (releases.length === 0) {
    core.warning("⚠️ No releases matching current configuration found...");
    return;
  }
  return releases[releases.length - 1];
}

/**
 * Retrieve the commits since the provided ref
 * @param ref The git ref to compare against
 * @returns List of commits
 */
export async function getChangesSince(ref: string): Promise<commit.ICommit[]> {
  const octokit = github.getOctokit(core.getInput("token"));
  const commits: Commit[] = [];

  for await (const response of octokit.paginate.iterator(octokit.rest.repos.compareCommitsWithBasehead, {
    ...github.context.repo,
    basehead: `${ref}...${github.context.sha}`,
  })) {
    commits.push(...response.data.commits);
  }

  return commits.map(c => commit.getCommit({ hash: c.sha, message: c.commit.message }));
}

/**
 * Determines the initial commit in the current branch
 * @returns The initial commit
 */
export async function getInitialCommit(): Promise<commit.ICommit> {
  const octokit = github.getOctokit(core.getInput("token"));
  const commits: Commit[] = [];

  for await (const response of octokit.paginate.iterator(octokit.rest.repos.listCommits, {
    ...github.context.repo,
    sha: github.context.ref.replace("refs/heads/", ""),
  })) {
    commits.push(...response.data);
  }

  const commitMap = commits.map(c => commit.getCommit({ hash: c.sha, message: c.commit.message }));
  return commitMap[commitMap.length - 1];
}
