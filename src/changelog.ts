/*
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IConventionalCommit } from "@dev-build-deploy/commit-it";
import { ISemVer } from "@dev-build-deploy/version-it";
import { determineIncrementType } from "./action";
import * as thisModule from "./changelog";
import * as core from "@actions/core";
import * as github from "@actions/github";
import YAML from "yaml";

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
  changelog: {
    exclude?: IExclude;
    categories: {
      title: string;
      increment?: (keyof ISemVer | "*")[];
      types?: string[];
      scopes?: string[];
      exclude?: IExclude;
    }[];
  };
}

/**
 * Default configuration used when no configuration is found in the repository
 */
const defaultConfiguration: IReleaseConfiguration = {
  changelog: {
    categories: [
      { title: "💥 Breaking Changes", increment: ["major"] },
      { title: "✨ New Features", increment: ["minor"] },
      { title: "🐛 Bug Fixes", increment: ["patch"] },
    ],
  },
};

/**
 * Retrieve the configuration from the repository (.github/release.yml)
 * @returns Release configuration
 * @internal
 */
export async function getConfigurationFromAPI(): Promise<IReleaseConfiguration | undefined> {
  const octokit = github.getOctokit(core.getInput("token"));
  try {
    const { data: data } = await octokit.rest.repos.getContent({
      ...github.context.repo,
      path: core.getInput("config"),
      ref: github.context.ref,
    });

    if ("content" in data) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return YAML.parse(content) as IReleaseConfiguration;
    }
  } catch (error) {
    if ((error as Error).message !== "Not Found") {
      throw error;
    }
    core.info("No release configuration found, using default configuration");
  }
}

/**
 * Get the configuration for the Changelog; either from the repository
 * (.github/release.yml) or the default configuration
 *
 * NOTE: If a category filter is not set, then it is assumed to be a wildcard
 *
 * @return Changelog configuration
 */
export async function getConfiguration(): Promise<IReleaseConfiguration> {
  const config = (await thisModule.getConfigurationFromAPI()) ?? defaultConfiguration;

  config.changelog.categories.forEach(category => {
    if (category.increment === undefined) category.increment = ["*"];
    if (category.scopes === undefined) category.scopes = ["*"];
    if (category.types === undefined) category.types = ["*"];
  });

  return config;
}

/**
 * Converts string to contain a capital first character
 * @param value Value to convert
 * @return Value with a capital first character
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
export async function generateChangelog(commits: IConventionalCommit[]) {
  const isWildcard = (value?: string[]) => isMatch(value, "*");
  const isMatch = (value?: string[], item?: string) =>
    item !== undefined && value !== undefined && value.includes(item);

  const config = await getConfiguration();
  const title = "## What's Changed";
  const changelog = `${title}\n\n${config.changelog?.categories
    ?.map(category => {
      const categoryCommits = commits.filter(commit => {
        const incrementType = determineIncrementType([commit]);

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
          .map(commit => `- ${firstCharToUpperCase(commit.description)}`)
          .join("\n")}\n\n`;
    })
    .join("\n")}`;

  return changelog;
}
