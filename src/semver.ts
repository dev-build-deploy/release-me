/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

const SEMVER_REGEX =
  /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(-(?<preRelease>[a-zA-Z0-9.-]+))?(\+(?<build>[a-zA-Z0-9.-]+))?$/;

type SemVerIdentifier = "preRelease" | "build";
type SemVerVersionCore = "major" | "minor" | "patch";

/**
 * A simple SemVer implementation
 * @interface ISemVer
 * @member major Major version
 * @member minor Minor version
 * @member patch Patch version
 * @member preRelease Pre-release identifier
 * @member build Build identifier
 * @method toString Returns the SemVer as a string
 * @internal
 */
export interface ISemVer {
  major: number;
  minor: number;
  patch: number;
  preRelease?: string;
  build?: string;
}

/**
 * A simple SemVer implementation
 * @class SemVer
 * @implements ISemVer
 * @member major Major version
 * @member minor Minor version
 * @member patch Patch version
 * @member preRelease Pre-release identifier
 * @member build Build identifier
 * @method toString Returns the SemVer as a string
 * @throws Error Unable to parse version
 * @internal
 */
export class SemVer implements ISemVer {
  prefix?: string;
  major: number;
  minor: number;
  patch: number;
  preRelease?: string;
  build?: string;

  constructor(version?: {
    major?: number;
    minor?: number;
    patch?: number;
    preRelease?: string;
    build?: string;
    prefix?: string;
  }) {
    this.major = version?.major ?? 0;
    this.minor = version?.minor ?? 0;
    this.patch = version?.patch ?? 0;
    this.preRelease = version?.preRelease;
    this.build = version?.build;
    this.prefix = version?.prefix;
  }

  /**
   * Construct a SemVer object from a version string
   * @param version Version string
   * @param prefix Prefix to remove from the version string
   * @returns SemVer object
   */
  static fromString(version: string, prefix?: string): SemVer {
    // Handle prefix
    if (prefix !== undefined) {
      if (!version.startsWith(prefix)) throw new Error("Incorrect SemVer, missing prefix");
      version = version.substring(prefix.length);
    }

    // SemVer regex
    const groups = SEMVER_REGEX.exec(version)?.groups;
    if (groups === undefined) throw new Error("Could not parse SemVer");

    return new SemVer({
      major: parseInt(groups.major),
      minor: parseInt(groups.minor),
      patch: parseInt(groups.patch),
      preRelease: groups.preRelease,
      build: groups.build,
      prefix: prefix,
    });
  }

  /**
   * Checks if the provided string is a valid SemVer
   * @param version Version to check
   * @returns Whether the provided string is a SemVer
   */
  static isValid(version: string, prefix?: string): boolean {
    try {
      SemVer.fromString(version, prefix);
      return true;
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Bumps the value of the SemVer identifier
   * @param identifier Identifier to bump
   * @returns Bumped identifier, undefined when identifier does not exist
   */
  private bumpIdentifier(identifier: SemVerIdentifier): string | undefined {
    if (this[identifier] === undefined) return;

    const keyValuePair = identifierKeyValue(this[identifier]);
    if (keyValuePair?.key === undefined || keyValuePair?.value === undefined)
      throw new Error(`Unable to bump ${identifier}`);

    return `${keyValuePair.key}${keyValuePair.value + 1}`;
  }

  /**
   * Bumps the SemVer based on the provided type:
   * - major: 1.0.0 => 2.0.0
   * - minor: 1.0.0 => 1.1.0
   * - patch: 1.0.0 => 1.0.1
   * - preRelease: 1.0.0 => 1.0.0-rc.1
   * - build: 1.0.0 => 1.0.0+build.1
   *
   * Bumping a type will reset any lesser significant types (e.g. bumping minor will reset patch, preRelease, and build).
   *   order of significance: major > minor > patch > preRelease > build
   *
   * @param type Type of bump
   * @returns Bumped SemVer
   */
  bump(type: SemVerVersionCore | SemVerIdentifier): SemVer {
    switch (type) {
      case "preRelease":
        return new SemVer({ ...this, preRelease: this.bumpIdentifier(type) ?? "rc.1", build: undefined });
      case "build":
        return new SemVer({ ...this, preRelease: this.preRelease, build: this.bumpIdentifier(type) ?? "build.1" });
      case "major":
        return new SemVer({ prefix: this.prefix, major: this.major + 1 });
      case "minor":
        return new SemVer({ prefix: this.prefix, major: this.major, minor: this.minor + 1 });
      case "patch":
        return new SemVer({ prefix: this.prefix, major: this.major, minor: this.minor, patch: this.patch + 1 });
    }
  }

  /**
   * Returns the SemVer as a string
   * @returns SemVer as a string
   */
  toString(): string {
    return `${this.prefix !== undefined ? this.prefix : ""}${this.major}.${this.minor}.${this.patch}${
      this.preRelease ? "-" + this.preRelease : ""
    }${this.build ? "+" + this.build : ""}`;
  }
}

/**
 * Returns the value of the identifier (e.g. 1.2.3-alpha.1 => 1)
 * @param identifier Identifier to parse (e.g. alpha.1)
 * @returns Identifier value (e.g. 1)
 */
function identifierKeyValue(identifier?: string): { key?: string; value?: number } | undefined {
  const identifierRegex = /^([a-zA-Z-]+[.])([0-9]+)$/;
  const match = identifierRegex.exec(identifier ?? "");
  if (match === null) return {};

  return { key: match[1], value: parseInt(match[2]) };
}

/**
 * Sorts the provided identifiers (e.g. 1.2.3-alpha.1 < 1.2.3-alpha.2)
 * @param a Left-hand side identifier
 * @param b Right-hand side identifier
 * @returns Sorting value
 */
function sortIdentifier(a?: string, b?: string): number | undefined {
  const aValue = identifierKeyValue(a)?.value;
  const bValue = identifierKeyValue(b)?.value;

  if (aValue === undefined && bValue !== undefined) return 1;
  if (aValue !== undefined && bValue === undefined) return -1;
  if (aValue !== undefined && bValue !== undefined && aValue !== bValue) return aValue > bValue ? 1 : -1;

  return;
}

/**
 * Sorts the provided SemVer objects, for example:
 *  1.2.3-alpha.1 < 1.2.3-alpha.2
 *  0.1.0 < 1.0.0
 *  0.1.1.rc1 < 0.1.1
 *
 * @param a Left-hand side SemVer
 * @param b Right-hand side SemVer
 * @returns Sorting value
 * @internal
 */
export function sortSemVer(a: ISemVer, b: ISemVer): number {
  const keys: SemVerVersionCore[] = ["major", "minor", "patch"];

  for (const key of keys) {
    const aValue = a[key] as number;
    const bValue = b[key] as number;
    if (aValue !== bValue) return aValue > bValue ? 1 : -1;
  }

  const sortPreRelease = sortIdentifier(a.preRelease, b.preRelease);
  if (sortPreRelease !== undefined) return sortPreRelease;

  const sortBuild = sortIdentifier(a.build, b.build);
  if (sortBuild !== undefined) return sortBuild;

  return 0;
}
