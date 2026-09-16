/*
 * SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as fs from "fs";

import * as core from "@actions/core";
import { ConventionalCommit } from "@dev-build-deploy/commit-it";

import { IReleaseConfiguration } from "./configuration";
import { VersionScheme } from "./versioning";

/**
 * Converts string to contain a capital first character
 * @param value Value to convert
 * @return Value with a capital first character
 */
function firstCharToUpperCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Reads the changelog from the provided file
 * @param file File to read the changelog from
 * @returns Changelog from file
 */
export async function readChangelogFromFile(file: string): Promise<string> {
  return fs.readFileSync(file, "utf8");
}

/**
 * Generate the changelog based on the provided version and commits
 * @param versionScheme Versioning scheme of the Release
 * @param commits Conventional Commits part of the Changelog
 * @param config Release configuration
 * @returns Changelog in Markdown format
 */
export async function generateChangelog(
  versionScheme: VersionScheme,
  commits: ConventionalCommit[],
  config: IReleaseConfiguration
): Promise<string> {
  core.info("📓 Generating Release Notes...");

  const isWildcard = (value?: string[]): boolean => isMatch(value, "*");
  const isMatch = (value?: string[], item?: string): boolean => {
    if (!item || !value) {
      return false;
    }
    return value.includes(item);
  };

  const title = "## What's Changed";
  const changelog = `${title}\n\n${config.changelog?.categories
    ?.map(category => {
      const categoryCommits = commits.filter(commit => {
        if (!commit.isValid) return false;

        const incrementType = versionScheme.determineIncrementType([commit], config["increment-mapping"]);

        const hasValidIncrement =
          (isWildcard(category.increment) || isMatch(category.increment, incrementType)) &&
          !isMatch(category.exclude?.increment, incrementType) &&
          !isMatch(config.changelog?.exclude?.increment, incrementType);

        const hasValidType =
          (isWildcard(category.types) || isMatch(category.types, commit.type)) &&
          !isMatch(category.exclude?.types, commit.type) &&
          !isMatch(config.changelog?.exclude?.types, commit.type);

        const hasValidScope =
          (isWildcard(category.scopes) || isMatch(category.scopes, commit.scope)) &&
          !isMatch(category.exclude?.scopes, commit.scope) &&
          !isMatch(config.changelog?.exclude?.scopes, commit.scope);

        return hasValidIncrement === true && hasValidType === true && hasValidScope === true;
      });

      if (categoryCommits.length > 0)
        return `### ${category.title}\n\n${categoryCommits
          .map(commit => `- ${firstCharToUpperCase(commit.description ?? "")}`)
          .join("\n")}\n\n`;
    })
    .join("\n")}`;

  return changelog;
}
