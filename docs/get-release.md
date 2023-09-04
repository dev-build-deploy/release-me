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

### Inputs

| Key | Required | Description |
| --- | --- | --- |
| `name` | NO | Name associated with the GitHub Release to retrieve, this will take precedence over `tag` if provided as input |
| `prefix` | NO | Prefix for the version, MUST be one of `[A-Za-z0-9-.]`, only used when retrieving the latest version |
| `token` | YES | GitHub token used to access GitHub |
| `tag` | NO | Git tag associated with the GitHub Release to retrieve, defaults to `latest` |
| `versioning` | NO | [Versioning strategy](#versioning-strategies) to apply. MUST be one of `semver` or `calver`. Default: `semver` |
