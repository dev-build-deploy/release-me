<!--
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
-->

# Versioning Strategies

The following versioning strategies are currently supported:

- (Default) [Semantic Versioning](#semantic-versioning)
- [Calendar Versioning](#calendar-versioning)

## Semantic Versioning

ReleaseMe uses a subset of Semantic Versioning based on Conventional Commits;

`MAJOR.MINOR.PATCH`

| Item | Description |
| --- | --- |
| `MAJOR` | Breaking change to the (public) API |
| `MINOR` | New feature added in a backwards compatible manner |
| `PATCH` | Backwards compatible bug fix |

The version is incremented based on Conventional Commits.

You can mark your changes as "BREAKING" by either adding a `!` indicator after you Conventional Commit type:

```
feat!: breaking API change
```

or by adding `BREAKING-CHANGE` to the footer of your commit message:

```
feat: introducing new feature X

This commit introduces feature X, which required a large
redesign of the core functionality. We have decided to
drop support of the original API (`DoIt(...`) as this would
have a significant impact on the maintenance burden of our
application.

BREAKING-CHANGE: removes the `DoIt(...)` method in favor of `DoItBetter(...)`
```

In addition, on the *default branch*, the Conventional Commit type is taken into account according to specification;

| Type | Current Version | Incremented Version |
| --- | --- | --- |
| Breaking change | `0.1.2` | `1.0.0` |
| `feat` | `1.0.0` | `1.1.0` |
| `fix` | `1.1.0` | `1.1.1` |
| Anything else | `1.1.1` | - |

Any other Conventional Commit type will, unless breaking, **not** increment the version.

Any changes made to a *release branch* (`release/<MAJOR>.<MINOR>`) will **at most** increment `PATCH`:

| Type | Current Version | Incremented Version |
| --- | --- | --- |
| Breaking change | `0.1.2` | `0.1.3` |
| `feat` | `0.1.3` | `0.1.4` |
| `fix` | `0.1.4` | `0.1.5` |
| Anything else | `0.1.5` | - |

<details>
<summary>Example...</summary>

```mermaid
gitGraph
       commit tag: "1.3.0"
       commit
       commit tag: "1.3.1"
       branch "release/1.3"
       checkout main
       commit
       commit tag: "1.4.0"
       commit
       commit tag: "1.4.1" id: "A"
       checkout "release/1.3"
       cherry-pick id: "A" tag: "1.3.2"
       checkout main
       commit tag: "2.0.0"
       commit
```

</details>


## Calendar Versioning

You can use Calendar Versioning for your releases, using the following predefined [CalVer] format:

`YYYY.0M.MICRO[-MODIFIER]`

| Item | Description |
| --- | --- |
| `YYYY` | Full year |
| `0M` | Zero padded month number |
| `MICRO` | Incremental release number |
| `MODIFIER` | Reserved for incremental releases on a [release branch](#branching-strategy). Will use a value in the range `hotfix.[n]` |

Every single change made to your *default branch* will result in:
- an increment of the `CALENDAR` type:
- an increment of the `MICRO` type in case the calendar date did not change

For example:

| Current date | Current Version | Incremented Version |
| --- | --- | --- |
| 21 Jun 2023 | `2023.06.0` | `2023.06.1` |
| 28 Jun 2023 | `2023.06.1` | `2023.06.2` |
| 6 Jul 2023 | `2023.06.2` | `2023.07.0` |

> :bulb: More details can be found [here](https://github.com/dev-build-deploy/version-it#incrementing-the-version-1)

Any change made to a *release branch* (`release/<YYYY>.<0M>.<MICRO>`), will increase the `MODIFIER`:

| Current date | Current Version | Incremented Version |
| --- | --- | --- |
| 21 Jun 2023 | `2023.06.0` | `2023.06.0-hotfix.1` |
| 28 Sep 2023 | `2023.06.0-hotfix.1` | `2023.06.0-hotfix.2` |
| 6 Dec 2023 | `2023.06.0-hotifx.2` | `2023.06.0-hotfix.3` |

<details>
<summary>Example...</summary>

```mermaid
gitGraph
       commit tag: "2023.06.0"
       commit
       commit tag: "2023.06.1"
       branch "release/2023.06.1"
       checkout main
       commit
       commit tag: "2023.06.2"
       commit
       commit tag: "2023.07.0" id: "A"
       checkout "release/2023.06.1"
       cherry-pick id: "A" tag: "2023.06.1-hotfix.1"
       checkout main
       commit tag: "2023.07.1"
       commit
```

</details>
