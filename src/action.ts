/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs";
import * as path from "path";

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
 * Asset information
 * @interface IAsset
 * @member name The filename (path) of the asset
 * @member label The label of the asset
 */
interface IAsset {
  name: string;
  label?: string;
}

/**
 * Downloads the list of artifacts
 * @param artifacts List of artifacts to download
 * @returns List of filepaths towards the downloaded artifacts
 */
async function downloadArtifacts(artifacts: string[]): Promise<IAsset[]> {
  const client = artifact.create();
  const filepaths: IAsset[] = [];
  for (const artifact of artifacts) {
    core.startGroup(`📡 Downloading artifact: ${artifact}`);

    const dirname = `release-me-asset-${artifact.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
    const resp = await client.downloadArtifact(artifact, dirname, { createArtifactFolder: false });
    console.log(resp);
    for (const file of fs.readdirSync(dirname)) {
      filepaths.push({ name: path.join(dirname, file), label: artifact });
    }

    core.endGroup();
  }

  return filepaths;
}

/**
 * Uploads the list of artifacts to the GitHub Release
 * @param assets List of artifacts to upload
 */
async function uploadAssets(id: number, assets: IAsset[]) {
  const octokit = github.getOctokit(core.getInput("token"));

  for (const asset of assets) {
    core.info(`🔗 Uploading ${asset.label ? asset.label : asset.name}...`);
    if (!fs.existsSync(asset.name)) {
      throw new Error(`File ${asset.name} does not exist!`);
    }

    const data = fs.readFileSync(asset.name, { encoding: "utf8" });

    await octokit.rest.repos.uploadReleaseAsset({
      ...github.context.repo,
      release_id: id,
      name: asset.name,
      label: asset.label ? asset.label : asset.name,
      data: data,
    });
  }
}

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

/**
 * Creates a new GitHub Release, incl:
 *   Generated Release Notes
 *   Uploaded artifacts
 * @param version
 * @param commits
 * @returns
 */
async function createRelease(version: SemVer, commits: IConventionalCommit[]) {
  const octokit = github.getOctokit(core.getInput("token"));

  const releaseConfig: IReleaseObject = {
    name: version.toString(),
    body: await generateChangelog(commits),
    draft: false,
    prerelease: version.preRelease !== undefined,
    make_latest: version.preRelease === undefined ? "true" : "false",
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

    const prefix = core.getInput("prefix") ?? undefined;
    const newVersion = new SemVer(latestRelease.tag_name, prefix).increment(increment);

    core.info(`📦 Creating GitHub Release...`);
    const release = await createRelease(newVersion, commits);
    const files = [
      ...(await downloadArtifacts(core.getMultilineInput("artifacts") ?? [])),
      ...(core.getMultilineInput("files") ?? []).map(f => ({ name: f, label: f })),
    ];
    await uploadAssets(release.id, files);

    core.setOutput("release", JSON.stringify(release));
    core.setOutput("created", true);
    core.info(`✅ Created GitHub Release ${newVersion}!`);
  } catch (ex) {
    core.setFailed((ex as Error).message);
  }
}
