<!--
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
-->

# GitHub Release Asset Management

ReleaseMe allows you to manage assets associated with a GitHub Release, including:

- Updating/Uploading assets from both build artifacts and local files.
- Downloading assets from a GitHub Release
- Removing assets from a GitHub Release

## Creating a new GitHub Release including Assets

You can directly provide a list of build artifacts (`artifacts:`) and local files (`files:`) to be uploaded to the GitHub Release upon creation:

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
      # Create an example file
      - run: echo "Example" > output.txt

      # Upload the output file as a build artifact
      - uses: actions/upload-artifact@v3
      with:
        name: output-as-artifact
        path: output.txt

      - name: Run ReleaseMe
        id: release
        uses: dev-build-deploy/release-me@v0
        with:
          token: ${{ github.token }}
          artifacts: output-as-artifact  # Downloads the build artifact and uploads it as a GitHub Release Asset
          files: output.txt              # Uploads the local file as a GitHub Release Asset

      - if: ${{ steps.release.outputs.created }}
        run: echo ${{ fromJSON(steps.release.outputs.release).id }}  # This will provide the newly created GitHub Release ID
```

## Asset Management

ReleaseMe also provides the `dev-build-deploy/release-me/assets` entrypoint for managing your GitHub Release Assets in later stages of your delivery chain.

### Updating GitHub Release Assets

```yaml
- name: Run ReleaseMe
  id: release
  uses: dev-build-deploy/release-me/assets@v0
  with:
    token: ${{ github.token }}
    artifacts: output-as-artifact  # Downloads the build artifact and updates the GitHub Release assets
    files: output.txt              # Updates the GitHub Release Assets to include the local file
    release-id: <INTEGER>          # Release ID of the GitHub Release to update
```

### Removing GitHub Release Assets


```yaml
- name: Run ReleaseMe
  id: release
  uses: dev-build-deploy/release-me/assets@v0
  with:
    token: ${{ github.token }}
    remove: |                      # List of assets to remove from the GitHub Release
      output-as-artifact
      output.txt
    release-id: <INTEGER>          # Release ID of the GitHub Release to update
```

### Downloading GitHub Release Assets

```yaml
- name: Run ReleaseMe
  id: release
  uses: dev-build-deploy/release-me/assets@v0
  with:
    token: ${{ github.token }}
    remove: |                      # List of assets to remove from the GitHub Release
      output-as-artifact
      output.txt
    release-id: <INTEGER>          # Release ID of the GitHub Release to update
```

### Inputs

| Key | Required | Description |
| --- | --- | --- |
| `token` | YES | GitHub token used to access GitHub |
| `release-id` | YES | Release ID associated with the GitHub Release to update |
| `artifacts` | NO | Multiline list of artifact names, uploaded as part of the current workflow run, to upload as a GitHub Release asset |
| `files` | NO | Multiline list of files (paths) to upload as a GitHub Release asset |
| `remove` | NO | Multiline list of GitHub Asset label to remove from the GitHub Release assets |
| `download` | NO | Multiline list of GitHub Asset labels to download from the GitHub Release |

### Permissions

| Permission | Value | Description |
| --- | --- | --- |
| `contents` | `write` | Required to manage GitHub Release assets |