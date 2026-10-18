<!--
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
-->

# Accessing GitHub Release data

## GitHub Release data for newly created GitHub Release

ReleaseMe provides the `release`-output variable containing a [JSON object representing the created GitHub Release](https://docs.github.com/en/rest/releases/releases?apiVersion%253D2022-11-28#get-a-release);

```yaml
- name: Run ReleaseMe
  id: release
  uses: dev-build-deploy/release-me@v0
  with:
    token: ${{ github.token }}

- if: ${{ steps.release.outputs.created }}
  run: echo ${{ fromJSON(steps.release.outputs.release).tag_name }}
```

## Retrieving GitHub Release data

In addition, we provide the `@dev-build-deploy/get` entrypoint for retrieving a JSON object containing the specified GitHub release.

In case you do not provide a specific version as input, it will return the *LATEST* GitHub Release associated with your [versioning strategy](versioning-strategies.md) and branch name (`default` or `release/X`).

```yaml
- name: Run ReleaseMe
  id: release
  uses: dev-build-deploy/release-me/get@v0
  with:
    token: ${{ github.token }}
    tag: 1.2.3  # OPTIONAL; by default it will return the latest release created by ReleaseMe

- name: Expose Release ID
  run: echo ${{ fromJSON(steps.release.outputs.release).id }}
```

This can be particularly useful in case you need to access your GitHub Release (i.e. using its `id`) at a later (decoupled) stage in the delivery chain.

### Retrieving a GitHub Release of another repository

Provide the `repository` input (`owner/name`) to retrieve a GitHub Release of another repository, for example the release of a library or engine your project depends on:

```yaml
- name: Retrieve the engine release
  id: engine
  uses: dev-build-deploy/release-me/get@v0
  with:
    token: ${{ github.token }}
    repository: dev-build-deploy/engine
    tag: v0.1.0  # OPTIONAL; by default it will return the latest release of the default branch

- run: echo ${{ fromJSON(steps.engine.outputs.release).tag_name }}
```

When retrieving the *LATEST* GitHub Release of another repository, your current branch is ignored; the latest release associated with your versioning strategy on the *default branch* of that repository is returned.

> [!NOTE]
> The `token` must have read access (`contents: read`) to the other repository. The default `github.token` only has access to the current repository, so for a private repository you need to provide a token (e.g. a GitHub App installation token or a fine-grained personal access token) with access to that repository.

### Downloading GitHub Release assets

Provide the `download` input to download assets of the retrieved GitHub Release. Each line is an asset name, an asset label or a glob pattern matching either; every line must match at least one asset. The assets are stored by their name in the directory provided by `path` (default: `_assets`), and the `files` output contains a JSON array with the paths of the downloaded files:

```yaml
- name: Download the engine release assets
  id: engine
  uses: dev-build-deploy/release-me/get@v0
  with:
    token: ${{ secrets.ENGINE_TOKEN }}
    repository: dev-build-deploy/engine
    tag: v0.1.0
    download: |
      engine-web.zip
      engine-native-*.tar.gz
    path: third_party/engine

- run: echo '${{ steps.engine.outputs.files }}'  # e.g. ["third_party/engine/engine-web.zip", ...]
```

### Inputs

| Key | Required | Description |
| --- | --- | --- |
| `download` | NO | Multiline list of GitHub Release asset names, labels or glob patterns to download; every entry must match at least one asset |
| `name` | NO | Name associated with the GitHub Release to retrieve, this will take precedence over `tag` if provided as input |
| `path` | NO | Directory to download the GitHub Release assets to. Default: `_assets` |
| `prefix` | NO | Prefix for the version, MUST be one of `[A-Za-z0-9-.]`, only used when retrieving the latest version |
| `token` | YES | GitHub token used to access GitHub |
| `repository` | NO | Repository (`owner/name`) to retrieve the GitHub Release from, defaults to the current repository |
| `tag` | NO | Git tag associated with the GitHub Release to retrieve, defaults to `latest` |
| `versioning` | NO | [Versioning strategy](#versioning-strategies) to apply. MUST be one of `semver` or `calver`. Default: `semver` |

### Outputs

| Key | Description |
| --- | --- |
| `release` | JSON object containing the GitHub Release information |
| `files` | JSON array containing the paths of the downloaded GitHub Release assets (only set when `download` is provided) |

### Permissions

| Permission | Value | Description |
| --- | --- | --- |
| `contents` | `read` | Required to retrieve the GitHub Release and download its assets; for another repository, the `token` needs this permission on that repository |
