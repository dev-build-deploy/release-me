/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
*/

import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import * as fs from "fs";
import * as github from "@actions/github";
import * as path from "path";

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

    const dirname = `_assets/${artifact.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
    await client.downloadArtifact(artifact, dirname, { createArtifactFolder: false });

    for (const file of fs.readdirSync(dirname)) {
      filepaths.push({ name: path.join(dirname, file), label: artifact });
    }
    core.endGroup();
  }

  return filepaths;
}

/**
 * Removes the list of assets from the provided GitHub Release identifier
 *
 * @param id The GitHub Release identifier
 */
export async function removeAssets(id: number): Promise<void> {
  const assets = (core.getMultilineInput("remove") ?? []).map(f => ({ name: f, label: f }));

  const octokit = github.getOctokit(core.getInput("token"));
  const { data: currentAssets } = await octokit.rest.repos.listReleaseAssets({
    ...github.context.repo,
    release_id: id,
  });

  for (const asset of assets) {
    core.info(`🔥 Removing ${asset.label ? asset.label : asset.name}...`);
    const matchedAsset = currentAssets.find(a => a.label === asset.label);

    if (matchedAsset !== undefined) {
      await octokit.rest.repos.deleteReleaseAsset({ ...github.context.repo, asset_id: matchedAsset.id });
    } else {
      throw new Error(`Asset ${asset.label} not found!`);
    }
  }
}

/**
 * Uploads the list of build artifacts or local files to the GitHub Release;
 * - Local files are provided using the `files` input parameter
 * - Artifacts are provided using the `artifacts` input parameter
 *
 * NOTE: this function will delete any existing assets with the same name
 *       before uploading the new assets.
 *
 * @param id The GitHub Release identifier
 * @internal
 */
export async function updateAssets(id: number): Promise<void> {
  const assets = [
    ...(await downloadArtifacts(core.getMultilineInput("artifacts") ?? [])),
    ...(core.getMultilineInput("files") ?? []).map(f => ({ name: f, label: f })),
  ];

  const octokit = github.getOctokit(core.getInput("token"));

  const { data: currentAssets } = await octokit.rest.repos.listReleaseAssets({
    ...github.context.repo,
    release_id: id,
  });

  for (const asset of assets) {
    core.info(`🔗 Uploading ${asset.label ? asset.label : asset.name}...`);
    if (!fs.existsSync(asset.name)) {
      throw new Error(`File ${asset.name} does not exist!`);
    }

    const matchedAsset = currentAssets.find(a => a.label === asset.label);
    if (matchedAsset !== undefined) {
      await octokit.rest.repos.deleteReleaseAsset({ ...github.context.repo, asset_id: matchedAsset.id });
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
 * Downloads the list of assets from the provided GitHub Release identifier
 * @param id The GitHub Release identifier
 * @param assets List of assets to download
 */
export async function downloadAssets(id: number): Promise<void> {
  const assets = (core.getMultilineInput("download") ?? []).map(f => ({ name: f, label: f }));

  const octokit = github.getOctokit(core.getInput("token"));
  const { data: currentAssets } = await octokit.rest.repos.listReleaseAssets({
    ...github.context.repo,
    release_id: id,
  });

  for (const asset of assets) {
    core.startGroup(`📡 Downloading ${asset.label ? asset.label : asset.name}...`);
    const matchedAsset = currentAssets.find(a => a.label === asset.label);

    if (matchedAsset !== undefined) {
      const { data: local } = await octokit.rest.repos.getReleaseAsset({
        ...github.context.repo,
        asset_id: matchedAsset.id,
      });
      core.info(`✅ Downloaded ${asset.label ? asset.label : asset.name} to _assets/${local.name.split(".")[1]}/!`);
    } else {
      throw new Error(`Asset ${asset.label} not found!`);
    }
    core.endGroup();
  }
}
