/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import * as core from "@actions/core";
import * as github from "@actions/github";
import { ISemVer, SemVer } from "@dev-build-deploy/version-it";
import {
  ConventionalCommitError,
  ICommit,
  IConventionalCommit,
  getCommit,
  getConventionalCommit,
} from "@dev-build-deploy/commit-it";
import { generateChangelog } from "./changelog";
import { IReleaseObject } from "./release";

/**
 * Retrieve GitHub Releases, sorted by SemVer
 * @returns List of releases
 */
async function getReleases() {
  const octokit = github.getOctokit(core.getInput("token"));
  const prefix = core.getInput("prefix") ?? undefined;

  const { data: releases } = await octokit.rest.repos.listReleases({ ...github.context.repo });
  return releases
    .filter(r => {
      try {
        new SemVer(r.tag_name, prefix);
      } catch (error) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new SemVer(a.tag_name, prefix).compareTo(new SemVer(b.tag_name, prefix)));
}

/**
 * Retrieve the commits since the provided tag
 * @param tag The tag to compare against
 * @returns List of commits
 */
async function getChangesSinceRelease(tag: string): Promise<ICommit[]> {
  const octokit = github.getOctokit(core.getInput("token"));

  const { data: commits } = await octokit.rest.repos.compareCommitsWithBasehead({
    ...github.context.repo,
    basehead: `refs/tags/${tag}...${github.context.sha}`,
  });

  return commits.commits.map(c => getCommit({ hash: c.sha, message: c.commit.message }));
}

/**
 * Determines the increment type based on the provided Conventional Commits
 * @param commits
 * @returns The increment type ("major", "minor", "patch" or undefined)
 * @internal
 */
export function determineIncrementType(commits: IConventionalCommit[]): keyof ISemVer | undefined {
  const typeCount: { [key: string]: number } = { feat: 0, fix: 0 };

  for (const commit of commits) {
    try {
      if (commit.breaking) return "major";
      typeCount[commit.type]++;
    } catch (error) {
      if (!(error instanceof ConventionalCommitError)) throw error;
    }
  }

  if (typeCount.feat > 0) return "minor";
  if (typeCount.fix > 0) return "patch";

  return;
}

/**
 * Filters the provided commits to only include Conventional Commits
 * @param commits The commits to filter
 * @returns List of Conventional Commits
 * @internal
 */
export function filterConventionalCommits(commits: ICommit[]): IConventionalCommit[] {
  return commits
    .map(c => {
      try {
        return getConventionalCommit(c);
      } catch (error) {
        if (!(error instanceof ConventionalCommitError)) throw error;
      }
    })
    .filter(c => c !== undefined) as IConventionalCommit[];
}

async function createRelease(version: SemVer, commits: IConventionalCommit[]) {
  const octokit = github.getOctokit(core.getInput("token"));

  const releaseConfig: IReleaseObject = {
    name: version.toString(),
    body: generateChangelog(commits),
    draft: false,
    prerelease: version.preRelease !== undefined,
    make_latest: version.preRelease === undefined ? "true" : "false",
    tag_name: version.toString(),
    target_commitish: github.context.ref,
  };

  await octokit.rest.repos.createRelease({
    ...github.context.repo,
    ...releaseConfig,
    generate_release_notes: false,
    discussion_category_name: undefined,
  });

  return releaseConfig;
}

/**
 * Determines whether the current branch is the default branch.
 * @returns True if the current branch is the default branch, false otherwise
 */
function isDefaultBranch() {
  const currentBranch = github.context.ref.replace("refs/heads/", "");
  return currentBranch === github.context.payload.repository?.default_branch;
}

/**
 * Main entry point for the GitHub Action.
 * @internal
 */
export async function run(): Promise<void> {
  try {
    core.info("📄 ReleaseMe - GitHub Release Management");
    if (!isDefaultBranch()) {
      core.warning(`⚠️ Not on default branch, skipping...`);
      return;
    }

    core.startGroup("🔍 Retrieving GitHub Releases");
    const releases = await getReleases();
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
    const increment = determineIncrementType(commits);

    if (increment === undefined) {
      core.info("⚠️ No increment required, skipping...");
      core.endGroup();
      return;
    }
    core.endGroup();

    core.startGroup("📝 Creating GitHub Release");
    const prefix = core.getInput("prefix") ?? undefined;
    const newVersion = new SemVer(latestRelease.tag_name, prefix).increment(increment);

    core.info(`Next version will be: ${newVersion}`);
    const release = await createRelease(newVersion, commits);
    core.setOutput("release", JSON.stringify(release));
    core.setOutput("created", true);
    core.endGroup();
  } catch (ex) {
    core.setFailed((ex as Error).message);
  }
}
