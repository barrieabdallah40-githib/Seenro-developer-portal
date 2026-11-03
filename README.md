# SEENRO Developer Portal

The SEENRO Developer Portal is a separate static frontend for managing SEENRO developer accounts, projects, and project-bound API keys.

## Current production integration

- Portal: https://developers.seenrotech.com
- API base URL: https://api.seenrotech.com/api/v1
- Backend: SEENRO Core

The portal currently supports:

- Developer registration, login, session management, and logout.
- Creating and listing developer projects.
- Creating, listing, and revoking project-bound API keys.
- Selecting API permissions when creating keys.
- Displaying a newly created API key secret once for the developer to copy.

## Supported API-key scopes

The Core accepts these scopes:

| Scope | Permission |
|---|---|
| `projects:read` | Read permitted project information |
| `projects:write` | Create or modify permitted project resources |
| `data:read` | Read project data records |
| `data:write` | Create, update, or delete project data records |
| `auth:read` | Access permitted application-authentication read operations |
| `auth:write` | Access permitted application-authentication write operations |

Keys are bound to a project. The Core checks project ownership and enforces the key's permissions.

## Important API-key security

- A newly created API-key secret is displayed only once.
- The Core stores a hash of the key, not its original secret.
- Keep API-key secrets private.
- Use project API keys only from your application's trusted backend.
- Never embed a secret in browser JavaScript, public repositories, or mobile application code.
- Revoke a key if it is exposed or no longer needed.

The portal's developer login session is used to manage projects and API keys. It is separate from project API-key authentication.

## Project deletion

Project deletion is currently disabled by SEENRO Core to protect project data. The portal therefore does not offer project deletion.

## Planned services

The following are not currently advertised as available APIs:

- Businesses API
- AI API
- Automation API

They remain planned platform areas.

## Deployment

The portal is maintained as a separate static frontend and Vercel project. Its production domain is `developers.seenrotech.com`.

The Core API is hosted separately at `api.seenrotech.com`.

Changes to this repository do not automatically mean that production has been updated. Review, merge, and deployment are separate steps.

## Development

This repository contains the portal frontend. Do not put backend credentials, production secrets, or private API-key values in source files or commits.
