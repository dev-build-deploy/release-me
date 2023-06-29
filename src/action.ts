/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import * as assets from "./assets";
import * as branching from "./branching";
import * as changelog from "./changelog";
import * as commitLib from "@dev-build-deploy/commit-it";
import * as core from "@actions/core";
import * as releasing from "./releasing";
import * as versioning from "./versioning";

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
 * Main entry point for the GitHub Action.
 * @internal
 */
export async function run(): Promise<void> {
  try {
    core.info("📄 ReleaseMe - GitHub Release Management");

    const branch = branching.getBranch();
    const versionScheme = versioning.getVersionScheme();
    const latestRelease = await releasing.getLatestRelease(branch, versionScheme);
    if (latestRelease === undefined) {
      return;
    }

    core.startGroup("🔍 Determining increment type");
    core.info(`ℹ️ Latest release: ${latestRelease.tag_name}`);
    const delta = await releasing.getChangesSinceRelease(latestRelease.tag_name);
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
    const release = await releasing.createRelease(newVersion, body);
    await assets.updateAssets(release.id);
    core.endGroup();

    core.setOutput("release", JSON.stringify(release));
    core.setOutput("created", true);
    core.info(`✅ Created GitHub Release ${newVersion}!`);
  } catch (ex) {
    core.setFailed((ex as Error).message);
  }
}
