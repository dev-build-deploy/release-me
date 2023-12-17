/* 
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
*/

import { ConventionalCommit } from "@dev-build-deploy/commit-it";

import * as branching from "../src/branching";
import * as changelog from "../src/changelog";
import { SemVerScheme } from "../src/versioning";

describe("Generate Changelog", () => {
  const commits = [
    ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "feat: add a new feature" }),
    ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "feat!: add new breaking feature" }),
    ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: address a bug" }),
    ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix(core): address failure in core logic" }),
    ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore!: break the api" }),
    ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "docs: improve documentation" }),
    ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "perf: improve performance" }),
  ];

  beforeEach(() => {
    jest.spyOn(branching, "getBranch").mockImplementation(() => {
      return { type: "default" } as branching.IBranch;
    });
  });

  test("Breaking changes only", async () => {
    jest.spyOn(changelog, "getConfigurationFromAPI").mockImplementation(async () => {
      return {
        changelog: {
          categories: [{ title: "💥 Breaking Changes", increment: ["MAJOR"] }],
        },
      };
    });

    const result = await changelog.generateChangelog(new SemVerScheme(), commits);

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
          categories: [{ title: "💥 Breaking Changes", increment: ["MAJOR"], types: ["feat"] }],
        },
      };
    });

    const result = await changelog.generateChangelog(new SemVerScheme(), commits);

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
          categories: [{ title: "🐛 Bug Fixes", increment: ["PATCH"], scopes: ["core"] }],
        },
      };
    });

    const result = await changelog.generateChangelog(new SemVerScheme(), commits);

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
          categories: [{ title: "🐛 Bug Fixes", increment: ["PATCH"], exclude: { scopes: ["core"] } }],
        },
      };
    });

    const result = await changelog.generateChangelog(new SemVerScheme(), commits);

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
            { title: "🐛 Bug Fixes", increment: ["PATCH"], exclude: { scopes: ["core"] } },
            { title: "📚 Documentation", types: ["docs"] },
          ],
        },
      };
    });

    const result = await changelog.generateChangelog(new SemVerScheme(), commits);

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
            { title: "🐛 Bug Fixes", increment: ["PATCH"], exclude: { scopes: ["core"] } },
            { title: "📚 Documentation", types: ["docs"] },
          ],
        },
      };
    });

    const result = await changelog.generateChangelog(new SemVerScheme(), commits);

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
              increment: ["MAJOR"],
            },
            {
              title: "✨ New Features",
              increment: ["MINOR"],
            },
            {
              title: "🐛 Bug Fixes",
              increment: ["PATCH"],
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

    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({
        hash: "0a0b0c0d",
        message: "feat!: removed `doIt(...)` as this is replaced by `doItBetter(...)`",
      }),
      ConventionalCommit.fromString({
        hash: "0a0b0c0d",
        message: "feat: add support for a Release Notes configuration file",
      }),
      ConventionalCommit.fromString({
        hash: "0a0b0c0d",
        message: "feat: allow users to specify the Release Notes configuration file location",
      }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: hide empty categories from the Release Notes" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix(internal): please do not notice me" }),
      ConventionalCommit.fromString({
        hash: "0a0b0c0d",
        message: "docs(api): add basic description on configuration usage",
      }),
      ConventionalCommit.fromString({
        hash: "0a0b0c0d",
        message: "docs: this should not show up in the Release Notes",
      }),
    ];

    const result = await changelog.generateChangelog(new SemVerScheme(), commits);
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
