# Repository Readiness Method

KSA Repository Health measures whether a public GitHub repository presents essential information clearly to users and potential contributors.

## What the score means

The score measures **public repository readiness**. It does not measure source-code quality, application security, project popularity, or legal compliance.

The application awards points only when the required GitHub API evidence is available. If required data cannot be retrieved, the report is marked **Incomplete** instead of treating missing data as a failed check.

## Categories

| Category | Maximum | Checks |
|---|---:|---|
| Project documentation | 30 | README, description, project website, and topics |
| Contribution readiness | 20 | Contributing guide, code of conduct, issue template, and pull request template |
| Security and licensing | 20 | Security policy and detected license |
| Maintenance | 15 | Repository is active, not archived, and not disabled |
| Release readiness | 15 | A published release and useful release metadata are available |
| **Total** | **100** | Transparent sum of all checks |

## Result labels

- **90 to 100:** Excellent foundation
- **75 to 89:** Strong foundation
- **55 to 74:** Developing foundation
- **0 to 54:** Important essentials missing

## Recommendation order

Recommendations are ordered by practical impact. Security reporting, project documentation, licensing clarity, and maintenance status appear before optional discoverability improvements.

## Important limitations

- A detected security policy does not prove that a repository or application is secure.
- A detected license reports GitHub's public metadata and does not provide legal advice.
- Repository activity does not prove active support or software quality.
- A published release does not prove that the release is safe or stable.
- Open issue and pull request counts must be labeled according to the data GitHub provides.
- Private repositories are not supported in the first release.

## Data source

The first release will use documented, read-only endpoints from the official [GitHub REST API](https://docs.github.com/en/rest). It will not request an access token or perform write operations.

## Author and community

- **Author:** KSAGlory
- **Community:** [discord.gg/ksahub](https://discord.gg/ksahub)
