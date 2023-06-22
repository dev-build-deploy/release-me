/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IConventionalCommit } from "@dev-build-deploy/commit-it";
import { ISemVer } from "@dev-build-deploy/version-it";
import { determineIncrementType } from "./action";
import * as thisModule from "./changelog";

/**
 * Exclude configuration
 * @interface IExclude
 * @member increment Exclude commits from the changelog based on the increment type
 * @member types Exclude commits from the changelog based on the type
 * @member scopes Exclude commits from the changelog based on the scope
 */
interface IExclude {
  increment?: (keyof ISemVer)[];
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
 * @member changelog.categories.increment Increment type for the category
 * @member changelog.categories.types Types to include in the category
 * @member changelog.categories.scopes Scopes to include in the category
 * @member changelog.categories.exclude Exclude commits from the category
 */
interface IReleaseConfiguration {
  changelog?: {
    exclude?: IExclude;
    categories?: {
      title: string;
      increment?: (keyof ISemVer)[];
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
        { title: "💥 Breaking Changes", increment: ["major"] },
        { title: "✨ New Features", increment: ["minor"] },
        { title: "🐛 Bug Fixes", increment: ["patch"] },
      ],
    },
  } as IReleaseConfiguration;
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
export function generateChangelog(commits: IConventionalCommit[]) {
  const config = thisModule.getConfiguration();
  const title = "## What's Changed";
  const changelog = `${title}\n\n${config.changelog?.categories
    ?.map(category => {
      const categoryCommits = commits.filter(commit => {
        const incrementType = determineIncrementType([commit]);
        const hasValidIncrement =
          incrementType === undefined
            ? category.increment === undefined
            : category.increment?.includes(incrementType) &&
              !category.exclude?.increment?.includes(incrementType) &&
              !config.changelog?.exclude?.increment?.includes(incrementType);

        const hasValidType =
          category.types?.includes(commit.type) !== false &&
          !category.exclude?.types?.includes(commit.type) &&
          !config.changelog?.exclude?.types?.includes(commit.type);

        const hasValidScope =
          commit.scope === undefined
            ? (category.scopes?.length ?? 0) === 0
            : category.scopes?.includes(commit.scope) !== false &&
              !category.exclude?.scopes?.includes(commit.scope) &&
              !config.changelog?.exclude?.scopes?.includes(commit.scope);

        return hasValidIncrement && hasValidType && hasValidScope;
      });

      if (categoryCommits.length === 0) return `### ${category.title}`;

      return `### ${category.title}\n\n${categoryCommits
        .map(commit => `- ${firstCharToUpperCase(commit.description)}`)
        .join("\n")}\n\n`;
    })
    .join("\n")}`;

  return changelog;
}
