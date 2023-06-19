/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

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
  major: number;
  minor: number;
  patch: number;
  preRelease?: string;
  build?: string;

  constructor(version: string) {
    // SemVer regex
    const semVerRegEx =
      /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(-(?<preRelease>[a-zA-Z0-9.-]+))?(\+(?<build>[a-zA-Z0-9.-]+))?$/;
    const groups = semVerRegEx.exec(version)?.groups;
    if (groups === undefined) throw new Error(`Unable to parse version: ${version}`);

    this.major = parseInt(groups.major);
    this.minor = parseInt(groups.minor);
    this.patch = parseInt(groups.patch);
    this.preRelease = groups.preRelease;
    this.build = groups.build;
  }

  static isSemVer(version: string) {
    const semVerRegEx =
      /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(-(?<preRelease>[a-zA-Z0-9.-]+))?(\+(?<build>[a-zA-Z0-9.-]+))?$/;

    return semVerRegEx.exec(version)?.groups !== undefined;
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
  bump(type: "major" | "minor" | "patch" | "preRelease" | "build"): SemVer {
    const semVer = new SemVer(this.toString());
    switch (type) {
      case "preRelease":
        semVer.build = undefined;
        if (semVer.preRelease === undefined) semVer.preRelease = "rc.1"; // TODO: Make this configurable
        else {
          const identifier = identifierKeyValue(semVer.preRelease);
          if (identifier?.key === undefined || identifier?.value === undefined)
            throw new Error("Unable to bump pre-release");
          semVer.preRelease = `${identifier.key}${identifier.value + 1}`;
        }
        break;
      case "build":
        if (semVer.build === undefined) semVer.build = "build.1"; // TODO: Make this configurable
        else {
          const identifier = identifierKeyValue(semVer.build);
          if (identifier?.key === undefined || identifier?.value === undefined) throw new Error("Unable to bump build");
          semVer.build = `${identifier.key}${identifier.value + 1}`;
        }
        break;
      case "major":
        semVer.major += 1;
        semVer.minor = 0;
        semVer.patch = 0;
        semVer.preRelease = undefined;
        semVer.build = undefined;
        break;
      case "minor":
        semVer.minor += 1;
        semVer.patch = 0;
        semVer.preRelease = undefined;
        semVer.build = undefined;
        break;
      case "patch":
        semVer.patch += 1;
        semVer.preRelease = undefined;
        semVer.build = undefined;
        break;
    }

    return semVer;
  }

  /**
   * Returns the SemVer as a string
   * @returns SemVer as a string
   */
  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}${this.preRelease ? "-" + this.preRelease : ""}${
      this.build ? "+" + this.build : ""
    }`;
  }
}

/**
 * Returns the value of the identifier (e.g. 1.2.3-alpha.1 => 1)
 * @param identifier Identifier to parse (e.g. alpha.1)
 * @returns Identifier value (e.g. 1)
 */
function identifierKeyValue(identifier?: string): { key?: string; value?: number } | undefined {
  if (identifier === undefined) return {};

  const identifierRegex = /^([a-zA-Z-]+[.])([0-9]+)$/;
  const match = identifierRegex.exec(identifier);
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
  const keys: (keyof ISemVer)[] = ["major", "minor", "patch"];
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
