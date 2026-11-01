/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import { Commit } from "@dev-build-deploy/commit-it";

import * as releasing from "../src/releasing";
import * as versioning from "../src/versioning";

const mockGetCommit = jest.fn();
const mockGetReleaseByTag = jest.fn();
const mockListReleases = jest.fn();

jest.mock("@actions/core", () => ({
  getInput: jest.fn((name: string) => (name === "prefix" ? "v" : "mock-token")),
  info: jest.fn(),
  warning: jest.fn(),
}));
jest.mock("@actions/github", () => ({
  context: { repo: { owner: "owner", repo: "repo" } },
  getOctokit: () => ({
    rest: {
      repos: {
        getCommit: (args: { ref: string }) => mockGetCommit(args),
        getReleaseByTag: (args: { owner: string; repo: string; tag: string }) => mockGetReleaseByTag(args),
        listReleases: (args: { owner: string; repo: string }) => mockListReleases(args),
      },
    },
    paginate: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iterator: async function* (method: (args: any) => any, args: any) {
        yield await method(args);
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

describe("parseRepository", () => {
  test("defaults to the current repository", () => {
    expect(releasing.parseRepository("")).toEqual({ owner: "owner", repo: "repo" });
    expect(releasing.parseRepository("  ")).toEqual({ owner: "owner", repo: "repo" });
  });

  test("parses owner/name", () => {
    expect(releasing.parseRepository("dev-build-deploy/engine")).toEqual({ owner: "dev-build-deploy", repo: "engine" });
    expect(releasing.parseRepository(" my_org/my.repo ")).toEqual({ owner: "my_org", repo: "my.repo" });
  });

  test("rejects invalid identifiers", () => {
    for (const value of ["engine", "a/b/c", "/engine", "owner/", "owner/en gine"]) {
      expect(() => releasing.parseRepository(value)).toThrow(`Invalid repository '${value}', expected 'owner/name'`);
    }
  });
});

describe("isCurrentRepository", () => {
  test("compares owner and name, ignoring case", () => {
    expect(releasing.isCurrentRepository({ owner: "owner", repo: "repo" })).toBe(true);
    expect(releasing.isCurrentRepository({ owner: "Owner", repo: "REPO" })).toBe(true);
    expect(releasing.isCurrentRepository({ owner: "owner", repo: "engine" })).toBe(false);
    expect(releasing.isCurrentRepository({ owner: "other", repo: "repo" })).toBe(false);
  });
});

describe("getRelease", () => {
  beforeEach(() => {
    mockGetReleaseByTag.mockReset();
    mockListReleases.mockReset();
  });

  test("retrieves a release by tag from the current repository by default", async () => {
    mockGetReleaseByTag.mockResolvedValue({ data: { id: 1, tag_name: "v1.0.0" } });

    const release = await releasing.getRelease("v1.0.0", "tag");

    expect(release?.id).toBe(1);
    expect(mockGetReleaseByTag).toHaveBeenCalledWith({ owner: "owner", repo: "repo", tag: "v1.0.0" });
  });

  test("retrieves a release by tag from another repository", async () => {
    mockGetReleaseByTag.mockResolvedValue({ data: { id: 2, tag_name: "v0.1.0" } });

    const release = await releasing.getRelease("v0.1.0", "tag", { owner: "dev-build-deploy", repo: "engine" });

    expect(release?.id).toBe(2);
    expect(mockGetReleaseByTag).toHaveBeenCalledWith({ owner: "dev-build-deploy", repo: "engine", tag: "v0.1.0" });
  });

  test("retrieves a release by name from another repository", async () => {
    mockListReleases.mockResolvedValue({
      data: [
        { id: 3, name: "v0.1.0" },
        { id: 4, name: "v0.2.0" },
      ],
    });

    const release = await releasing.getRelease("v0.2.0", "name", { owner: "dev-build-deploy", repo: "engine" });

    expect(release?.id).toBe(4);
    expect(mockListReleases).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "dev-build-deploy", repo: "engine" })
    );
  });
});

describe("getLatestRelease", () => {
  beforeEach(() => {
    mockListReleases.mockReset();
  });

  test("retrieves the latest release from another repository", async () => {
    mockListReleases.mockResolvedValue({
      data: [
        { id: 5, tag_name: "v0.2.0" },
        { id: 6, tag_name: "v0.10.0" },
        { id: 7, tag_name: "v0.9.1" },
      ],
    });

    const release = await releasing.getLatestRelease({ type: "default" }, new versioning.SemVerScheme(), {
      owner: "dev-build-deploy",
      repo: "engine",
    });

    expect(release?.id).toBe(6);
    expect(mockListReleases).toHaveBeenCalledWith({ owner: "dev-build-deploy", repo: "engine" });
  });
});
