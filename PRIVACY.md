# Privacy

## Current project status

KSA Repository Health is in development and the public application has not been deployed. This document defines the privacy boundary required for the first public release.

## Information the application uses

The user provides a public GitHub repository URL or an `owner/repository` value. The browser sends the normalized repository reference directly to the official GitHub REST API to retrieve the public information required for the report.

## Information KSA Repository Health does not collect

The application does not collect or request:

- Names or account profiles
- Email addresses
- Passwords or GitHub access tokens
- Private repository information
- Source-code archives
- Search history
- Analytics or advertising identifiers
- Browser fingerprints

## Storage

KSA Repository Health does not operate an application backend or database. Repository references and results remain in browser memory for the current page session and are not intentionally stored by the application.

## Cookies and tracking

The application does not use cookies, analytics, advertising, tracking pixels, or session-recording services.

## External services

When published, the application uses:

- GitHub Pages to deliver the static website
- The GitHub REST API to retrieve public repository information

GitHub may process network and request information according to its own terms and privacy statement. KSA Repository Health does not control GitHub's independent processing.

## Future changes

Any feature that requires authentication, server-side processing, persistent storage, or a new third-party service will require a privacy review and an update to this document before release.

## Contact

Privacy questions may be sent to **alexmtrfnn@gmail.com**. Do not include passwords, access tokens, private keys, or other sensitive information.

## Author and community

- **Author:** KSAGlory
- **Community:** [discord.gg/ksahub](https://discord.gg/ksahub)
