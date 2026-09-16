/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import { ConventionalCommit } from "@dev-build-deploy/commit-it";
import { CalVer, SemVer, SemVerIncrement, CalVerIncrement } from "@dev-build-deploy/version-it";

import * as branching from "./branching";
import { IIncrementMapping, IncrementMappingType, IReleaseConfiguration } from "./configuration";

export type Version = SemVer | CalVer;
export type VersionIncrement = SemVerIncrement | CalVerIncrement;

/** Relative weight of each increment type; `NONE` does not result in a release */
const INCREMENT_WEIGHT: { [key in IncrementMappingType]: number } = { NONE: 0, PATCH: 1, MINOR: 2, MAJOR: 3 };

/** Increment type per relative weight */
const INCREMENT_BY_WEIGHT = ["NONE", "PATCH", "MINOR", "MAJOR"] as const;

/**
 * Default mapping of Conventional Commit types to increment types.
 *
 * NOTE: breaking changes are not part of the mapping as those are, in line with
 *       the Conventional Commits specification, always considered `MAJOR`.
 */
const DEFAULT_INCREMENT_MAPPING: IIncrementMapping = { feat: "MINOR", fix: "PATCH" };

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
  abstract determineIncrementType(
    commits: ConventionalCommit[],
    incrementMapping?: IIncrementMapping
  ): VersionIncrement | undefined;
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
    const semver = new SemVer();
    semver.prefix = prefix;
    return semver;
  }

  createVersion(version: string): SemVer {
    const prefix = core.getInput("prefix") ?? undefined;
    return SemVer.fromString(version, prefix);
  }

  /**
   * Determines which Semantic Version core to increments based on the provided commits;
   * - If a commit contains a breaking change, the MAJOR version is incremented.
   * - Otherwise the increment mapping determines the increment type per Conventional
   *   Commit type (by default; `feat:` -> MINOR and `fix:` -> PATCH), of which the
   *   largest increment is applied.
   *
   * In case the branch type is a release branch, the PATCH version is always incremented.
   *
   * @param commits List of commits to determine the increment type for
   * @param incrementMapping Increment mapping, applied on top of the default mapping
   * @returns Increment type
   */
  determineIncrementType(
    commits: ConventionalCommit[],
    incrementMapping?: IIncrementMapping
  ): SemVerIncrement | undefined {
    const mapping = { ...DEFAULT_INCREMENT_MAPPING, ...incrementMapping };
    let weight = INCREMENT_WEIGHT.NONE;

    for (const commit of commits) {
      if (!commit.isValid) continue;
      if (commit.breaking) return branching.getBranch().type === "default" ? "MAJOR" : "PATCH";

      // Implementors of the Conventional Commit specification MUST always treat Conventional Commit elements as non-case sensitive.
      const increment = mapping[commit.type?.toLowerCase() ?? ""];
      if (increment !== undefined) weight = Math.max(weight, INCREMENT_WEIGHT[increment]);
    }

    if (weight === INCREMENT_WEIGHT.NONE) return undefined;

    // Release branches always resort to PATCH versions.
    return branching.getBranch().type === "default" ? (INCREMENT_BY_WEIGHT[weight] as SemVerIncrement) : "PATCH";
  }

  isValid(version: string): boolean {
    try {
      const v = this.createVersion(version);
      return v.prefix === this.prefix;
    } catch {
      // Return false if the version creation fails
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
    return new CalVer("YYYY.0M.MICRO", undefined, prefix);
  }

  createVersion(version: string): CalVer {
    const prefix = core.getInput("prefix") ?? undefined;
    return CalVer.fromString("YYYY.0M.MICRO", version, prefix);
  }

  /**
   * Determines the increment type based on the current branch type;
   * - If the branch type is a release branch, the MODIFIER version is incremented.
   * - If the branch type is the default branch, the CALENDAR version is incremented.
   * @returns Increment type
   */
  determineIncrementType(
    _commits: ConventionalCommit[],
    _incrementMapping?: IIncrementMapping
  ): CalVerIncrement | undefined {
    return branching.getBranch().type === "default" ? "CALENDAR" : "MODIFIER";
  }

  isValid(version: string): boolean {
    try {
      const v = this.createVersion(version);
      return v.prefix === this.prefix;
    } catch {
      return false;
    }
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
 * Helper function to manage increments of Calendar Versions
 * @param version Current version
 * @param incrementType Increment type
 * @param keepModifier Keep the existing modifier
 * @returns Incremented Calendar Version
 */
function incrementCalVer(version: CalVer, incrementType: CalVerIncrement, keepModifier: boolean): CalVer {
  switch (incrementType) {
    case "CALENDAR": {
      let newVersion = version.increment(incrementType);
      if (newVersion.major === version.major && newVersion.minor === version.minor) {
        newVersion = version.increment("MICRO");
        if (keepModifier) {
          newVersion.modifiers = version.modifiers;
        }
      }
      return newVersion;
    }
    case "MODIFIER": {
      const newVersion = version.increment(incrementType, "hotfix");
      if (version.modifiers.length === 0) {
        newVersion.modifiers = [{ identifier: "hotfix", value: 1, length: 1 }];
      }
      return newVersion;
    }
  }

  throw new Error(`Unsupported increment type (${incrementType})!`);
}

/**
 * Helper function to manage increments of Semantic Versions
 * @param version Current version
 * @param incrementType Increment type
 * @param keepMetadata Keep the pre-release metadata
 * @returns Incremented Semantic Version
 */
function incrementSemVer(version: SemVer, incrementType: SemVerIncrement, keepMetadata: boolean): SemVer {
  let prereleaseModifier = undefined;

  if (incrementType === "PRERELEASE") {
    // Apply the pre-release modifier based on the current branch (release: rc.#, default: dev.#)
    prereleaseModifier = branching.getBranch().type === "release" ? "rc" : "dev";
    if (version.preReleases.length === 0 || (version.preReleases[0].identifier ?? "") !== prereleaseModifier) {
      version.preReleases = [{ identifier: prereleaseModifier, value: 0, length: 1 }];
    }
  }

  const newVersion = version.increment(incrementType, prereleaseModifier);

  if (keepMetadata) {
    newVersion.preReleases = version.preReleases;
  }

  return newVersion;
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
