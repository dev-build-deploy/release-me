/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import { Commit, ConventionalCommit } from "@dev-build-deploy/commit-it";

import * as assets from "./assets";
import * as branching from "./branching";
import * as changelog from "./changelog";
import * as releasing from "./releasing";
import * as versioning from "./versioning";

/**
 * Filters the provided commits to only include Conventional Commits
 * @param commits The commits to filter
 * @returns List of Conventional Commits
 * @internal
 */
export function filterConventionalCommits(commits: Commit[]): ConventionalCommit[] {
  return commits.map(c => ConventionalCommit.fromCommit(c)).filter(c => c.isValid);
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
    const versionOverride = core.getInput("version");

    const effectivePaths = core.getMultilineInput("paths").filter(p => p.trim() !== "");

    let newVersion: versioning.Version;
    const commits: ConventionalCommit[] = [];

    core.startGroup("🔍 Determining increment type");
    if (versionOverride) {
      core.info(`ℹ️ Using version override: ${versionOverride}`);
      newVersion = versionScheme.createVersion(versionOverride);
      core.setOutput("incremented-version", newVersion.toString());
    } else {
      let latestRef: string;
      let latestVersion: versioning.Version;

      const latestRelease = await releasing.getLatestRelease(branch, versionScheme);

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
      if (core.getInput("increment-type")) {
        increments.push(
          ...core
            .getInput("increment-type")
            .split("|")
            .map(inc => versioning.getIncrementType(versionScheme, inc))
        );
      } else {
        const { commits: delta, comparisonFiles } = await releasing.getChangesSince(latestRef);

        let filteredDelta = delta;
        if (effectivePaths.length > 0) {
          core.info(`ℹ️ Filtering commits by paths: ${effectivePaths.join(", ")}`);
          filteredDelta = await releasing.filterCommitsByPaths(delta, comparisonFiles, effectivePaths);
          core.info(`ℹ️ Commits after path filter: ${filteredDelta.length}`);
        } else {
          core.info(`ℹ️ Changes since: ${delta.length} commits`);
        }

        commits.push(...filterConventionalCommits(filteredDelta));
        core.info(`ℹ️ Conventional Commits since: ${commits.length} commits`);

        const increment = versionScheme.determineIncrementType(commits);
        if (increment === undefined) {
          core.info("⚠️ No increment required, skipping...");
          core.endGroup();
          return;
        }
        increments.push(increment);
      }

      core.setOutput("previous-version", latestVersion.toString());
      newVersion = versioning.incrementVersion(latestVersion, increments);
      core.setOutput("incremented-version", newVersion.toString());
    }
    core.endGroup();

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
