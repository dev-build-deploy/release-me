/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as fs from "fs";
import * as path from "path";

import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { minimatch } from "minimatch";

import type { IRepository } from "./releasing";

export const DEFAULT_ASSET_DIR = "_assets";

/**
 * Asset information
 * @interface IAsset
 * @member name The filename (path) of the asset
 * @member label The label of the asset
 */
interface IAsset {
  filepath: string;
  label: string;
}

function getAssetPath(asset: string): string {
  return path.join(
    DEFAULT_ASSET_DIR,
    path
      .parse(asset)
      .name.replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()
  );
}

/**
 * Downloads the list of artifacts
 * @param artifacts List of artifacts to download
 * @returns List of filepaths towards the downloaded artifacts
 */
async function downloadArtifacts(artifacts: string[]): Promise<IAsset[]> {
  const client = new artifact.DefaultArtifactClient();
  const filepaths: IAsset[] = [];
  for (const arti of artifacts) {
    core.startGroup(`📡 Downloading artifact: ${arti}`);

    const dirname = getAssetPath(arti);
    await client.downloadArtifact((await client.getArtifact(arti)).artifact.id, { path: dirname });

    filepaths.push(
      ...fs.readdirSync(dirname).map(file => {
        return { filepath: path.join(dirname, file), label: arti };
      })
    );

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
  const assets = core.getMultilineInput("remove") ?? [];

  if (assets.length === 0) {
    return;
  }

  const octokit = github.getOctokit(core.getInput("token"));
  const { data: currentAssets } = await octokit.rest.repos.listReleaseAssets({
    ...github.context.repo,
    release_id: id,
  });

  for (const asset of assets) {
    core.info(`🔥 Removing ${asset}...`);
    const matchedAsset = currentAssets.find(a => a.label === asset);

    if (matchedAsset === undefined) {
      throw new Error(`Asset ${asset} not found!`);
    }

    await octokit.rest.repos.deleteReleaseAsset({ ...github.context.repo, asset_id: matchedAsset.id });
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
    ...(core.getMultilineInput("files") ?? []).map(f => ({ filepath: f, label: f })),
  ];

  if (assets.length === 0) {
    return;
  }

  const octokit = github.getOctokit(core.getInput("token"));

  const { data: currentAssets } = await octokit.rest.repos.listReleaseAssets({
    ...github.context.repo,
    release_id: id,
  });

  for (const asset of assets) {
    core.info(`🔗 Uploading ${asset.label}...`);
    if (!fs.existsSync(asset.filepath)) {
      throw new Error(`Path '${asset.filepath}' does not exist!`);
    }

    const matchedAsset = currentAssets.find(a => a.label === asset.label);
    if (matchedAsset !== undefined) {
      await octokit.rest.repos.deleteReleaseAsset({ ...github.context.repo, asset_id: matchedAsset.id });
    }

    const data = fs.readFileSync(asset.filepath, { encoding: "utf8" });

    await octokit.rest.repos.uploadReleaseAsset({
      ...github.context.repo,
      release_id: id,
      name: path.parse(asset.filepath).base,
      label: asset.label,
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
  const assets: { label: string; output?: string }[] = (core.getMultilineInput("download") ?? []).map(
    (asset: string) => {
      const [assetLabel, outputFileName] = asset.split("=>").map(value => value.trim());
      return {
        label: assetLabel,
        output: outputFileName ?? undefined,
      };
    }
  );

  if (assets.length === 0) {
    return;
  }

  const octokit = github.getOctokit(core.getInput("token"));
  const { data: currentAssets } = await octokit.rest.repos.listReleaseAssets({
    ...github.context.repo,
    release_id: id,
  });

  for (const asset of assets) {
    core.startGroup(`📡 Downloading ${asset.label}...`);
    const matchedAsset = currentAssets.find(a => a.label === asset.label);

    if (matchedAsset === undefined) {
      throw new Error(`Asset ${asset.label} not found!`);
    }

    asset.output = asset.output ?? path.join(getAssetPath(matchedAsset.label ?? matchedAsset.name), matchedAsset.name);

    const { data: local } = await octokit.rest.repos.getReleaseAsset({
      ...github.context.repo,
      asset_id: matchedAsset.id,
      headers: { accept: "application/octet-stream" },
    });

    if (path.parse(asset.output).dir !== "") {
      fs.mkdirSync(path.parse(asset.output).dir, { recursive: true });
    }

    // Disabling `no-explicit-any` as the type definition for `octokit.rest.repos.getReleaseAsset`
    // is incorrect when requesting the binary data.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fs.writeFileSync(asset.output, Buffer.from(local as any));

    core.info(`✅ Downloaded ${asset.label} to ${asset.output}`);
    core.endGroup();
  }
}

/**
 * Downloads the assets of a GitHub Release whose name (or label) matches one of the provided patterns
 *
 * NOTE: every pattern must match at least one asset; assets are stored by their name in the
 *       destination directory, overwriting any existing file with the same name.
 *
 * @param releaseId The GitHub Release identifier
 * @param patterns List of asset names, labels or glob patterns to download
 * @param destination Directory to download the assets to
 * @param repository The repository the GitHub Release belongs to
 * @returns List of filepaths towards the downloaded assets
 */
export async function downloadReleaseAssets(
  releaseId: number,
  patterns: string[],
  destination: string,
  repository: IRepository
): Promise<string[]> {
  if (patterns.length === 0) {
    return [];
  }

  const octokit = github.getOctokit(core.getInput("token"));
  const currentAssets = await octokit.paginate(octokit.rest.repos.listReleaseAssets, {
    ...repository,
    release_id: releaseId,
    per_page: 100,
  });

  const matchedAssets: typeof currentAssets = [];
  for (const pattern of patterns) {
    const matches = currentAssets.filter(
      a => minimatch(a.name, pattern) || (a.label !== null && a.label !== "" && minimatch(a.label, pattern))
    );

    if (matches.length === 0) {
      throw new Error(`Asset ${pattern} not found!`);
    }

    matchedAssets.push(...matches.filter(m => !matchedAssets.some(a => a.id === m.id)));
  }

  fs.mkdirSync(destination, { recursive: true });

  const filepaths: string[] = [];
  for (const asset of matchedAssets) {
    core.startGroup(`📡 Downloading ${asset.name}...`);
    const output = path.join(destination, path.basename(asset.name));

    const { data: local } = await octokit.rest.repos.getReleaseAsset({
      ...repository,
      asset_id: asset.id,
      headers: { accept: "application/octet-stream" },
    });

    // Disabling `no-explicit-any` as the type definition for `octokit.rest.repos.getReleaseAsset`
    // is incorrect when requesting the binary data.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fs.writeFileSync(output, Buffer.from(local as any));
    filepaths.push(output);

    core.info(`✅ Downloaded ${asset.name} to ${output}`);
    core.endGroup();
  }

  return filepaths;
}
