/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import { ConventionalCommit } from "@dev-build-deploy/commit-it";
import { CalVer, SemVer, SemVerIncrement, CalVerIncrement } from "@dev-build-deploy/version-it";

import * as branching from "./branching";
import { IReleaseConfiguration } from "./changelog";

export type Version = SemVer | CalVer;
export type VersionIncrement = SemVerIncrement | CalVerIncrement | "RELEASE";

/**
 * Versioning scheme
 * @abstract
 * @class VersionScheme
 * @member defaultConfiguration Default Release Notes configuration used when no configuration is found in the repository
 * @method determineIncrementType Determines the increment type based on the provided commits
 * @method isValid Determines whether the provided version is valid
 * @method createVersion Creates a Version object based on the provided version string
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export abstract class VersionScheme {
  abstract defaultConfiguration: IReleaseConfiguration;
  abstract determineIncrementType(commits: ConventionalCommit[]): VersionIncrement | undefined;
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
  prefix = core.getInput("prefix") ?? undefined;

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
    return new SemVer({ prefix: prefix });
  }

  createVersion(version: string): SemVer {
    const prefix = core.getInput("prefix") ?? undefined;
    return SemVer.fromString(version, prefix);
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
  determineIncrementType(commits: ConventionalCommit[]): SemVerIncrement | undefined {
    const typeCount: { [key: string]: number } = { feat: 0, fix: 0 };

    for (const commit of commits) {
      if (!commit.isValid) continue;
      if (commit.breaking) return branching.getBranch().type === "default" ? "MAJOR" : "PATCH";

      // Implementors of the Conventional Commit specification MUST always treat Conventional Commit elements as non-case sensitive.
      const commitType = commit.type?.toLowerCase() ?? "";
      if (commitType === "feat" || commitType === "fix") {
        typeCount[commitType]++;
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
      const v = this.createVersion(version);
      return v.prefix === this.prefix;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Calendar Versioning scheme
 * @class CalVerScheme
 * @extends VersionScheme
 */
export class CalVerScheme extends VersionScheme {
  prefix = core.getInput("prefix") ?? undefined;

  defaultConfiguration: IReleaseConfiguration = {
    changelog: {
      categories: [{ title: "✨ New Features", increment: ["*"] }],
    },
  };

  initialVersion(): Version {
    const prefix = core.getInput("prefix") ?? undefined;
    return new CalVer("YYYY.0M.MICRO", { prefix: prefix });
  }

  createVersion(version: string): CalVer {
    const prefix = core.getInput("prefix") ?? undefined;
    return CalVer.fromString("YYYY.0M.MICRO", version, prefix);
  }

  /**
   * We always increment the CALENDAR version when running without input parameters.
   * @returns Increment type
   */
  determineIncrementType(_commits: ConventionalCommit[]): CalVerIncrement | undefined {
    return "CALENDAR";
  }

  isValid(version: string): boolean {
    try {
      const v = this.createVersion(version);
      return v.prefix === this.prefix;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Increments the provided version based on the provided increment type.
 *
 * - When incrementing a Calendar Version:
 *   - The CALENDAR version is always updated. The `-dev` or `-rc` modifiers are added based
 *      on the current branch in case the user did not provide this as increment-type.
 *   - The User is expected to provide the MICRO increment type when making a formal release.
 * - We remove any pre-release identifier which is not -rc or -dev.
 *
 * @param version Version to increment
 * @param incrementType Type of increment
 * @returns Incremented version
 */
export function incrementVersion(version: Version, incrementType: VersionIncrement): Version {
  const isPrerelease = core.getBooleanInput("prerelease");

  if (version instanceof CalVer) {
    switch (incrementType) {
      case "RELEASE": {
        if (!isPrerelease) {
          const newVersion = new CalVerScheme().createVersion(version.toString());
          newVersion.modifiers = [];
          return newVersion;
        }

        return version;
      }

      case "CALENDAR":
      case "MICRO": {
        if (isPrerelease) {
          const isReleaseBranch = branching.getBranch().type === "release";
          const modifier = isReleaseBranch ? "rc" : "dev";

          const newVersion = version.increment(incrementType as CalVerIncrement).increment("MODIFIER", modifier);
          newVersion.modifiers = newVersion.modifiers.filter(element => element.identifier === modifier);
          return newVersion;
        }
        return version.increment(incrementType as CalVerIncrement);
      }
    }
  } else if (version instanceof SemVer) {
    switch (incrementType) {
      case "RELEASE": {
        if (!isPrerelease) {
          const newVersion = new SemVerScheme().createVersion(version.toString());
          newVersion.preReleases = [];
          return newVersion;
        }

        return version;
      }

      case "MAJOR":
      case "MINOR":
      case "PATCH": {
        if (isPrerelease) {
          const isReleaseBranch = branching.getBranch().type === "release";
          const modifier = isReleaseBranch ? "rc" : "dev";

          const newVersion = version.increment(incrementType as SemVerIncrement).increment("PRERELEASE", modifier);
          newVersion.preReleases = newVersion.preReleases.filter(element => element.identifier === modifier);
          return newVersion;
        }

        return version.increment(incrementType as SemVerIncrement);
      }
    }
  }

  throw new Error(`Cannot increment version of unknown type: ${incrementType}!`);
}

/**
 * Compares the provided versions
 * @param a Left-side version
 * @param b Right-side version
 * @returns 0 when a is equal to b, 1 when a is greater than b, and -1 when a is less than b
 */
export function compareVersions(a: Version, b: Version): number {
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
export function getIncrementType(scheme: VersionScheme, increment: string): VersionIncrement {
  if (increment.toUpperCase() === "RELEASE") return "RELEASE";

  if (scheme instanceof SemVerScheme) {
    switch (increment.toUpperCase()) {
      case "MAJOR":
      case "MINOR":
      case "PATCH":
        return increment.toUpperCase() as SemVerIncrement;
    }
  } else if (scheme instanceof CalVerScheme) {
    switch (increment.toUpperCase()) {
      case "CALENDAR":
      case "MICRO":
        return increment.toUpperCase() as CalVerIncrement;
    }
  }

  throw new Error(`Unsupported increment type (${increment})!`);
}
