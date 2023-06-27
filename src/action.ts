/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs";
import * as path from "path";

import * as branching from "./branching";
import { SemVer } from "@dev-build-deploy/version-it";
import * as commitLib from "@dev-build-deploy/commit-it";
import * as changelog from "./changelog";
import { IReleaseObject } from "./release";
import * as versioning from "./versioning";

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
 * @internal
 */
export async function downloadArtifacts(artifacts: string[]): Promise<IAsset[]> {
  const client = artifact.create();
  const filepaths: IAsset[] = [];
  for (const artifact of artifacts) {
    core.startGroup(`📡 Downloading artifact: ${artifact}`);

    const dirname = `release-me-asset-${artifact.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
    await client.downloadArtifact(artifact, dirname, { createArtifactFolder: false });

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
    const increment = versionScheme.determineIncrementType(commits);

    if (increment === undefined) {
      core.info("⚠️ No increment required, skipping...");
      core.endGroup();
      return;
    }
    core.endGroup();

    const newVersion = versioning.incrementVersion(versionScheme.createVersion(latestRelease.tag_name), increment);

    core.info(`📦 Creating GitHub Release...`);
    const body = await changelog.generateChangelog(versionScheme, commits);
    const release = await createRelease(newVersion, body);
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
