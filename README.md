# SEENRO Developer Portal

A static frontend for the early-access SEENRO Core API.

## Current capabilities

- Register and sign in through SEENRO Core.
- Create, list, and delete developer projects.
- Create, list, and revoke project-bound API keys.
- Select supported key scopes.
- Copy a newly created API-key secret when it is shown.

## Getting started

1. Open the Developer API card on the portal.
2. Register an account, then sign in.
3. Create a project, or select an existing project.
4. Generate a key for that project with only the permissions required.
5. Copy and securely store the secret when it is displayed.

An existing signed-in session should open the workspace rather than require
registration again.

## API base URL

`https://api.seenrotech.com/api/v1`

## Account and developer endpoints

- `POST /register`
- `POST /login`
- `POST /logout`
- `GET /me`
- `GET /developer/projects`
- `POST /developer/projects`
- `DELETE /developer/projects/{project_id}`
- `GET /keys`
- `POST /keys`
- `DELETE /keys/{key_id}`

## Project data-record endpoints

- `POST /projects/{project_id}/collections/{collection}/records`
- `GET /projects/{project_id}/collections/{collection}/records`
- `GET /projects/{project_id}/collections/{collection}/records/{record_id}`
- `PUT /projects/{project_id}/collections/{collection}/records/{record_id}`
- `DELETE /projects/{project_id}/collections/{collection}/records/{record_id}`

## Supported API-key scopes

- `projects:read` (default selected scope)
- `projects:write`
- `data:read`
- `data:write`

Keys must be bound to a project owned by the authenticated user. The backend,
not the frontend, enforces project ownership and scope permissions.

## Security notes

- Never commit API keys, passwords, or session tokens.
- A newly generated API-key secret is shown only at creation; store it securely.
- Grant only the scopes an application needs.
- Do not assume deleting a project securely erases its associated records.
- This is early access. Verify live API behavior before relying on it for
  important workloads.

## Deployment

Deploy this repository as a separate static Vercel project for
`developers.seenrotech.com`. The API is hosted separately at
`api.seenrotech.com`.

Do not put backend secrets in this repository.
