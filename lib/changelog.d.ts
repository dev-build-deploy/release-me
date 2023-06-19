import { IConventionalCommit } from "@dev-build-deploy/commit-it";
import { SemVer } from "./semver";
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
export declare function getConfiguration(): IReleaseConfiguration;
/**
 * Generate the changelog based on the provided version and commits
 * @param version SemVer version of the Release
 * @param commits Conventional Commits part of the Changelog
 * @returns Changelog in Markdown format
 */
export declare function generateChangelog(version: SemVer, commits: IConventionalCommit[]): string;
export {};
