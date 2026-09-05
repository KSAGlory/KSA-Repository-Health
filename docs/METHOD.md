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

## Point allocation

### Project documentation: 30 points

- README: 12 points
- Repository description: 8 points
- Project website: 4 points
- Repository topics: 6 points for three or more topics, 3 points for one or two topics

### Contribution readiness: 20 points

- Contributing guide: 5 points
- Code of conduct: 5 points
- Issue template or form: 5 points
- Pull request template: 5 points

### Security and licensing: 20 points

- Security policy: 10 points
- License detected by GitHub or in the repository: 10 points

### Maintenance: 15 points

- Repository is not archived: 5 points
- Repository is not disabled: 5 points
- Latest push was within 365 days: 5 points
- Latest push was more than 365 days but no more than 730 days ago: 3 points

### Release readiness: 15 points

- At least one published, non-draft release: 10 points
- The latest published release has a title or release notes: 5 points

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

The application uses documented, read-only endpoints from the official [GitHub REST API](https://docs.github.com/en/rest). A normal review uses no more than six requests. It does not request an access token or perform write operations.

## Author and community

- **Author:** KSAGlory
- **Community:** [discord.gg/ksahub](https://discord.gg/ksahub)
