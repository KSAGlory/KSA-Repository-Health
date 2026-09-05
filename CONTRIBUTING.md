# Contributing

Thank you for your interest in KSA Repository Health.

## Current stage

The project is in its foundation stage. The product scope, security boundaries, and visual direction are established, while the public application is not implemented yet.

Before beginning substantial work, open a focused issue and wait for confirmation that the proposal fits the approved scope. This helps prevent duplicated effort and protects the application's privacy and read-only guarantees.

## Good contributions

- Reproducible bug reports
- Accessibility improvements
- Clear corrections to documentation
- Tests for supported repository inputs and API responses
- Small improvements that preserve the documented privacy and security boundaries

## Pull request requirements

- Keep each pull request focused on one purpose.
- Explain the user-facing reason for the change.
- Add or update tests when behavior changes.
- Preserve keyboard and screen-reader accessibility.
- Do not add analytics, tracking, authentication, write operations, or persistent storage without prior approval.
- Do not commit credentials, access tokens, generated secrets, personal data, or unrelated files.
- Confirm that formatting, tests, and security checks pass.
- Use professional, specific commit messages and pull request descriptions.

## Development setup

KSA Repository Health has no production dependencies. Node.js 22 or later is required for the local development and validation scripts.

```text
npm run dev
npm test
npm run check
npm run build
```

The development server listens on `127.0.0.1` and uses port `4173` by default. Set `KSA_REPOSITORY_HEALTH_PORT` when a different local port is required.


## Conduct

All participation must follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Do not open a public issue for an undisclosed vulnerability. Follow [SECURITY.md](SECURITY.md).

## Author and community

- **Author:** KSAGlory
- **Community:** [discord.gg/ksahub](https://discord.gg/ksahub)
