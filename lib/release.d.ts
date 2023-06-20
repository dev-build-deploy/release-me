/** Release Information
 * @interface IReleaseObject
 * @member name The name of the release
 * @member body The body of the release containing the changelog
 * @member draft Whether the release is a draft
 * @member prerelease Whether the release is a prerelease
 * @member make_latest Whether the release is marked as "latest release" (`true`, `false`, or `legacy`)
 * @member tag_name The tag name of the release
 * @member target_commitish The target commitish (branch) of the release
 */
export interface IReleaseObject {
    name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
    make_latest: string;
    tag_name: string;
    target_commitish: string;
}
