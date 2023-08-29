/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
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

      return;
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

    core.startGroup("🔍 Determining increment type");
    const latestRelease = await releasing.getLatestRelease(branch, versionScheme);
    let latestRef: string;
    let latestVersion: versioning.Version;

    if (latestRelease) {
      core.info(`ℹ️ Latest release: ${latestRelease.tag_name}`);
      latestRef = latestRelease.tag_name;
      latestVersion = versionScheme.createVersion(latestRef);
    } else {
      // NOTE: Postponed this expensive request for the case where there is no release determined yet
      const initialCommit = await releasing.getInitialCommit();

      core.info(`ℹ️ Creating release based on commit SHA: ${initialCommit.hash}`);
      latestRef = initialCommit.hash;
      latestVersion = versionScheme.initialVersion();
    }

    const increments: versioning.VersionIncrement[] = [];
    const commits: commitLib.IConventionalCommit[] = [];
    if (core.getInput("increment-type")) {
      increments.push(...core.getInput("increment-type").split("|").map(inc => versioning.getIncrementType(versionScheme, inc)));
    } else {
      const delta = await releasing.getChangesSince(latestRef);
      core.info(`ℹ️ Changes since: ${delta.length} commits`);
  
      commits.push(...filterConventionalCommits(delta));
      core.info(`ℹ️ Conventional Commits since: ${commits.length} commits`);

      const increment = versionScheme.determineIncrementType(commits)
      if (increment === undefined) {
        core.info("⚠️ No increment required, skipping...");
        core.endGroup();
        return;
      }
      increments.push(increment);
    }
    core.endGroup();

    core.setOutput("previous-version", latestVersion.toString());
    const newVersion = versioning.incrementVersion(latestVersion, increments);
    core.setOutput("incremented-version", newVersion.toString());

    if (!core.getBooleanInput("create-release")) {
      return;
    }

    core.startGroup(`📦 Creating GitHub Release...`);

    const body = core.getInput("release-notes")
      ? await changelog.readChangelogFromFile(core.getInput("release-notes"))
      : await changelog.generateChangelog(versionScheme, commits);

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
