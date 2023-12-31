/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";

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

    const branch = branching.getBranch();
    const versionScheme = versioning.getVersionScheme();

    const requestedVersion = core.getInput("name") ? core.getInput("name") : core.getInput("tag");
    const requestedType = core.getInput("name") ? "name" : "tag";

    const release =
      requestedVersion === "latest"
        ? await releasing.getLatestRelease(branch, versionScheme)
        : await releasing.getRelease(requestedVersion, requestedType);

    if (release === undefined) return;

    core.setOutput("release", JSON.stringify(release));
    core.info(`✅ GitHub Release ${release.tag_name} is available as output variable!`);
  } catch (ex) {
    core.setFailed((ex as Error).message);
  }
}

run();
