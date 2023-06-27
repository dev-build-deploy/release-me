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
