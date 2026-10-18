/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as assets from "../src/assets";

const mockListReleaseAssets = jest.fn();
const mockGetReleaseAsset = jest.fn();

jest.mock("@actions/core", () => ({
  getInput: jest.fn().mockReturnValue("mock-token"),
  info: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
}));
jest.mock("@actions/artifact", () => ({}));
jest.mock("@actions/github", () => ({
  context: { repo: { owner: "owner", repo: "repo" } },
  getOctokit: () => ({
    rest: {
      repos: {
        listReleaseAssets: (args: object) => mockListReleaseAssets(args),
        getReleaseAsset: (args: { asset_id: number }) => mockGetReleaseAsset(args),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paginate: async (method: (args: any) => any, args: any) => (await method(args)).data,
  }),
}));

const engine = { owner: "dev-build-deploy", repo: "engine" };
const releaseAssets = [
  { id: 1, name: "engine-web.zip", label: "dist/engine-web.zip" },
  { id: 2, name: "engine-native-macos.tar.gz", label: "" },
  { id: 3, name: "engine-native-linux.tar.gz", label: null },
  { id: 4, name: "sbom.spdx.json", label: "sbom.spdx.json" },
];

describe("downloadReleaseAssets", () => {
  let destination: string;

  beforeEach(() => {
    destination = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "release-me-")), "engine");
    mockListReleaseAssets.mockReset().mockResolvedValue({ data: releaseAssets });
    mockGetReleaseAsset.mockReset().mockImplementation(async (args: { asset_id: number }) => ({
      data: new TextEncoder().encode(`asset ${args.asset_id}`).buffer,
    }));
  });

  test("downloads nothing without patterns", async () => {
    expect(await assets.downloadReleaseAssets(42, [], destination, engine)).toEqual([]);
    expect(mockListReleaseAssets).not.toHaveBeenCalled();
    expect(fs.existsSync(destination)).toBe(false);
  });

  test("downloads assets by name into the destination directory", async () => {
    const files = await assets.downloadReleaseAssets(42, ["sbom.spdx.json"], destination, engine);

    expect(files).toEqual([path.join(destination, "sbom.spdx.json")]);
    expect(fs.readFileSync(files[0], "utf8")).toBe("asset 4");
    expect(mockListReleaseAssets).toHaveBeenCalledWith({ ...engine, release_id: 42, per_page: 100 });
    expect(mockGetReleaseAsset).toHaveBeenCalledWith({
      ...engine,
      asset_id: 4,
      headers: { accept: "application/octet-stream" },
    });
  });

  test("downloads assets by label", async () => {
    const files = await assets.downloadReleaseAssets(42, ["dist/engine-web.zip"], destination, engine);

    expect(files).toEqual([path.join(destination, "engine-web.zip")]);
  });

  test("downloads assets matching a glob pattern, each only once", async () => {
    const files = await assets.downloadReleaseAssets(
      42,
      ["engine-native-*.tar.gz", "*-macos.tar.gz"],
      destination,
      engine
    );

    expect(files).toEqual([
      path.join(destination, "engine-native-macos.tar.gz"),
      path.join(destination, "engine-native-linux.tar.gz"),
    ]);
    expect(mockGetReleaseAsset).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(files[1], "utf8")).toBe("asset 3");
  });

  test("fails when a pattern does not match any asset", async () => {
    await expect(
      assets.downloadReleaseAssets(42, ["sbom.spdx.json", "engine-windows.zip"], destination, engine)
    ).rejects.toThrow("Asset engine-windows.zip not found!");
    expect(mockGetReleaseAsset).not.toHaveBeenCalled();
  });
});
