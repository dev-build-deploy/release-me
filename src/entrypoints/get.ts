/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";

import * as assets from "../assets";
import * as branching from "../branching";
import * as releasing from "../releasing";
import * as versioning from "../versioning";

/**
 * GitHub Actions entrypoint for updating GitHub Release assets
 * @internal
 */
export async function run(): Promise<void> {
  try {
    core.info("📄 ReleaseMe - GitHub Release Asset Management");

    const repository = releasing.parseRepository(core.getInput("repository"));
    const versionScheme = versioning.getVersionScheme();

    const requestedVersion = core.getInput("name") ? core.getInput("name") : core.getInput("tag");
    const requestedType = core.getInput("name") ? "name" : "tag";

    // The current branch only relates to the releases of the current repository; for any other
    // repository the latest release is the one associated with its default branch.
    const branch: branching.IBranch = releasing.isCurrentRepository(repository)
      ? branching.getBranch()
      : { type: "default" };

    const release =
      requestedVersion === "latest"
        ? await releasing.getLatestRelease(branch, versionScheme, repository)
        : await releasing.getRelease(requestedVersion, requestedType, repository);

    if (release === undefined) return;

    core.setOutput("release", JSON.stringify(release));
    core.info(`✅ GitHub Release ${release.tag_name} is available as output variable!`);

    const patterns = core.getMultilineInput("download");
    if (patterns.length > 0) {
      const files = await assets.downloadReleaseAssets(
        release.id,
        patterns,
        core.getInput("path") || assets.DEFAULT_ASSET_DIR,
        repository
      );
      core.setOutput("files", JSON.stringify(files));
      core.info(`✅ Downloaded ${files.length} asset(s), available as output variable!`);
    }
  } catch (ex) {
    core.setFailed((ex as Error).message);
  }
}

run();
