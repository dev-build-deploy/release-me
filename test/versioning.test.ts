/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
*/

import * as core from "@actions/core";
import { ConventionalCommit } from "@dev-build-deploy/commit-it";
import { SemVer, CalVer } from "@dev-build-deploy/version-it";

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
    expect(calver.determineIncrementType(commits)).toBe("MODIFIER");
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
    expect(calver.determineIncrementType(commits)).toBe("MODIFIER");
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
    expect(calver.determineIncrementType(commits)).toBe("MODIFIER");
  });

  test("Added bug fix", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "fix: prevent bug" }),
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore: non breaking change" }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBe("PATCH");
    expect(calver.determineIncrementType(commits)).toBe("MODIFIER");
  });

  test("No change", () => {
    const commits: ConventionalCommit[] = [
      ConventionalCommit.fromString({ hash: "0a0b0c0d", message: "chore: non breaking change" }),
    ];
    const semver = new versioning.SemVerScheme();
    const calver = new versioning.CalVerScheme();

    expect(semver.determineIncrementType(commits)).toBeUndefined();
    expect(calver.determineIncrementType(commits)).toBe("MODIFIER");
  });
});

describe("Increment version with fallback", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2023, 5, 12));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("SemVer", () => {
    jest.spyOn(branching, "getBranch").mockImplementation(() => {
      return { type: "default" };
    });

    expect(
      versioning
        .incrementVersion(new versioning.SemVerScheme().createVersion("0.1.0"), ["PRERELEASE", "MINOR"])
        .toString()
    ).toBe("0.2.0-dev.1");

    expect(
      versioning
        .incrementVersion(new versioning.SemVerScheme().createVersion("0.2.0-dev.1"), ["PRERELEASE", "MINOR"])
        .toString()
    ).toBe("0.2.0-dev.2");

    expect(
      versioning
        .incrementVersion(new versioning.SemVerScheme().createVersion("0.1.0"), ["PRERELEASE", "MAJOR"])
        .toString()
    ).toBe("1.0.0-dev.1");

    expect(
      versioning
        .incrementVersion(new versioning.SemVerScheme().createVersion("0.1.0-dev.1"), ["PRERELEASE", "MAJOR"])
        .toString()
    ).toBe("0.1.0-dev.2");
  });

  test("CalVer", () => {
    jest.spyOn(branching, "getBranch").mockImplementation(() => {
      return { type: "default" };
    });

    expect(
      versioning
        .incrementVersion(new versioning.CalVerScheme().createVersion("2023.06.0"), ["MODIFIER", "CALENDAR"])
        .toString()
    ).toBe("2023.06.1-hotfix.1");
  });
});

describe("Increment version (CalVer)", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2023, 5, 12));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("Main Branch (new date)", () => {
    jest.spyOn(branching, "getBranch").mockImplementation(() => {
      return { type: "default" };
    });

    expect(
      versioning.incrementVersion(new versioning.CalVerScheme().createVersion("2023.05.0"), "CALENDAR").toString()
    ).toBe("2023.06.0");
  });

  test("Main Branch (same date)", () => {
    jest.spyOn(branching, "getBranch").mockImplementation(() => {
      return { type: "default" };
    });
    expect(
      versioning.incrementVersion(new versioning.CalVerScheme().createVersion("2023.06.0"), "CALENDAR").toString()
    ).toBe("2023.06.1");
  });

  test("Release Branch", () => {
    jest.spyOn(branching, "getBranch").mockImplementation(() => {
      return { type: "release", modifier: "2023.06" };
    });
    expect(
      versioning.incrementVersion(new versioning.CalVerScheme().createVersion("2023.05.0"), "MODIFIER").toString()
    ).toBe("2023.05.0-hotfix.1");
    expect(
      versioning
        .incrementVersion(new versioning.CalVerScheme().createVersion("2023.05.0-hotfix.1"), "MODIFIER")
        .toString()
    ).toBe("2023.05.0-hotfix.2");
  });
});

describe("Increment mapping", () => {
  const commit = (message: string): ConventionalCommit => ConventionalCommit.fromString({ hash: "0a0b0c0d", message });

  beforeEach(() => {
    jest.spyOn(branching, "getBranch").mockImplementation(() => {
      return { type: "default" };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Extends the default mapping", () => {
    const semver = new versioning.SemVerScheme();

    expect(semver.determineIncrementType([commit("chore: update dependencies")], { chore: "PATCH" })).toBe("PATCH");
    expect(semver.determineIncrementType([commit("feat: add new feature")], { chore: "PATCH" })).toBe("MINOR");
    expect(semver.determineIncrementType([commit("docs: update documentation")], { chore: "PATCH" })).toBeUndefined();
  });

  test("Overrides the default mapping", () => {
    const semver = new versioning.SemVerScheme();

    expect(semver.determineIncrementType([commit("fix: prevent bug")], { fix: "NONE" })).toBeUndefined();
    expect(semver.determineIncrementType([commit("feat: add new feature")], { feat: "PATCH" })).toBe("PATCH");
  });

  test("Applies the largest increment type", () => {
    const semver = new versioning.SemVerScheme();

    expect(
      semver.determineIncrementType([commit("fix: prevent bug"), commit("chore: update dependencies")], {
        chore: "MINOR",
      })
    ).toBe("MINOR");
  });

  test("Breaking changes are always MAJOR", () => {
    const semver = new versioning.SemVerScheme();

    expect(semver.determineIncrementType([commit("feat!: breaking change")], { feat: "NONE" })).toBe("MAJOR");
    expect(semver.determineIncrementType([commit("chore!: breaking change")], { chore: "NONE" })).toBe("MAJOR");
  });

  test("Release branches resort to PATCH", () => {
    jest.spyOn(branching, "getBranch").mockImplementation(() => {
      return { type: "release", modifier: "1.2" };
    });
    const semver = new versioning.SemVerScheme();

    expect(semver.determineIncrementType([commit("chore: update dependencies")], { chore: "MINOR" })).toBe("PATCH");
    expect(semver.determineIncrementType([commit("docs: update documentation")], { chore: "MINOR" })).toBeUndefined();
  });

  test("Is ignored when using Calendar Versioning", () => {
    const calver = new versioning.CalVerScheme();

    expect(calver.determineIncrementType([commit("chore: update dependencies")], { chore: "NONE" })).toBe("CALENDAR");
  });
});
