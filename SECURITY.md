# Security Policy

## Project status

KSA Repository Health is currently in development and has no public application release. Security reports concerning this repository and future preview builds are welcome.

## Reporting a vulnerability

Please report suspected vulnerabilities privately by emailing **alexmtrfnn@gmail.com**.

Include the following information when possible:

- A clear description of the issue
- The affected page, file, or feature
- Steps required to reproduce the behavior
- The potential impact
- Any suggested mitigation

Do not include access tokens, passwords, private keys, personal data, or unrelated confidential information. Please do not open a public GitHub issue for an undisclosed vulnerability.

## Security boundaries for the first release

The application is required to:

- Request public repository information through documented GitHub REST API endpoints
- Perform read-only requests
- Reject arbitrary API hosts and unsupported repository references
- Render API-provided values as text rather than executable markup
- Operate without GitHub access tokens
- Avoid analytics, cookies, tracking, and persistent search storage
- Use a restrictive Content Security Policy

KSA Repository Health does not scan source code for vulnerabilities and must never present its repository-readiness result as a security certification.

## Responsible disclosure

Please allow reasonable time to investigate and correct a confirmed issue before publishing details. Reports made in good faith are appreciated.

## Author and community

- **Author:** KSAGlory
- **Community:** [discord.gg/ksahub](https://discord.gg/ksahub)
