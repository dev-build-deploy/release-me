/* 
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

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

  test("Breaking changes only", () => {
    jest.spyOn(changelog, "getConfiguration").mockImplementation(() => {
      return {
        changelog: {
          categories: [{ title: "💥 Breaking Changes", increment: ["major"] }],
        },
      };
    });
    const result = changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(true);
    expect(result.includes("Address a bug")).toBe(false);
    expect(result.includes("Address failure in core logic")).toBe(false);
    expect(result.includes("Break the api")).toBe(true);
    expect(result.includes("Improve documentation")).toBe(false);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Breaking changes of type feat only", () => {
    jest.spyOn(changelog, "getConfiguration").mockImplementation(() => {
      return {
        changelog: {
          categories: [{ title: "💥 Breaking Changes", increment: ["major"], types: ["feat"] }],
        },
      };
    });

    const result = changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(true);
    expect(result.includes("Address a bug")).toBe(false);
    expect(result.includes("Address failure in core logic")).toBe(false);
    expect(result.includes("Break the api")).toBe(false);
    expect(result.includes("Improve documentation")).toBe(false);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Bug fix with scope", () => {
    jest.spyOn(changelog, "getConfiguration").mockImplementation(() => {
      return {
        changelog: {
          categories: [{ title: "🐛 Bug Fixes", increment: ["patch"], scopes: ["core"] }],
        },
      };
    });

    const result = changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(false);
    expect(result.includes("Address a bug")).toBe(false);
    expect(result.includes("Address failure in core logic")).toBe(true);
    expect(result.includes("Break the api")).toBe(false);
    expect(result.includes("Improve documentation")).toBe(false);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Bug fix without scope", () => {
    jest.spyOn(changelog, "getConfiguration").mockImplementation(() => {
      return {
        changelog: {
          categories: [{ title: "🐛 Bug Fixes", increment: ["patch"], exclude: { scopes: ["core"] } }],
        },
      };
    });

    const result = changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(false);
    expect(result.includes("Address a bug")).toBe(true);
    expect(result.includes("Address failure in core logic")).toBe(false);
    expect(result.includes("Break the api")).toBe(false);
    expect(result.includes("Improve documentation")).toBe(false);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Documentation and bug fixes", () => {
    jest.spyOn(changelog, "getConfiguration").mockImplementation(() => {
      return {
        changelog: {
          categories: [
            { title: "🐛 Bug Fixes", increment: ["patch"], exclude: { scopes: ["core"] } },
            { title: "📚 Documentation", types: ["docs"] },
          ],
        },
      };
    });

    const result = changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(false);
    expect(result.includes("Address a bug")).toBe(true);
    expect(result.includes("Address failure in core logic")).toBe(false);
    expect(result.includes("Break the api")).toBe(false);
    expect(result.includes("Improve documentation")).toBe(true);
    expect(result.includes("Improve performance")).toBe(false);
  });

  test("Exclude all bug fixes", () => {
    jest.spyOn(changelog, "getConfiguration").mockImplementation(() => {
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

    const result = changelog.generateChangelog(commits);

    expect(result.includes("Add new feature")).toBe(false);
    expect(result.includes("Add new breaking feature")).toBe(false);
    expect(result.includes("Address a bug")).toBe(false);
    expect(result.includes("Address failure in core logic")).toBe(false);
    expect(result.includes("Break the api")).toBe(false);
    expect(result.includes("Improve documentation")).toBe(true);
    expect(result.includes("Improve performance")).toBe(false);
  });
});
