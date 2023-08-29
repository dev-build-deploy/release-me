/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as github from "@actions/github";

export interface IBranch {
  type: "release" | "default";
  modifier?: string;
}

/**
 * Determines whether the current branch is the default branch.
 * @returns True if the current branch is the default branch, false otherwise
 */
export function getBranch(): IBranch {
  const currentBranch = github.context.ref.replace("refs/heads/", "");
  if (currentBranch === github.context.payload.repository?.default_branch) {
    return { type: "default" };
  }

  const branchElements = currentBranch.split("/");
  if (branchElements.length !== 2 || branchElements[0] !== "release") {
    throw new Error("Invalid branch name, expected either 'release/<modifier>' or '<default>'");
  }

  return {
    type: "release",
    modifier: branchElements[1],
  };
}
