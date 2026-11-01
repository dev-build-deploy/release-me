/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";
import * as github from "@actions/github";
import { minimatch } from "minimatch";

import type { IRepository } from "./releasing";

export const DEFAULT_ASSET_DIR = "_assets";

/**
 * Downloads a single GitHub Release asset to the provided file path
 * @param repository The repository the GitHub Release belongs to
 * @param assetId The GitHub Release asset identifier
 * @param output The file path to store the asset at; missing directories are created
 */
export async function downloadAsset(repository: IRepository, assetId: number, output: string): Promise<void> {
  const octokit = github.getOctokit(core.getInput("token"));
  const { data: local } = await octokit.rest.repos.getReleaseAsset({
    ...repository,
    asset_id: assetId,
    headers: { accept: "application/octet-stream" },
  });

  if (path.parse(output).dir !== "") {
    fs.mkdirSync(path.parse(output).dir, { recursive: true });
  }

  // Disabling `no-explicit-any` as the type definition for `octokit.rest.repos.getReleaseAsset`
  // is incorrect when requesting the binary data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fs.writeFileSync(output, Buffer.from(local as any));
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
    await downloadAsset(repository, asset.id, output);
    filepaths.push(output);

    core.info(`✅ Downloaded ${asset.name} to ${output}`);
    core.endGroup();
  }

  return filepaths;
}
