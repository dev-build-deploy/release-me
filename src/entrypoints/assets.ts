/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import * as assets from "../assets";

/**
 * GitHub Actions entrypoint for updating GitHub Release assets
 * @internal
 */
export async function run(): Promise<void> {
  try {
    core.info("📄 ReleaseMe - GitHub Release Asset Management");
    const releaseId = parseInt(core.getInput("release-id", { required: true }));
    await assets.updateAssets(releaseId);
    await assets.removeAssets(releaseId);
    await assets.downloadAssets(releaseId);
    core.info(`✅ Updated all assets!`);
  } catch (ex) {
    core.setFailed((ex as Error).message);
  }
}

run();
