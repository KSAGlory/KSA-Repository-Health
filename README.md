# KSA Repository Health

Review the public-facing readiness of a GitHub repository through clear, read-only checks.

> **Project status:** In active development. Repository analysis, scoring, prioritized guidance, and the quality review are complete. Public deployment remains in progress.

## Purpose

KSA Repository Health helps developers identify repository essentials that may be missing before they share a project with users, contributors, employers, or clients.

The application reviews public GitHub information and explains each result in practical language. Its findings are advisory and do not replace source-code review, security testing, or legal guidance.

## Repository checks

- Project documentation, including the README, description, website, and topics
- Contribution guidance, including contributing instructions and community templates
- Security policy and detected license information
- Maintenance signals exposed by GitHub
- Release availability and public release details
- Clear, prioritized recommendations for missing essentials

The scoring method is documented in [Repository Readiness Method](docs/METHOD.md).

## How it works

1. Enter a public GitHub repository URL or `owner/repository` value.
2. KSA Repository Health requests the required public information from the official GitHub REST API.
3. Review the readiness score, category details, detected strengths, and prioritized recommendations.

If GitHub cannot provide required evidence, the application marks the report incomplete instead of treating unknown checks as failures. A normal review uses no more than six read-only API requests.

The first release will not require GitHub sign-in or an access token. It will not edit repositories, inspect private repositories, execute source code, or store search history.

## Privacy and security

KSA Repository Health is designed as a static, read-only GitHub Pages application.

- No accounts
- No analytics or advertising
- No cookies or tracking
- No application database
- No personal access tokens
- No write operations

See [Privacy](PRIVACY.md) and [Security](SECURITY.md) for the complete boundaries.

## Technology

- Semantic HTML, modern CSS, and JavaScript
- GitHub REST API for public repository data
- GitHub Pages for static hosting
- Automated accessibility, security, and quality checks

## Local development

Node.js 22 or later is required.

```text
npm install
npm run dev
npm run check
npm run test:browser
npm run build
```

The application has no production dependencies. Playwright is used only for development-time browser testing.

## Development roadmap

- [x] Product and security specification
- [x] Responsive light and dark interface direction
- [x] Public repository foundation
- [x] Application foundation and safe API client
- [x] Repository analysis and scoring
- [x] Accessibility, security, and browser validation
- [ ] GitHub Pages publication

## Project documentation

- [Repository Readiness Method](docs/METHOD.md)
- [Technical Architecture](docs/ARCHITECTURE.md)
- [Quality Review](docs/QUALITY.md)
- [Privacy](PRIVACY.md)
- [Security](SECURITY.md)
- [Support](SUPPORT.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Product ideas and clearly described accessibility improvements are welcome through GitHub Issues.

## License

This project is licensed under the [MIT License](LICENSE).

## Author and community

- **Author:** KSAGlory
- **Community:** [discord.gg/ksahub](https://discord.gg/ksahub)
