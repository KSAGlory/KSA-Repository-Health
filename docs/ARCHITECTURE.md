# Technical Architecture

## Overview

KSA Repository Health is a static browser application built with semantic HTML, modern CSS, and JavaScript modules. It has no production framework, server-side application, database, analytics service, or authentication system.

The first production boundary is intentionally narrow:

```text
User input
    |
    v
Repository reference validation
    |
    v
Read-only GitHub API client
    |
    v
Normalized public evidence
    |
    v
Deterministic readiness analysis
    |
    v
Accessible interface states
```

## Modules

### `src/repository-reference.js`

Validates and normalizes a GitHub repository URL or `owner/repository` value. It rejects insecure protocols, non-GitHub hosts, credentials, ports, query strings, fragments, encoded path separators, subpages, and malformed owner or repository names.

### `src/github-api.js`

Provides the read-only GitHub REST API boundary. The client:

- Uses the fixed `https://api.github.com` origin
- Sends the recommended GitHub media type
- Requests GitHub REST API version `2026-03-10`
- Omits browser credentials
- Applies a request timeout
- Exposes rate-limit information through normalized data
- Converts network and API failures into safe user-facing errors
- Does not return raw API error responses to the interface

One review requests the repository record, community profile, latest release, and directory listings for the repository root, `.github`, and `docs`. The maximum is six requests. If an auxiliary request fails, later optional requests are skipped to preserve the user's public API allowance.

### `src/health-analysis.js`

Applies the documented 100-point method to normalized evidence. The analyzer is deterministic and has no network or interface access. It distinguishes passed, partial, missing, and unavailable checks. If required evidence is unavailable, it returns an incomplete report without calculating a potentially misleading score.

### `src/app.js`

Coordinates form validation, request cancellation, loading, report, error, reset, and theme behavior. API-provided values are assigned through `textContent`. Repository links are constructed from the validated user reference rather than an API-provided URL. Recommendation links come from a fixed internal list of official GitHub guidance.

### `src/styles.css`

Implements the approved pastel interface system with light, dark, desktop, mobile, reduced-motion, and forced-color behavior.

## Request lifecycle

1. The user submits a repository reference.
2. The reference is validated before any request begins.
3. An earlier unfinished request is cancelled.
4. The API client retrieves up to six public evidence sources in a fixed sequence.
5. Responses are normalized into the limited fields required by the analysis.
6. The analyzer calculates the score, category totals, strengths, and ordered recommendations.
7. The interface renders the report safely and displays the remaining API allowance when available.
8. If required evidence cannot be retrieved, the interface presents an incomplete report and identifies unavailable checks.
9. A core request failure is mapped to a specific recovery message without exposing raw transport details.

## Browser security

- A restrictive Content Security Policy limits scripts, styles, images, fonts, and network connections.
- No third-party script or style is loaded.
- No token or browser credential is sent.
- No API value is rendered as raw HTML.
- External links use `noopener` and `noreferrer`.
- Input length and repository path segments are constrained.
- Stale requests are cancelled before a new check begins.

## Development commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server |
| `npm test` | Run the Node.js test suite |
| `npm run check` | Validate JavaScript syntax and run all tests |
| `npm run build` | Prepare the static production files in `dist` |

The application has no production or development package dependencies at this stage. The scripts use Node.js built-in modules.

## Current boundary

The application reviews public repository presentation and maintenance evidence. It does not inspect source code, authenticate users, access private repositories, determine legal compliance, or perform security testing.

## Author and community

- **Author:** KSAGlory
- **Community:** [discord.gg/ksahub](https://discord.gg/ksahub)
