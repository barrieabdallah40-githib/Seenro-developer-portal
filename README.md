# SEENRO Developer Portal

A separate static frontend for the early-access SEENRO Core API.

## Current integration

- Portal: https://developers.seenrotech.com
- API base URL: https://api.seenrotech.com/api/v1
- Backend: SEENRO Core

## Current capabilities

- Developer registration, login, session management, and logout.
- Email verification and resend-verification integration.
- Forgot-password and password-reset integration.
- Creating and listing developer projects.
- Creating, listing, and revoking project-bound API keys.
- Selecting supported API permission scopes.
- Copying a newly generated API-key secret when it is displayed.

Email verification and password recovery require the matching Core backend
feature and a correctly configured email provider. Their presence in this
frontend branch does not mean production email delivery is already active.

## Getting started

1. Open the Developer API section.
2. Register an account or sign in.
3. Create a project or select an existing project.
4. Generate a project-bound API key with only the permissions required.
5. Copy and securely store the secret when it is displayed.

An existing signed-in session should open the workspace rather than require
registration again.

## Supported API-key scopes

| Scope | Permission |
|---|---|
| `projects:read` | Read permitted project information |
| `projects:write` | Create or modify permitted project resources |
| `data:read` | Read project data records |
| `data:write` | Create, update, or delete project data records |
| `auth:read` | Access permitted application-authentication read operations |
| `auth:write` | Access permitted application-authentication write operations |

Keys are bound to a project. Core checks project ownership and enforces
the permissions assigned to each key.

## API endpoints

Developer account:
- `POST /register`
- `POST /login`
- `POST /logout`
- `GET /me`

Email verification and recovery:
- `POST /verify-email`
- `POST /resend-verification`
- `POST /forgot-password`
- `POST /reset-password`

Projects and API keys:
- `GET /developer/projects`
- `POST /developer/projects`
- `GET /keys`
- `POST /keys`
- `DELETE /keys/{key_id}`

Project data records:
- `POST /projects/{project_id}/collections/{collection}/records`
- `GET /projects/{project_id}/collections/{collection}/records`
- `GET /projects/{project_id}/collections/{collection}/records/{record_id}`
- `PUT /projects/{project_id}/collections/{collection}/records/{record_id}`
- `DELETE /projects/{project_id}/collections/{collection}/records/{record_id}`

Project deletion is currently disabled by Core to protect project data.

## API-key security

- A newly created API-key secret is displayed only once.
- Core stores a hash of the key, not its original secret.
- Keep API-key secrets private.
- Use project API keys only from your application's trusted backend.
- Never embed secret keys in browser JavaScript, public repositories, or mobile application code.
- Revoke a key if it is exposed or no longer needed.
- Grant only the permissions an application requires.

The developer login session used to manage projects and keys is separate
from project API-key authentication.

## Planned services

The following are planned platform areas and are not advertised here as
currently available APIs:

- Businesses API
- AI API
- Automation API

## Deployment

This repository contains a separate static frontend, maintained as a
separate Vercel project for `developers.seenrotech.com`.

The Core API is hosted separately at `api.seenrotech.com`.

Changes to this repository do not automatically update production.
Review, merge, and deployment are separate steps.

Do not put backend credentials, production secrets, passwords, session
tokens, or private API-key values in source files or commits.
