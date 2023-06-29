/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import * as assets from "./assets";
import * as branching from "./branching";
import * as changelog from "./changelog";
import * as commitLib from "@dev-build-deploy/commit-it";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as versioning from "./versioning";

import { SemVer } from "@dev-build-deploy/version-it";
import { IReleaseObject } from "./release";

/**
 * Retrieve GitHub Releases, sorted by SemVer
 * @returns List of releases
 */
async function getReleases(branch: branching.IBranch, versionScheme: versioning.VersionScheme) {
  const octokit = github.getOctokit(core.getInput("token"));
  const { data: releases } = await octokit.rest.repos.listReleases({ ...github.context.repo });

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
 * Retrieve the commits since the provided tag
 * @param tag The tag to compare against
 * @returns List of commits
 */
async function getChangesSinceRelease(tag: string): Promise<commitLib.ICommit[]> {
  const octokit = github.getOctokit(core.getInput("token"));

  const { data: commits } = await octokit.rest.repos.compareCommitsWithBasehead({
    ...github.context.repo,
    basehead: `refs/tags/${tag}...${github.context.sha}`,
  });

  return commits.commits.map(c => commitLib.getCommit({ hash: c.sha, message: c.commit.message }));
}

/**
 * Filters the provided commits to only include Conventional Commits
 * @param commits The commits to filter
 * @returns List of Conventional Commits
 * @internal
 */
export function filterConventionalCommits(commits: commitLib.ICommit[]): commitLib.IConventionalCommit[] {
  return commits
    .map(c => {
      try {
        return commitLib.getConventionalCommit(c);
      } catch (error) {
        if (!(error instanceof commitLib.ConventionalCommitError)) throw error;
      }
    })
    .filter(c => c !== undefined) as commitLib.IConventionalCommit[];
}

/**
 * Creates a new GitHub Release, incl:
 *   Generated Release Notes
 *   Uploaded artifacts
 * @param version
 * @param commits
 * @returns
 */
async function createRelease(version: versioning.Version, body: string) {
  core.info(`🎁 Creating GitHub Release ${version.toString()}...`);
  const octokit = github.getOctokit(core.getInput("token"));

  const releaseConfig: IReleaseObject = {
    name: version.toString(),
    body: body,
    draft: false,
    prerelease: version instanceof SemVer ? version.preRelease !== undefined : false,
    make_latest: branching.getBranch().type === "default" ? "true" : "false",
    tag_name: version.toString(),
    target_commitish: github.context.ref,
  };

  const { data: release } = await octokit.rest.repos.createRelease({
    ...github.context.repo,
    ...releaseConfig,
    generate_release_notes: false,
    discussion_category_name: undefined,
  });

  return { id: release.id, ...releaseConfig };
}

/**
 * Main entry point for the GitHub Action.
 * @internal
 */
export async function run(): Promise<void> {
  try {
    core.info("📄 ReleaseMe - GitHub Release Management");

    const branch = branching.getBranch();
    const versionScheme = versioning.getVersionScheme();

    core.startGroup("🔍 Retrieving GitHub Releases");
    const releases = await getReleases(branch, versionScheme);
    if (releases.length === 0) {
      core.warning("⚠️ No releases found, skipping...");
      core.endGroup();
      return;
    }

    const latestRelease = releases[releases.length - 1];
    core.info(`ℹ️ Latest release: ${latestRelease.tag_name}`);
    const delta = await getChangesSinceRelease(latestRelease.tag_name);
    core.info(`ℹ️ Changes since latest release: ${delta.length} commits`);

    const commits = filterConventionalCommits(delta);
    core.info(`ℹ️ Conventional Commits since latest release: ${commits.length} commits`);
    const increment = versionScheme.determineIncrementType(commits);

    if (increment === undefined) {
      core.info("⚠️ No increment required, skipping...");
      core.endGroup();
      return;
    }
    core.endGroup();

    const newVersion = versioning.incrementVersion(versionScheme.createVersion(latestRelease.tag_name), increment);

    core.startGroup(`📦 Creating GitHub Release...`);
    const body = await changelog.generateChangelog(versionScheme, commits);
    const release = await createRelease(newVersion, body);
    await assets.updateAssets(release.id);
    core.endGroup();

    core.setOutput("release", JSON.stringify(release));
    core.setOutput("created", true);
    core.info(`✅ Created GitHub Release ${newVersion}!`);
  } catch (ex) {
    core.setFailed((ex as Error).message);
  }
}
