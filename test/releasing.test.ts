/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import { Commit } from "@dev-build-deploy/commit-it";

import * as releasing from "../src/releasing";

const mockGetCommit = jest.fn();

jest.mock("@actions/core", () => ({ getInput: jest.fn().mockReturnValue("mock-token") }));
jest.mock("@actions/github", () => ({
  context: { repo: { owner: "owner", repo: "repo" } },
  getOctokit: () => ({
    rest: {
      repos: {
        getCommit: (args: { ref: string }) => mockGetCommit(args),
      },
    },
  }),
}));

function makeCommit(hash: string): Commit {
  return Commit.fromString({ hash, message: "feat: add feature" });
}

describe("filterCommitsByPaths", () => {
  beforeEach(() => {
    mockGetCommit.mockReset();
  });

  test("returns empty array when no comparison files match — no per-commit calls made", async () => {
    const commits = [makeCommit("aaa"), makeCommit("bbb")];
    const comparisonFiles = ["packages/ui/index.ts", "packages/ui/styles.css"];
    const paths = ["packages/api/**"];

    const result = await releasing.filterCommitsByPaths(commits, comparisonFiles, paths);

    expect(result).toEqual([]);
    expect(mockGetCommit).not.toHaveBeenCalled();
  });

  test("returns all commits when all touch a matching path", async () => {
    const commits = [makeCommit("aaa"), makeCommit("bbb")];
    const comparisonFiles = ["packages/api/index.ts"];
    const paths = ["packages/api/**"];

    mockGetCommit.mockResolvedValue({ data: { files: [{ filename: "packages/api/index.ts" }] } });

    const result = await releasing.filterCommitsByPaths(commits, comparisonFiles, paths);

    expect(result).toHaveLength(2);
    expect(mockGetCommit).toHaveBeenCalledTimes(2);
  });

  test("returns only the commits that touch a matching path", async () => {
    const commits = [makeCommit("aaa"), makeCommit("bbb"), makeCommit("ccc")];
    const comparisonFiles = ["packages/api/index.ts", "packages/ui/page.tsx"];
    const paths = ["packages/api/**"];

    mockGetCommit
      .mockResolvedValueOnce({ data: { files: [{ filename: "packages/api/index.ts" }] } })
      .mockResolvedValueOnce({ data: { files: [{ filename: "packages/ui/page.tsx" }] } })
      .mockResolvedValueOnce({ data: { files: [{ filename: "packages/api/util.ts" }] } });

    const result = await releasing.filterCommitsByPaths(commits, comparisonFiles, paths);

    expect(result).toHaveLength(2);
    expect(result[0].hash).toBe("aaa");
    expect(result[1].hash).toBe("ccc");
  });

  test("matches exact file paths", async () => {
    const commits = [makeCommit("aaa")];
    const comparisonFiles = ["src/action.ts"];
    const paths = ["src/action.ts"];

    mockGetCommit.mockResolvedValue({ data: { files: [{ filename: "src/action.ts" }] } });

    const result = await releasing.filterCommitsByPaths(commits, comparisonFiles, paths);

    expect(result).toHaveLength(1);
  });

  test("matches single-segment wildcard", async () => {
    const commits = [makeCommit("aaa")];
    const comparisonFiles = ["src/action.ts"];
    const paths = ["src/*.ts"];

    mockGetCommit.mockResolvedValue({ data: { files: [{ filename: "src/action.ts" }] } });

    const result = await releasing.filterCommitsByPaths(commits, comparisonFiles, paths);

    expect(result).toHaveLength(1);
  });

  test("single-segment wildcard does not cross directory boundaries", async () => {
    const commits = [makeCommit("aaa")];
    const comparisonFiles = ["src/nested/action.ts"];
    const paths = ["src/*.ts"];

    mockGetCommit.mockResolvedValue({ data: { files: [{ filename: "src/nested/action.ts" }] } });

    const result = await releasing.filterCommitsByPaths(commits, comparisonFiles, paths);

    expect(result).toHaveLength(0);
  });

  test("returns empty array when commits list is empty", async () => {
    const result = await releasing.filterCommitsByPaths([], ["packages/api/index.ts"], ["packages/api/**"]);
    expect(result).toEqual([]);
    expect(mockGetCommit).not.toHaveBeenCalled();
  });

  test("handles commits with no changed files", async () => {
    const commits = [makeCommit("aaa")];
    const comparisonFiles = ["packages/api/index.ts"];
    const paths = ["packages/api/**"];

    mockGetCommit.mockResolvedValue({ data: { files: undefined } });

    const result = await releasing.filterCommitsByPaths(commits, comparisonFiles, paths);

    expect(result).toHaveLength(0);
  });
});
