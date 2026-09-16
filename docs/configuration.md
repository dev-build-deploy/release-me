<!--
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>
SPDX-License-Identifier: MIT
-->

# Configuration

You can configure both the version increment and the body of the GitHub Release by using a configuration file (loosely based on [Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes));

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

## Increment mapping

You can map [Conventional Commits] types to the increment type to apply, extending the
defaults (`feat` -> `MINOR` and `fix` -> `PATCH`);

```yaml
increment-mapping:
  chore: PATCH
  docs: PATCH
  perf: MINOR
  refactor: NONE
```

| Key | Description |
| --- | --- |
| `increment-mapping.<type>` | Increment type (`MAJOR`, `MINOR`, `PATCH` or `NONE`) to apply for the provided [Conventional Commits] type |

The identical mapping can be provided using the `increment-mapping` input parameter, which
takes precedence per Conventional Commit type. Please refer to the
[Versioning strategies](./versioning-strategies.md#increment-mapping) for more details,
including the limitations.

> **NOTE**: The changelog categories are based on the *resulting* increment type. A type
> mapped to `PATCH` therefore ends up in any category selecting `increment: ["PATCH"]`;
> use `types` or `exclude.types` in case you want to list (or omit) it explicitly.

[Conventional Commits]: https://www.conventionalcommits.org/en/v1.0.0/