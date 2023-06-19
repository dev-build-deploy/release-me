/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IConventionalCommit } from "@dev-build-deploy/commit-it";
import { SemVer } from "./semver";
import { determineBumpType } from "./action";
import * as thisModule from "./changelog";

type semVerBumpTypes = "major" | "minor" | "patch" | "none";

/**
 * Exclude configuration
 * @interface IExclude
 * @member bump Exclude commits from the changelog based on the bump type
 * @member types Exclude commits from the changelog based on the type
 * @member scopes Exclude commits from the changelog based on the scope
 */
interface IExclude {
  bump?: semVerBumpTypes[];
  types?: string[];
  scopes?: string[];
}

/**
 * Release configuration
 * @interface IReleaseConfiguration
 * @member changelog Changelog configuration
 * @member changelog.exclude Exclude commits from the changelog
 * @member changelog.categories Categories to use in the changelog
 * @member changelog.categories.title Title of the category
 * @member changelog.categories.bump Bump type for the category
 * @member changelog.categories.types Types to include in the category
 * @member changelog.categories.scopes Scopes to include in the category
 * @member changelog.categories.exclude Exclude commits from the category
 */
interface IReleaseConfiguration {
  changelog?: {
    exclude?: IExclude;
    categories?: {
      title: string;
      bump?: semVerBumpTypes[];
      types?: string[];
      scopes?: string[];
      exclude?: IExclude;
    }[];
  };
}

/**
 * Get the configuration for the Changelog
 * @returns
 */
export function getConfiguration(): IReleaseConfiguration {
  // TODO: Read configuration from file (.github/release.y[a]ml)
  return {
    changelog: {
      categories: [
        { title: "💥 Breaking Changes", bump: ["major"] },
        { title: "✨ New Features", bump: ["minor"] },
        { title: "🐛 Bug Fixes", bump: ["patch"] },
      ],
    },
  };
}

/**
 * First character to upper case
 * @param value
 * @returns
 */
function firstCharToUpperCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Generate the changelog based on the provided version and commits
 * @param version SemVer version of the Release
 * @param commits Conventional Commits part of the Changelog
 * @returns Changelog in Markdown format
 */
export function generateChangelog(version: SemVer, commits: IConventionalCommit[]) {
  const config = thisModule.getConfiguration();

  const changelog = `## What's Changed\n\n${config.changelog?.categories
    ?.map(category => {
      const categoryCommits = commits.filter(commit => {
        if (category.bump && !category.bump.includes((determineBumpType([commit]) as semVerBumpTypes) ?? "none"))
          return false;
        if (
          category.exclude?.bump &&
          category.exclude.bump.includes((determineBumpType([commit]) as semVerBumpTypes) ?? "none")
        )
          return false;
        if (
          config.changelog?.exclude?.bump &&
          config.changelog.exclude.bump.includes((determineBumpType([commit]) as semVerBumpTypes) ?? "none")
        )
          return false;

        if (category.types && !category.types.includes(commit.type)) return false;
        if (category.exclude?.types && category.exclude.types.includes(commit.type)) return false;
        if (config.changelog?.exclude?.types && config.changelog.exclude.types.includes(commit.type)) return false;

        if (category.scopes && !category.scopes.includes(commit.scope ?? "none")) return false;
        if (category.exclude?.scopes && category.exclude.scopes.includes(commit.scope ?? "none")) return false;
        if (config.changelog?.exclude?.scopes && config.changelog.exclude.scopes.includes(commit.scope ?? "none"))
          return false;

        return true;
      });

      if (categoryCommits.length === 0) return "";

      return `### ${category.title}\n\n${categoryCommits
        .map(commit => `- ${firstCharToUpperCase(commit.description)}`)
        .join("\n")}\n\n`;
    })
    .join("\n")}`;

  return changelog;
}
