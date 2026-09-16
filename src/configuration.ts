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

/** Increment types which can be mapped to a Conventional Commit type */
export const INCREMENT_MAPPING_TYPES = ["MAJOR", "MINOR", "PATCH", "NONE"] as const;
export type IncrementMappingType = (typeof INCREMENT_MAPPING_TYPES)[number];

/**
 * Increment mapping; a mapping of Conventional Commit types to the increment
 * type which should be applied for that specific type.
 *
 * NOTE: Conventional Commit types are stored in lower case, increment types in upper case.
 *
 * @interface IIncrementMapping
 */
export interface IIncrementMapping {
  [type: string]: IncrementMappingType;
}

/**
 * Release configuration
 * @interface IReleaseConfiguration
 * @member increment-mapping Mapping of Conventional Commit types to increment types
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
  "increment-mapping"?: IIncrementMapping;
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

  config["increment-mapping"] = thisModule.getIncrementMapping(config["increment-mapping"]);

  return config;
}

/**
 * Parses (and validates) an increment mapping; both a YAML (or JSON) formatted string, as
 * provided by the `increment-mapping` input parameter, and an already parsed mapping, as
 * provided by the Release configuration file, are supported.
 *
 * @param mapping Increment mapping to parse
 * @param source Source of the increment mapping, used in error messages
 * @returns Validated increment mapping
 * @internal
 */
export function parseIncrementMapping(mapping: unknown, source: string): IIncrementMapping {
  const result: IIncrementMapping = {};
  if (mapping === undefined || (typeof mapping === "string" && mapping.trim() === "")) return result;

  let data = mapping;
  if (typeof mapping === "string") {
    try {
      data = YAML.parse(mapping);
    } catch (ex) {
      throw new Error(`Unable to parse the increment mapping (${source}); ${(ex as Error).message}`);
    }
  }

  if (data === null || data === undefined) return result;
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error(
      `Invalid increment mapping (${source}); expected a mapping of Conventional Commit types to increment types!`
    );
  }

  for (const [key, value] of Object.entries(data as { [key: string]: unknown })) {
    const type = String(key).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(type)) {
      throw new Error(
        `Invalid Conventional Commit type ('${key}') in the increment mapping (${source}); scopes are not supported!`
      );
    }

    const increment = value === null || value === undefined ? "" : String(value).trim().toUpperCase();
    if (!INCREMENT_MAPPING_TYPES.includes(increment as IncrementMappingType)) {
      throw new Error(
        `Invalid increment type ('${String(value)}') for Conventional Commit type '${type}' in the increment mapping (${source}); expected one of ${INCREMENT_MAPPING_TYPES.join(", ")}!`
      );
    }

    result[type] = increment as IncrementMappingType;
  }

  return result;
}

/**
 * Determines the increment mapping to apply, based on the mapping provided by the Release
 * configuration file and the `increment-mapping` input parameter. Both are merged per
 * Conventional Commit type, the input parameter takes precedence.
 *
 * @param configurationMapping Increment mapping as provided by the Release configuration file
 * @returns Increment mapping, or `undefined` in case no mapping has been provided
 * @internal
 */
export function getIncrementMapping(configurationMapping?: IIncrementMapping): IIncrementMapping | undefined {
  const mapping = {
    ...parseIncrementMapping(configurationMapping, core.getInput("config") || "release configuration"),
    ...parseIncrementMapping(core.getInput("increment-mapping"), "increment-mapping"),
  };

  if (Object.keys(mapping).length === 0) return undefined;

  core.info(
    `ℹ️ Increment mapping: ${Object.entries(mapping)
      .map(([type, increment]) => `${type} → ${increment}`)
      .join(", ")}`
  );

  return mapping;
}
