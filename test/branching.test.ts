/* 
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
*/

import * as github from "@actions/github";

import * as branching from "../src/branching";

jest.mock("@actions/github");

describe("Determine branching", () => {
  test("Default Branch", () => {
    github.context.ref = "refs/heads/main";
    github.context.payload = {
      repository: {
        name: "",
        owner: {
          login: "",
        },
        default_branch: "main",
      },
    };

    expect(branching.getBranch()).toStrictEqual({ type: "default" });
  });

  test("Release Branch", () => {
    github.context.ref = "refs/heads/release/1.0";
    github.context.payload = {
      repository: {
        name: "",
        owner: {
          login: "",
        },
        default_branch: "main",
      },
    };

    expect(branching.getBranch()).toStrictEqual({ type: "release", modifier: "1.0" });
  });

  test("Feature Branch", () => {
    github.context.ref = "refs/heads/feat/not-a-release";
    github.context.payload = {
      repository: {
        name: "",
        owner: {
          login: "",
        },
        default_branch: "main",
      },
    };

    expect(() => {
      branching.getBranch();
    }).toThrow();
  });

  test("Depth too far", () => {
    github.context.ref = "refs/heads/release/1/0";
    github.context.payload = {
      repository: {
        name: "",
        owner: {
          login: "",
        },
        default_branch: "main",
      },
    };

    expect(() => {
      branching.getBranch();
    }).toThrow();
  });
});
