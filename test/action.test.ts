/* 
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import * as action from "../src/action";

describe("Filter Conventional Commits", () => {
  test("Filter out non-conventional commits", () => {
    const conventionals = action.filterConventionalCommits([
      {
        hash: "0a0b0c0d",
        subject: "feat: add new feature",
      },
      {
        hash: "0a0b0c0d",
        subject: "fix: prevent bug",
      },
      {
        hash: "0a0b0c0d",
        subject: "Not a conventional commit",
      },
    ]);
    expect(conventionals).toStrictEqual([
      {
        hash: "0a0b0c0d",
        subject: "feat: add new feature",
        breaking: false,
        description: "add new feature",
        scope: undefined,
        type: "feat",
      },
      {
        hash: "0a0b0c0d",
        subject: "fix: prevent bug",
        breaking: false,
        description: "prevent bug",
        scope: undefined,
        type: "fix",
      },
    ]);
  });
});

describe("Determine bump type", () => {
  test("Breaking Change (subject)", () => {
    const commits = [
      { hash: "0a0b0c0d", subject: "feat: add new feature" },
      { hash: "0a0b0c0d", subject: "fix: prevent bug" },
      { hash: "0a0b0c0d", subject: "chore!: breaking change" },
    ];
    expect(action.determineIncrementType(action.filterConventionalCommits(commits))).toBe("major");
  });

  test("Breaking Change (footer)", () => {
    const commits = [
      { hash: "0a0b0c0d", subject: "feat: add new feature" },
      { hash: "0a0b0c0d", subject: "fix: prevent bug", footer: { "BREAKING CHANGE": "This is a breaking change" } },
      { hash: "0a0b0c0d", subject: "chore: breaking change" },
    ];
    expect(action.determineIncrementType(action.filterConventionalCommits(commits))).toBe("major");
  });

  test("Minor change", () => {
    const commits = [
      { hash: "0a0b0c0d", subject: "feat: add new feature" },
      { hash: "0a0b0c0d", subject: "fix: prevent bug" },
      { hash: "0a0b0c0d", subject: "chore: breaking change" },
    ];
    expect(action.determineIncrementType(action.filterConventionalCommits(commits))).toBe("minor");
  });

  test("Patch change", () => {
    const commits = [
      { hash: "0a0b0c0d", subject: "docs: update documentation" },
      { hash: "0a0b0c0d", subject: "fix: prevent bug" },
      { hash: "0a0b0c0d", subject: "chore: breaking change" },
    ];
    expect(action.determineIncrementType(action.filterConventionalCommits(commits))).toBe("patch");
  });

  test("No change", () => {
    const commits = [
      { hash: "0a0b0c0d", subject: "docs: update documentation" },
      { hash: "0a0b0c0d", subject: "perf: introduce async handling of events" },
      { hash: "0a0b0c0d", subject: "chore: breaking change" },
    ];
    expect(action.determineIncrementType(action.filterConventionalCommits(commits))).toBe(undefined);
  });
});
