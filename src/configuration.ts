/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { CalVerIncrement, SemVerIncrement } from "@dev-build-deploy/version-it";
import { RequestError } from "@octokit/request-error";
import YAML from "yaml";

import * as thisModule from "./configuration";

/**
 * Exclude configuration
 * @interface IExclude
 * @member increment Exclude commits from the changelog based on the increment type
 * @member types Exclude commits from the changelog based on the type
 * @member scopes Exclude commits from the changelog based on the scope
 */
export interface IExclude {
  increment?: (SemVerIncrement | CalVerIncrement)[];
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
export interface IReleaseConfiguration {
  changelog: {
    exclude?: IExclude;
    categories: {
      title: string;
      increment?: (SemVerIncrement | CalVerIncrement | "*")[];
      types?: string[];
      scopes?: string[];
      exclude?: IExclude;
    }[];
  };
}

/**
 * Retrieve the configuration from the repository (.github/release.yml)
 * @returns Release configuration
 * @internal
 */
export async function getConfigurationFromAPI(): Promise<IReleaseConfiguration | undefined> {
  const octokit = github.getOctokit(core.getInput("token"));
  try {
    const { data } = await octokit.rest.repos.getContent({
      ...github.context.repo,
      path: core.getInput("config"),
      ref: github.context.ref,
    });

    if ("content" in data) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return YAML.parse(content) as IReleaseConfiguration;
    }
  } catch (error) {
    if (error instanceof RequestError && error.response) {
      const reponseData = error.response.data as Record<string, unknown>;
      if ("message" in reponseData && reponseData.message === "Not Found") {
        core.info("No release configuration found, using default configuration");
        return;
      }
    }
    throw error;
  }
}

/**
 * Get the Release configuration; either from the repository (.github/release.yml)
 * or the provided default configuration.
 *
 * NOTE: If a category filter is not set, then it is assumed to be a wildcard
 *
 * @param defaultConfiguration Configuration to use when the repository does not provide one
 * @return Release configuration
 */
export async function getConfiguration(defaultConfiguration: IReleaseConfiguration): Promise<IReleaseConfiguration> {
  const config = (await thisModule.getConfigurationFromAPI()) ?? defaultConfiguration;

  config.changelog.categories.forEach(category => {
    category.increment ??= ["*"];
    category.scopes ??= ["*"];
    category.types ??= ["*"];
  });

  return config;
}
