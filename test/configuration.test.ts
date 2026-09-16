/*
SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
*/

import * as core from "@actions/core";

import * as configuration from "../src/configuration";

describe("Parse increment mapping", () => {
  test("YAML formatted mapping", () => {
    expect(configuration.parseIncrementMapping("chore: PATCH\nperf: MINOR", "increment-mapping")).toEqual({
      chore: "PATCH",
      perf: "MINOR",
    });
  });

  test("JSON formatted mapping", () => {
    expect(configuration.parseIncrementMapping('{"chore": "PATCH", "perf": "MINOR"}', "increment-mapping")).toEqual({
      chore: "PATCH",
      perf: "MINOR",
    });
  });

  test("Already parsed mapping", () => {
    expect(configuration.parseIncrementMapping({ chore: "PATCH" }, "release configuration")).toEqual({
      chore: "PATCH",
    });
  });

  test("Conventional Commit types are case insensitive, increment types are not", () => {
    expect(configuration.parseIncrementMapping("FIX: major", "increment-mapping")).toEqual({ fix: "MAJOR" });
  });

  test("No mapping provided", () => {
    expect(configuration.parseIncrementMapping("", "increment-mapping")).toEqual({});
    expect(configuration.parseIncrementMapping(undefined, "increment-mapping")).toEqual({});
  });

  test("Rejects an unsupported increment type", () => {
    expect(() => configuration.parseIncrementMapping("chore: PRERELEASE", "increment-mapping")).toThrow(
      /Invalid increment type \('PRERELEASE'\)/
    );
  });

  test("Rejects a Conventional Commit type containing a scope", () => {
    expect(() => configuration.parseIncrementMapping("chore(deps): PATCH", "increment-mapping")).toThrow(
      /scopes are not supported/
    );
  });

  test("Rejects a mapping without an increment type", () => {
    expect(() => configuration.parseIncrementMapping("chore:", "increment-mapping")).toThrow(/Invalid increment type/);
  });

  test("Rejects a value which is not a mapping", () => {
    expect(() => configuration.parseIncrementMapping("not-a-mapping", "increment-mapping")).toThrow(
      /expected a mapping of Conventional Commit types/
    );
    expect(() => configuration.parseIncrementMapping("- chore", "increment-mapping")).toThrow(
      /expected a mapping of Conventional Commit types/
    );
  });
});

describe("Determine increment mapping", () => {
  const mockInputs = (inputs: { [name: string]: string }): void => {
    jest.spyOn(core, "getInput").mockImplementation((name: string) => inputs[name] ?? "");
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Input parameter takes precedence per Conventional Commit type", () => {
    mockInputs({ "increment-mapping": "chore: NONE" });

    expect(configuration.getIncrementMapping({ chore: "PATCH", docs: "PATCH" })).toEqual({
      chore: "NONE",
      docs: "PATCH",
    });
  });

  test("No mapping provided", () => {
    mockInputs({});

    expect(configuration.getIncrementMapping()).toBeUndefined();
    expect(configuration.getIncrementMapping({})).toBeUndefined();
  });
});
