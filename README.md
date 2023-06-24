<!--
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
-->

# ReleaseMe - GitHub Release Management

A GitHub Action to create GitHub Releases based on the [Conventional Commits] since the latest release.

![Example](./docs/example.png)

## Features

- Simple to use
- Automatic creation of GitHub Releases
- Management of [GitHub Release assets](#uploading-assets)
- [Configurable changelog](#github-release-configuration)

## Usage

```yaml
name: GitHub Release

concurrency: deployment

on:
  push:
    branches:
      - main

permissions:
  contents: write

jobs:
  release-me:
    name: Create GitHub Release
    runs-on: ubuntu-latest
    steps:
      - name: Run ReleaseMe
        id: release
        uses: dev-build-deploy/release-me@v0
        with:
          token: ${{ github.token }}
          prefix: v  # OPTIONAL; prefixes the Semantic Verion with v (e.g. v1.0.0)
          config: .github/release.yml # OPTIONAL; path to a Release configuration

      - if: ${{ steps.release.outputs.created }}
        run: echo ${{ fromJSON(steps.release.outputs.release).tag_name }}
```

## Uploading assets
Currently, it is only possible to transfer build artifacts, uploaded in your current workflow, to your GitHub Release.

This can be done by providing the `artifacts` input parameter, for ex.:

```yaml
- name: Run ReleaseMe
  uses: dev-build-deploy/release-me@v0
  with:
    token: ${{ github.token }}
    artifacts: |
      artifact Foo
      artifact Bar
```

## GitHub Release Configuration

You can configure the body of the GitHub Release by using a configuration file (loosely based on [Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes));

```yaml
changelog:
  exclude:
    scopes:
      - deps
  categories:
    - title: "💥 Breaking Changes"
      increment: ["major"]
    - title: "✨ New Features"
      increment: ["minor"]
    - title: "🐛 Bug Fixes"
      increment: ["patch"]
      exclude:
        scopes: ["internal"]
    - title: "📚 Documentation"
      types: ["docs"]
      scopes: ["api"]
```

| Key | Description |
| --- | --- |
| `changelog.categories[*].title` | Title to use in the generated Release Notes |
| `changelog.categories[*].increment` | List of [SemVer] increment types (imposed by the Conventional Commits subject) to excinclude in this category |
| `changelog.categories[*].types` | List of [Conventional Commits] types to include in this category |
| `changelog.categories[*].scopes` | List of [Conventional Commits] scopes to include in this category |
| `changelog[.categories[*]].exclude.increment` | List of [SemVer] increment types (imposed by the Conventional Commits subject) to exclude from the Release Notes |
| `changelog[.categories[*]].exclude.types` | List of [Conventional Commits] types to exclude from the Release Notes
| `changelog[.categories[*]].exclude.scopes` | List of [Conventional Commits] scopes to exclude from the Release Notes |

> **NOTE**: You can use the wildcard `*` to specify all values for a specific category. This value is automatically set if a inclusion pattern is not set in the configuration file.

## Inputs

| Key | Required | Description |
| --- | --- | --- |
| `token` | YES | GitHub token used to access GitHub |
| `prefix` | NO | Prefix for the Semantic Version, MUST be one of `[A-Za-z0-9-.]` |
| `config`  | NO | Path to the Release configuration, defaults to `.github/release.yml` | 
| `artifacts` | NO | Multiline list of artifact names, uploaded as part of the current workflow run, to upload as a GitHub Release asset |

## Outputs

| --- | --- |
| `created` | Set to `true` when a release was created, otherwise the output is not set |
| `release` | [Release object](./src/release.ts) containing relevant information about the created release. Only set when `created` is set to `true`.|

## Permissions

| Permission | Value | Description |
| --- | --- | --- |
| `contents` | `write` | Required to create new GitHub Releases (and push tags) |

## Contributing

If you have suggestions for how release-me could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

- [GPL-3.0-or-later AND CC0-1.0](LICENSE) © 2023 Kevin de Jong \<monkaii@hotmail.com\>

[SemVer]: https://semver.org
[Conventional Commits]: https://www.conventionalcommits.org/en/v1.0.0/