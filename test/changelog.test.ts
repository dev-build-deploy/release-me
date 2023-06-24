/* 
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IConventionalCommit } from "@dev-build-deploy/commit-it";
import * as changelog from "../src/changelog";

describe("Generate Changelog", () => {
  const commits = [
    { hash: "0a0b0c0d", subject: "feat: add new feature", type: "feat", description: "add new feature" },
    {
      hash: "0a0b0c0d",
      subject: "feat!: add new breaking feature",
      type: "feat",
      description: "add new breaking feature",
      breaking: true,
    },
    { hash: "0a0b0c0d", subject: "fix: address a bug", type: "fix", description: "address a bug" },
    {
      hash: "0a0b0c0d",
      subject: "fix(core): address failure in core logic",
      type: "fix",
      description: "address failure in core logic",
      scope: "core",
    },
    {
      hash: "0a0b0c0d",
      subject: "chore!: break the api",
      type: "chore",
      description: "break the api",
      breaking: true,
    },
    { hash: "0a0b0c0d", subject: "docs: improve documentation", type: "docs", description: "improve documentation" },
    { hash: "0a0b0c0d", subject: "perf: improve performance", type: "perf", description: "improve performance" },
  ];

  test("Breaking changes only", async () => {
    jest.spyOn(changelog, "getConfigurationFromAPI").mockImplementation(async () => {
      return {
        changelog: {
          categories: [{ title: "💥 Breaking Changes", increment: ["major"] }],
        },
      };
    });

    const result = await changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(true);
    expect(result.includes("Address a bug")).toBe(false);
    expect(result.includes("Address failure in core logic")).toBe(false);
    expect(result.includes("Break the api")).toBe(true);
    expect(result.includes("Improve documentation")).toBe(false);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Breaking changes of type feat only", async () => {
    jest.spyOn(changelog, "getConfigurationFromAPI").mockImplementation(async () => {
      return {
        changelog: {
          categories: [{ title: "💥 Breaking Changes", increment: ["major"], types: ["feat"] }],
        },
      };
    });

    const result = await changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(true);
    expect(result.includes("Address a bug")).toBe(false);
    expect(result.includes("Address failure in core logic")).toBe(false);
    expect(result.includes("Break the api")).toBe(false);
    expect(result.includes("Improve documentation")).toBe(false);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Bug fix with scope", async () => {
    jest.spyOn(changelog, "getConfigurationFromAPI").mockImplementation(async () => {
      return {
        changelog: {
          categories: [{ title: "🐛 Bug Fixes", increment: ["patch"], scopes: ["core"] }],
        },
      };
    });

    const result = await changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(false);
    expect(result.includes("Address a bug")).toBe(false);
    expect(result.includes("Address failure in core logic")).toBe(true);
    expect(result.includes("Break the api")).toBe(false);
    expect(result.includes("Improve documentation")).toBe(false);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Bug fix without scope", async () => {
    jest.spyOn(changelog, "getConfigurationFromAPI").mockImplementation(async () => {
      return {
        changelog: {
          categories: [{ title: "🐛 Bug Fixes", increment: ["patch"], exclude: { scopes: ["core"] } }],
        },
      };
    });

    const result = await changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(false);
    expect(result.includes("Address a bug")).toBe(true);
    expect(result.includes("Address failure in core logic")).toBe(false);
    expect(result.includes("Break the api")).toBe(false);
    expect(result.includes("Improve documentation")).toBe(false);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Documentation and bug fixes", async () => {
    jest.spyOn(changelog, "getConfigurationFromAPI").mockImplementation(async () => {
      return {
        changelog: {
          categories: [
            { title: "🐛 Bug Fixes", increment: ["patch"], exclude: { scopes: ["core"] } },
            { title: "📚 Documentation", types: ["docs"] },
          ],
        },
      };
    });

    const result = await changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(false);
    expect(result.includes("Address a bug")).toBe(true);
    expect(result.includes("Address failure in core logic")).toBe(false);
    expect(result.includes("Break the api")).toBe(false);
    expect(result.includes("Improve documentation")).toBe(true);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Exclude all bug fixes", async () => {
    jest.spyOn(changelog, "getConfigurationFromAPI").mockImplementation(async () => {
      return {
        changelog: {
          exclude: { types: ["fix"] },
          categories: [
            { title: "🐛 Bug Fixes", increment: ["patch"], exclude: { scopes: ["core"] } },
            { title: "📚 Documentation", types: ["docs"] },
          ],
        },
      };
    });

    const result = await changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(false);
    expect(result.includes("Address a bug")).toBe(false);
    expect(result.includes("Address failure in core logic")).toBe(false);
    expect(result.includes("Break the api")).toBe(false);
    expect(result.includes("Improve documentation")).toBe(true);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Example usecase", async () => {
    jest.spyOn(changelog, "getConfigurationFromAPI").mockImplementation(async () => {
      return {
        changelog: {
          exclude: {
            scopes: ["deps"],
          },
          categories: [
            {
              title: "💥 Breaking Changes",
              increment: ["major"],
            },
            {
              title: "✨ New Features",
              increment: ["minor"],
            },
            {
              title: "🐛 Bug Fixes",
              increment: ["patch"],
              exclude: {
                scopes: ["internal"],
              },
            },
            {
              title: "📚 Documentation",
              types: ["docs"],
              scopes: ["api"],
            },
          ],
        },
      };
    });

    const commits: IConventionalCommit[] = [
      {
        hash: "0a0b0c0d",
        subject: "feat!: removed `doIt(...)` as this is replaced by `doItBetter(...)`",
        type: "feat",
        description: "removed `doIt(...)` as this is replaced by `doItBetter(...)`",
        breaking: true,
      },
      {
        hash: "0a0b0c0d",
        subject: "feat: add support for a Release Notes configuration file",
        type: "feat",
        description: "add support for a Release Notes configuration file",
      },
      {
        hash: "0a0b0c0d",
        subject: "feat: allow users to specify the Release Notes configuration file location",
        type: "feat",
        description: "allow users to specify the Release Notes configuration file location",
      },
      {
        hash: "0a0b0c0d",
        subject: "fix: hide empty categories from the Release Notes",
        type: "fix",
        description: "hide empty categories from the Release Notes",
      },
      {
        hash: "0a0b0c0d",
        subject: "fix(internal): please do not notice me",
        type: "fix",
        scope: "internal",
        description: "please do not notice me",
      },
      {
        hash: "0a0b0c0d",
        subject: "docs(api): add basic description on configuration usage",
        type: "docs",
        description: "add basic description on configuration usage",
        scope: "api",
      },
      {
        hash: "0a0b0c0d",
        subject: "docs: this should not show up in the Release Notes",
        type: "docs",
        description: "this should not show up in the Release Notes",
      },
    ];

    const result = await changelog.generateChangelog(commits);
    const expectation = `## What's Changed

### 💥 Breaking Changes

- Removed \`doIt(...)\` as this is replaced by \`doItBetter(...)\`


### ✨ New Features

- Add support for a Release Notes configuration file
- Allow users to specify the Release Notes configuration file location


### 🐛 Bug Fixes

- Hide empty categories from the Release Notes


### 📚 Documentation

- Add basic description on configuration usage

`;
    expect(result).toBe(expectation);
  });
});
