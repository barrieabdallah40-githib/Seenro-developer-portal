# SEENRO Developer Portal

Static developer portal for the early-access SEENRO Core API.

- Portal: https://developers.seenrotech.com
- API base URL: https://api.seenrotech.com/api/v1
- Backend: SEENRO Core
- Public documentation: `docs.html`

## Current portal capabilities

- Developer registration, login, session management, and logout.
- Email verification and password recovery flows integrated with Core.
- Creating and listing developer projects.
- Creating, listing, and revoking project-bound developer API keys.
- Selecting supported project, data, and auth permission scopes.
- One-time display of newly generated developer API-key secrets.
- Public documentation for the Developer API and initial storage API.

Email verification and password recovery require the matching Core backend
feature and a correctly configured email provider. Frontend integration does
not prove production email delivery is active.

## Confirmed route surface

Account and developer management:
- `POST /register`
- `POST /login`
- `POST /logout`
- `GET /me`
- `POST /verify-email`
- `POST /resend-verification`
- `POST /forgot-password`
- `POST /reset-password`
- `GET /developer/projects`
- `POST /developer/projects`
- `GET /keys`
- `POST /keys`
- `DELETE /keys/{key_id}`

Project data:
- `POST /projects/{project_id}/collections/{collection}/records`
- `GET /projects/{project_id}/collections/{collection}/records`
- `GET /projects/{project_id}/collections/{collection}/records/{record_id}`
- `PUT /projects/{project_id}/collections/{collection}/records/{record_id}`
- `DELETE /projects/{project_id}/collections/{collection}/records/{record_id}`

Initial project storage:
- `POST /projects/{project_id}/storage/subscriptions/checkout`
- `GET /projects/{project_id}/storage/keys`
- `POST /projects/{project_id}/storage/keys`
- `DELETE /projects/{project_id}/storage/keys/{key_id}`
- `POST /projects/{project_id}/storage/objects`
- `GET /projects/{project_id}/storage/objects`
- `GET /projects/{project_id}/storage/objects/{object_id}`
- `DELETE /projects/{project_id}/storage/objects/{object_id}`
- `GET /projects/{project_id}/storage/usage`

Storage allocation and upload limits:
- Free allocation: 100 MiB per developer account, shared across its projects.
- Purchased capacity: allocated to the individual project.
- Monthly subscription capacity: allocated to the individual project.
- Non-video files: maximum 100 MiB per file.
- MP4 videos: maximum 250 MB per file and 5 minutes duration.
- Original uploaded bytes are preserved without forced compression.

Core validates uploads and independently verifies payment before granting paid capacity. A browser redirect is not proof of payment.

## Monthly storage packages

Prices in SLE:
| Package | Capacity | Monthly price |
|---|---:|---:|
| Starter | 5 GB | SLE 25 |
| Basic | 20 GB | SLE 100 |
| Growth | 50 GB | SLE 250 |
| Business | 100 GB | SLE 500 |
| Enterprise | Custom | Contact SEENRO |

Checkout creation does not grant capacity. Core must independently verify
payment settlement before storage capacity is activated.

## Security

- Developer API-key secrets are displayed only once and stored as hashes.
- Keep developer API-key secrets private and use them only on trusted servers.
- Never embed secret keys in browser JavaScript, public repositories, or mobile
  application code.
- Revoke exposed keys and grant only required permissions.
- Developer sessions, project API keys, and storage keys are distinct
  credential mechanisms. Do not assume developer key scopes authorize storage.

## Availability and roadmap

The deployed Core service, binary, and database initialization were verified.
That is not proof of successful live email delivery, Monime settlement, object
upload/download, or subscription renewal. The docs label these as provider-
dependent or requiring end-to-end verification.

Businesses API, AI API, and Automation API remain planned. PostgreSQL-backed
project isolation, row-level security, mature backups, usage metering, and
expanded subscription operations are longer-term goals. The deployed
foundation currently uses SQLite; PostgreSQL/RLS is not represented as live.

## Deployment

This static frontend is maintained separately for `developers.seenrotech.com`.
The Core API is hosted separately at `api.seenrotech.com`. Review, merge, and
deployment are separate steps. Never commit backend credentials, production
secrets, passwords, session tokens, or private API-key values.
