<!--
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
-->

# Configuration

You can configure the body of the GitHub Release by using a configuration file (loosely based on [Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes));

```yaml
changelog:
  exclude:
    scopes:
      - deps
  categories:
    - title: "💥 Breaking Changes"
      increment: ["MAJOR"]
    - title: "✨ New Features"
      increment: ["MINOR"]
    - title: "🐛 Bug Fixes"
      increment: ["PATCH"]
      exclude:
        scopes: ["internal"]
    - title: "📚 Documentation"
      types: ["docs"]
      scopes: ["api"]
```

| Key | Description |
| --- | --- |
| `changelog.categories[*].title` | Title to use in the generated Release Notes |
| `changelog.categories[*].increment` | List of increment types (see [Versioning strategies](#versioning-strategies) for an overview) to include in this category |
| `changelog.categories[*].types` | List of [Conventional Commits] types to include in this category |
| `changelog.categories[*].scopes` | List of [Conventional Commits] scopes to include in this category |
| `changelog[.categories[*]].exclude.increment` |List of increment types (see [Versioning strategies](#versioning-strategies) for an overview) to exclude in this category |
| `changelog[.categories[*]].exclude.types` | List of [Conventional Commits] types to exclude from the Release Notes
| `changelog[.categories[*]].exclude.scopes` | List of [Conventional Commits] scopes to exclude from the Release Notes |

> **NOTE**: You can use the wildcard `*` to specify all values for a specific category. This value is automatically set if a inclusion pattern is not set in the configuration file.

[Conventional Commits]: https://www.conventionalcommits.org/en/v1.0.0/