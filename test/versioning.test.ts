/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
*/

import * as core from "@actions/core";
import { ConventionalCommit } from "@dev-build-deploy/commit-it";
import { SemVer, CalVer, SemVerIncrement } from "@dev-build-deploy/version-it";

import * as branching from "../src/branching";
import * as versioning from "../src/versioning";

describe("getVersionScheme", () => {
  test("SemVer", () => {
    const spy = jest.spyOn(core, "getInput").mockImplementation(() => {
      return "semver";
    });
    expect(versioning.getVersionScheme()).toBeInstanceOf(versioning.SemVerScheme);

    spy.mockRestore();
  });

  test("CalVer", () => {
    const spy = jest.spyOn(core, "getInput").mockImplementation(() => {
      return "calver";
    });
    expect(versioning.getVersionScheme()).toBeInstanceOf(versioning.CalVerScheme);

    spy.mockRestore();
  });

  test("Incorrect Versioning", () => {
    const spy = jest.spyOn(core, "getInput").mockImplementation(() => {
      return "does-not-exist";
    });
    expect(() => {
      versioning.getVersionScheme();
    }).toThrow();

    spy.mockRestore();
  });
});

describe("Compare versions", () => {
  test("SemVer", () => {
    const semver = new versioning.SemVerScheme();
    expect(versioning.compareVersions(semver.createVersion("1.2.3"), semver.createVersion("0.1.2"))).toBe(1);
    expect(versioning.compareVersions(semver.createVersion("1.2.3"), semver.createVersion("1.2.3"))).toBe(0);
    expect(versioning.compareVersions(semver.createVersion("1.2.3"), semver.createVersion("2.3.4"))).toBe(-1);
  });

  test("CalVer", () => {
    const calver = new versioning.CalVerScheme();
    expect(versioning.compareVersions(calver.createVersion("2023.02.3"), calver.createVersion("2023.02.2"))).toBe(1);
    expect(versioning.compareVersions(calver.createVersion("2023.02.3"), calver.createVersion("2023.02.3"))).toBe(0);
    expect(versioning.compareVersions(calver.createVersion("2023.02.3"), calver.createVersion("2023.03.0"))).toBe(-1);
  });

  test("Incompatible", () => {
    const calver = new versioning.CalVerScheme();
    const semver = new versioning.SemVerScheme();
    expect(() => {
      versioning.compareVersions(semver.createVersion("1.2.3"), calver.createVersion("2023.02.2"));
    }).toThrow();
    expect(() => {
      versioning.compareVersions(calver.createVersion("2023.02.3"), semver.createVersion("1.2.3"));
    }).toThrow();
  });
});

describe("Initial version", () => {
  test("SemVer", () => {
    const version = new versioning.SemVerScheme().initialVersion();
    expect(version).toBeInstanceOf(SemVer);
  });

  test("CalVer", () => {
    const version = new versioning.CalVerScheme().initialVersion();
    expect(version).toBeInstanceOf(CalVer);
  });
});

describe("Create version", () => {
  test("SemVer", () => {
    const version = new versioning.SemVerScheme().createVersion("9.1.0");
    expect(version).toBeInstanceOf(SemVer);
  });

  test("CalVer", () => {
    const version = new versioning.CalVerScheme().createVersion("2023.01.0");
    expect(version).toBeInstanceOf(CalVer);
  });
});

describe("Determine bump type (default branch)", () => {
  beforeEach(() => {
    jest.spyOn(branching, "getBranch").mockImplementation(() => {
      return { type: "default" };
    });
  });

  test("Breaking Change (subject)", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "feat: add new feature" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore!: breaking change" }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBe("MAJOR");
    expect(calver.determineIncrementType(commits)).toBe("CALENDAR");
  });

  test("Breaking Change (footer)", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "feat: add new feature" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
      ConventionalCommit.fromString({
        hash: "0a0b0c0d",
        message: "chore: breaking change\n\nBREAKING-CHANGE: this is a breaking change",
      }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBe("MAJOR");
    expect(calver.determineIncrementType(commits)).toBe("CALENDAR");
  });

  test("Added Feature", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "feat(login): add support google oauth (#12)" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore: non breaking change" }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBe("MINOR");
    expect(calver.determineIncrementType(commits)).toBe("CALENDAR");
  });

  test("Added bug fix", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore: non breaking change" }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBe("PATCH");
    expect(calver.determineIncrementType(commits)).toBe("CALENDAR");
  });

  test("No change", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore: non breaking change" }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBeUndefined();
    expect(calver.determineIncrementType(commits)).toBe("CALENDAR");
  });
});

describe("Determine bump type (release branch)", () => {
  beforeEach(() => {
    jest.spyOn(branching, "getBranch").mockImplementation(() => {
      return { type: "release" };
    });

    jest.spyOn(core, "getBooleanInput").mockImplementation((_name: string, _options): boolean => {
      return false;
    });
  });

  test("Breaking Change (subject)", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "feat: add new feature" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore!: breaking change" }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBe("PATCH");
    expect(calver.determineIncrementType(commits)).toBe("CALENDAR");
  });

  test("Breaking Change (footer)", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "feat: add new feature" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
      ConventionalCommit.fromString({
        hash: "0a0b0c0d",
        message: "chore: breaking change\n\nBREAKING-CHANGE: this is a breaking change",
      }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBe("PATCH");
    expect(calver.determineIncrementType(commits)).toBe("CALENDAR");
  });

  test("Added Feature", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "feat(login): add support google oauth (#12)" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore: non breaking change" }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBe("PATCH");
    expect(calver.determineIncrementType(commits)).toBe("CALENDAR");
  });

  test("Added bug fix", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore: non breaking change" }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBe("PATCH");
    expect(calver.determineIncrementType(commits)).toBe("CALENDAR");
  });

  test("No change", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore: non breaking change" }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBeUndefined();
    expect(calver.determineIncrementType(commits)).toBe("CALENDAR");
  });
});

describe("Increment version", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2023, 5, 12));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("Semantic Versioning", () => {
    const data = [
      // No prerelease
      { branch: "default", prerelease: false, version: "0.1.0", increment: "MINOR", expected: "0.2.0" },
      { branch: "default", prerelease: false, version: "0.2.0-dev.1", increment: "MINOR", expected: "0.3.0" },
      { branch: "default", prerelease: false, version: "0.1.0-dev.1", increment: "MAJOR", expected: "1.0.0" },
      { branch: "release", prerelease: false, version: "0.1.0", increment: "MINOR", expected: "0.2.0" },
      { branch: "release", prerelease: false, version: "0.2.0-rc.1", increment: "MINOR", expected: "0.3.0" },
      { branch: "release", prerelease: false, version: "0.1.0-rc.1", increment: "MAJOR", expected: "1.0.0" },
      // Prerelease
      { branch: "default", prerelease: true, version: "0.1.0", increment: "MINOR", expected: "0.2.0-dev.1" },
      { branch: "default", prerelease: true, version: "0.2.0-dev.1", increment: "MINOR", expected: "0.3.0-dev.1" },
      { branch: "default", prerelease: true, version: "0.1.0-dev.1", increment: "MAJOR", expected: "1.0.0-dev.1" },
      { branch: "release", prerelease: true, version: "0.1.0", increment: "MINOR", expected: "0.2.0-rc.1" },
      { branch: "release", prerelease: true, version: "0.2.0-rc.1", increment: "MINOR", expected: "0.3.0-rc.1" },
      { branch: "release", prerelease: true, version: "0.1.0-rc.1", increment: "MAJOR", expected: "1.0.0-rc.1" },
      // Releasing
      { branch: "release", prerelease: false, version: "0.1.0-rc.1", increment: "RELEASE", expected: "0.1.0" },
      { branch: "release", prerelease: false, version: "0.1.0", increment: "RELEASE", expected: "0.1.0" },
      { branch: "release", prerelease: true, version: "0.1.0-rc.1", increment: "RELEASE", expected: "0.1.0-rc.1" },
      { branch: "release", prerelease: true, version: "0.1.0", increment: "RELEASE", expected: "0.1.0" },
    ];

    for (const { branch, prerelease, version, increment, expected } of data) {
      const boolMock = jest
        .spyOn(core, "getBooleanInput")
        .mockImplementation((_name: string, _options?: core.InputOptions): boolean => {
          return prerelease;
        });
      const branchMock = jest.spyOn(branching, "getBranch").mockImplementation(() => {
        return { type: branch as "release" | "default" };
      });
      expect(
        versioning
          .incrementVersion(new versioning.SemVerScheme().createVersion(version), increment as SemVerIncrement)
          .toString()
      ).toBe(expected);
      boolMock.mockReset();
      branchMock.mockReset();
    }
  });

  test("Calendar Versioning", () => {
    const data = [
      // No prerelease
      { branch: "default", prerelease: false, version: "2023.05.0", increment: "CALENDAR", expected: "2023.06.0" },
      {
        branch: "default",
        prerelease: false,
        version: "2023.05.0-dev.1",
        increment: "CALENDAR",
        expected: "2023.06.0",
      },
      { branch: "default", prerelease: false, version: "2023.06.3", increment: "CALENDAR", expected: "2023.06.3" },
      { branch: "default", prerelease: false, version: "2023.06.3", increment: "MICRO", expected: "2023.06.4" },
      { branch: "release", prerelease: false, version: "2023.05.0", increment: "CALENDAR", expected: "2023.06.0" },
      { branch: "release", prerelease: false, version: "2023.05.0-rc.1", increment: "CALENDAR", expected: "2023.06.0" },
      { branch: "release", prerelease: false, version: "2023.06.3", increment: "CALENDAR", expected: "2023.06.3" },
      { branch: "release", prerelease: false, version: "2023.06.3", increment: "MICRO", expected: "2023.06.4" },
      // Prerelease
      { branch: "default", prerelease: true, version: "2023.05.0", increment: "CALENDAR", expected: "2023.06.0-dev.1" },
      {
        branch: "default",
        prerelease: true,
        version: "2023.05.0-dev.1",
        increment: "CALENDAR",
        expected: "2023.06.0-dev.1",
      },
      {
        branch: "default",
        prerelease: true,
        version: "2023.06.0-dev.1",
        increment: "CALENDAR",
        expected: "2023.06.0-dev.2",
      },
      { branch: "default", prerelease: true, version: "2023.06.3", increment: "CALENDAR", expected: "2023.06.3-dev.1" },
      { branch: "default", prerelease: true, version: "2023.06.3", increment: "MICRO", expected: "2023.06.4-dev.1" },
      { branch: "release", prerelease: true, version: "2023.05.0", increment: "CALENDAR", expected: "2023.06.0-rc.1" },
      {
        branch: "release",
        prerelease: true,
        version: "2023.05.0-rc.1",
        increment: "CALENDAR",
        expected: "2023.06.0-rc.1",
      },
      {
        branch: "release",
        prerelease: true,
        version: "2023.06.0-rc.1",
        increment: "CALENDAR",
        expected: "2023.06.0-rc.2",
      },
      { branch: "release", prerelease: true, version: "2023.06.3", increment: "CALENDAR", expected: "2023.06.3-rc.1" },
      { branch: "release", prerelease: true, version: "2023.06.3", increment: "MICRO", expected: "2023.06.4-rc.1" },
      // Releasing
      { branch: "release", prerelease: false, version: "2023.05.0-rc.1", increment: "RELEASE", expected: "2023.05.0" },
      { branch: "release", prerelease: false, version: "2023.05.0", increment: "RELEASE", expected: "2023.05.0" },
      {
        branch: "release",
        prerelease: true,
        version: "2023.05.0-rc.1",
        increment: "RELEASE",
        expected: "2023.05.0-rc.1",
      },
      { branch: "release", prerelease: true, version: "2023.05.0", increment: "RELEASE", expected: "2023.05.0" },
    ];

    for (const { branch, prerelease, version, increment, expected } of data) {
      const boolMock = jest
        .spyOn(core, "getBooleanInput")
        .mockImplementation((_name: string, _options?: core.InputOptions): boolean => {
          return prerelease;
        });
      const branchMock = jest.spyOn(branching, "getBranch").mockImplementation(() => {
        return { type: branch as "release" | "default" };
      });

      expect(
        versioning
          .incrementVersion(new versioning.CalVerScheme().createVersion(version), increment as SemVerIncrement)
          .toString()
      ).toBe(expected);

      boolMock.mockReset();
      branchMock.mockReset();
    }
  });
});
