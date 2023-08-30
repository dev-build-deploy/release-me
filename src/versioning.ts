/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import { ConventionalCommitError, IConventionalCommit } from "@dev-build-deploy/commit-it";
import { CalVer, SemVer, SemVerIncrement, CalVerIncrement } from "@dev-build-deploy/version-it";

import * as core from "@actions/core";
import { IReleaseConfiguration } from "./changelog";
import * as branching from "./branching";

export type Version = SemVer | CalVer;
export type VersionIncrement = SemVerIncrement | CalVerIncrement;

/**
 * Versioning scheme
 * @abstract
 * @class VersionScheme
 * @member defaultConfiguration Default Release Notes configuration used when no configuration is found in the repository
 * @method determineIncrementType Determines the increment type based on the provided commits
 * @method isValid Determines whether the provided version is valid
 * @method createVersion Creates a Version object based on the provided version string
 */
export abstract class VersionScheme {
  abstract defaultConfiguration: IReleaseConfiguration;
  abstract determineIncrementType(commits: IConventionalCommit[]): VersionIncrement | undefined;
  abstract isValid(version: string): boolean;
  abstract createVersion(version: string): Version;
  abstract initialVersion(): Version;
}

/**
 * Semantic Versioning scheme
 * @class SemVerScheme
 * @extends VersionScheme
 */
export class SemVerScheme extends VersionScheme {
  defaultConfiguration: IReleaseConfiguration = {
    changelog: {
      categories: [
        { title: "💥 Breaking Changes", increment: ["MAJOR"] },
        { title: "✨ New Features", increment: ["MINOR"] },
        { title: "🐛 Bug Fixes", increment: ["PATCH"] },
      ],
    },
  };

  initialVersion(): SemVer {
    const prefix = core.getInput("prefix") ?? undefined;
    return new SemVer(undefined, prefix);
  }

  createVersion(version: string): SemVer {
    const prefix = core.getInput("prefix") ?? undefined;
    return new SemVer(version, prefix);
  }

  /**
   * Determines which Semantic Version core to increments based on the provided commits;
   * - If a commit contains a breaking change, the MAJOR version is incremented.
   * - If a commit contains a feature (`feat:`), the MINOR version is incremented.
   * - If a commit contains a fix (`fix:`), the PATCH version is incremented.
   *
   * In case the branch type is a release branch, the PATCH version is always incremented.
   *
   * @param commits List of commits to determine the increment type for
   * @returns Increment type
   */
  determineIncrementType(commits: IConventionalCommit[]): SemVerIncrement | undefined {
    const typeCount: { [key: string]: number } = { feat: 0, fix: 0 };

    for (const commit of commits) {
      try {
        if (commit.breaking) return branching.getBranch().type === "default" ? "MAJOR" : "PATCH";
        typeCount[commit.type]++;
      } catch (error) {
        if (!(error instanceof ConventionalCommitError)) throw error;
      }
    }

    // Release branches always resort to PATCH versions.
    if (branching.getBranch().type === "release" && (typeCount.feat > 0 || typeCount.fix > 0)) return "PATCH";

    if (typeCount.feat > 0) return "MINOR";
    if (typeCount.fix > 0) return "PATCH";

    return;
  }

  isValid(version: string): boolean {
    try {
      this.createVersion(version);
    } catch (error) {
      return false;
    }
    return true;
  }
}

/**
 * Calendar Versioning scheme
 * @class CalVerScheme
 * @extends VersionScheme
 */
export class CalVerScheme extends VersionScheme {
  defaultConfiguration: IReleaseConfiguration = {
    changelog: {
      categories: [{ title: "✨ New Features", increment: ["*"] }],
    },
  };

  initialVersion(): Version {
    const prefix = core.getInput("prefix") ?? undefined;
    return new CalVer("YYYY.0M.MICRO", undefined, prefix);
  }

  createVersion(version: string): CalVer {
    const prefix = core.getInput("prefix") ?? undefined;
    return new CalVer("YYYY.0M.MICRO", version, prefix);
  }

  /**
   * Determines the increment type based on the current branch type;
   * - If the branch type is a release branch, the MODIFIER version is incremented.
   * - If the branch type is the default branch, the CALENDAR version is incremented.
   * @returns Increment type
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  determineIncrementType(_commits: IConventionalCommit[]): CalVerIncrement | undefined {
    return branching.getBranch().type === "default" ? "CALENDAR" : "MODIFIER";
  }

  isValid(version: string): boolean {
    try {
      this.createVersion(version);
    } catch (error) {
      return false;
    }
    return true;
  }
}

/**
 * Increments the provided version based on the provided increment type.
 *
 * NOTE:
 * - When incrementing a Calendar Version, the MICRO version is incremented in case
 *   the calendar date has not changed.
 * - When incrementing the MODIFIER, the MODIFIER version is set to `hotfix.[n]`
 *
 * @param version Version to increment
 * @param incrementType Type of increment
 * @returns Incremented version
 */
export function incrementVersion(version: Version, incrementType: VersionIncrement | VersionIncrement[]): Version {
  if (!Array.isArray(incrementType)) {
    incrementType = [incrementType];
  }

  if (version instanceof CalVer) {
    // eslint-disable-next-line no-inner-declarations
    function incrementCalVer(version: CalVer, incrementType: CalVerIncrement, keepModifier: boolean) {
      const newVersion = version.increment(incrementType);
      switch (incrementType) {
        case "CALENDAR":
          if (newVersion.major === version.major && newVersion.minor === version.minor) {
            const newVersion = version.increment("MICRO");
            if (keepModifier) {
              newVersion.modifier = version.modifier;
            }
            return newVersion;
          }
          break;
        case "MODIFIER":
          if (version.modifier === undefined) {
            newVersion.modifier = "hotfix.1";
          }
          break;
      }

      return newVersion;
    }

    let newVersion = new CalVer(version.format, version);
    let previousIncrement = "";
    for (const increment of incrementType) {
      newVersion = incrementCalVer(newVersion, increment as CalVerIncrement, previousIncrement === "MODIFIER");
      previousIncrement = increment;

      // TODO: @dev-build-deploy/version-it does not correctly compare CalVer versions with MODIFIERS.
      if (newVersion.isGreaterThan(version)) {
        break;
      }
    }

    return newVersion;
  } else if (version instanceof SemVer) {
    // eslint-disable-next-line no-inner-declarations
    function incrementSemVer(version: SemVer, incrementType: SemVerIncrement, keepMetadata: boolean) {
      if (incrementType === "PRERELEASE") {
        // Apply the pre-release modifier based on the current branch (release: rc.#, default: dev.#)
        const prereleaseModifier = branching.getBranch().type === "release" ? "rc." : "dev.";
        if (!(version.preRelease ?? "").startsWith(prereleaseModifier)) {
          version.preRelease = prereleaseModifier + "0";
        }
      }

      const newVersion = version.increment(incrementType as SemVerIncrement);
      if (keepMetadata) {
        newVersion.preRelease = version.preRelease;
      }
      return newVersion;
    }

    let newVersion = new SemVer(version);
    let previousIncrement = "";
    for (const increment of incrementType) {
      newVersion = incrementSemVer(
        newVersion,
        increment as SemVerIncrement,
        ["PRERELEASE", "BUILD"].includes(previousIncrement)
      );
      previousIncrement = increment as SemVerIncrement;
      if (newVersion.isGreaterThan(version)) {
        break;
      }
    }
    return newVersion;
  }

  throw new Error("Cannot increment version of unknown type!");
}

/**
 * Compares the provided versions
 * @param a Left-side version
 * @param b Right-side version
 * @returns 0 when a is equal to b, 1 when a is greater than b, and -1 when a is less than b
 */
export function compareVersions(a: Version, b: Version) {
  if (a instanceof CalVer && b instanceof CalVer) {
    return a.compareTo(b);
  } else if (a instanceof SemVer && b instanceof SemVer) {
    return a.compareTo(b);
  }

  throw new Error("Cannot compare versions of different types!");
}

/**
 * Returns the versioning scheme based on the provided input
 * @returns Versioning scheme
 */
export function getVersionScheme(): VersionScheme {
  switch (core.getInput("versioning")) {
    case "semver":
      return new SemVerScheme();
    case "calver":
      return new CalVerScheme();
    default:
      throw new Error(`Unsupported versioning scheme (${core.getInput("versioning")})!`);
  }
}

/**
 * Retrieves the increment type basedon the provided scheme and string
 *
 * @param scheme Versioning Scheme
 * @param increment String representation of the increment type
 * @returns Increment type
 */
export function getIncrementType(scheme: VersionScheme, increment: string): SemVerIncrement | CalVerIncrement {
  if (scheme instanceof SemVerScheme) {
    switch (increment.toUpperCase()) {
      case "MAJOR":
      case "MINOR":
      case "PATCH":
      case "PRERELEASE":
      case "BUILD":
        return increment.toUpperCase() as SemVerIncrement;
    }
  } else if (scheme instanceof CalVerScheme) {
    switch (increment.toUpperCase()) {
      case "CALENDAR":
      case "MICRO":
      case "MODIFIER":
        return increment.toUpperCase() as CalVerIncrement;
    }
  }

  throw new Error(`Unsupported increment type (${increment})!`);
}
