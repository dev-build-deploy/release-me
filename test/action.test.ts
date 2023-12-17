/* 
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
*/

import { Commit, ConventionalCommit } from "@dev-build-deploy/commit-it";

import * as action from "../src/action";

describe("Filter Conventional Commits", () => {
  test("Filter out non-conventional commits", () => {
    const conventionals = action.filterConventionalCommits([
      Commit.fromString({ hash: "0a0b0c0d", message: "feat: add new feature" }),
      Commit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
      Commit.fromString({ hash: "0a0b0c0d", message: "Not a conventional commit" }),
    ]);
    expect(conventionals).toEqual([
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "feat: add new feature" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
    ]);
  });
});
