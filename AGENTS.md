# Kundesk — Codex Instructions

## Project Context

Kundesk is an existing production-oriented full-stack SaaS application.

It includes areas such as:

- Next.js / React frontend
- TypeScript
- Node.js backend/server
- PostgreSQL
- Authentication and authorization
- Multi-tenant architecture
- AI / RAG
- OpenAI integrations
- Redis
- Realtime functionality
- Payments
- Payment webhooks
- Background jobs / cron jobs
- External service integrations

This is an existing project. Do not treat it as a greenfield application.

---

## Source of Truth

There are multiple sources of information about Kundesk:

1. `docs/project-bible*`
   - Defines the intended product, architecture, business rules, decisions, and important concepts.

2. `docs/phase-handoff*`
   - Defines the current project phase, current state, completed work, remaining work, and handoff information.

3. Other files under `docs/`
   - May contain additional project decisions, specifications, workflows, or historical context.

4. The actual source code
   - Represents what is currently implemented.

When documentation and implementation disagree:

- Do NOT silently change either one.
- Identify the discrepancy.
- Explain which behavior is documented and which behavior is implemented.
- Ask for or recommend a decision when necessary.

Do not assume that documentation is automatically correct.
Do not assume that the implementation is automatically correct.

---

## Before Making Changes

Before modifying code:

1. Read the relevant project documentation.
2. Inspect the existing implementation.
3. Understand how the relevant pieces connect.
4. Identify existing patterns and conventions.
5. Check related database models, APIs, services, components, and tests.
6. Understand possible side effects.
7. Explain the proposed approach before substantial changes.

Do not immediately start rewriting code based only on the user's description.

---

## Implementation Principles

Prefer:

- Small, focused changes
- Existing architecture and patterns
- Existing utilities and abstractions
- Existing dependencies
- Minimal file changes
- Explicit and maintainable TypeScript
- Clear separation of responsibilities
- Production-safe behavior

Avoid:

- Unnecessary rewrites
- Introducing unnecessary dependencies
- Creating duplicate abstractions
- Changing unrelated code
- Refactoring everything just because something could be "cleaner"
- Changing architecture without a clear reason

---

## Security

Treat these areas as security-critical:

### Authentication

Understand the existing authentication system before changing it.

### Authorization

Never assume authentication means authorization.

Verify permissions and roles where required.

### Multi-tenancy

Tenant isolation is critical.

Never allow one business/tenant to access another tenant's data.

When modifying queries, APIs, services, or database access:

- Verify tenant scoping.
- Check authorization.
- Consider IDOR/security issues.
- Consider indirect access through related entities.

### Secrets

Never expose:

- API keys
- Access tokens
- Database credentials
- Webhook secrets
- Environment variables containing secrets

Never hardcode secrets.

---

## Payments

Payment-related code is security-critical.

When working with payments:

- Verify payment status server-side.
- Never trust client-provided payment state.
- Verify amounts where applicable.
- Verify webhook signatures.
- Consider duplicate webhook events.
- Consider retries.
- Consider idempotency.
- Consider concurrent requests.
- Consider race conditions.
- Preserve existing payment lifecycle rules.
- Do not mark transactions successful based only on frontend behavior.

---

## Database

Treat the database as a source of truth.

Before changing database behavior:

- Inspect the existing schema.
- Understand relationships.
- Check constraints and indexes.
- Consider existing production data.
- Consider migrations.
- Consider nullability and defaults.
- Consider concurrent writes.
- Consider transactions where atomicity matters.

Do not make destructive schema changes casually.

---

## Reliability

Always consider:

- Retries
- Duplicate requests
- Duplicate events
- Idempotency
- Race conditions
- Concurrent writes
- Partial failures
- Timeouts
- Network failures
- External service failures
- Background job failures
- Webhook retries
- Transaction boundaries

A solution that works only in the happy path is not automatically production-ready.

---

## AI / RAG

When modifying AI or RAG functionality:

- Understand the existing ingestion pipeline.
- Understand document processing.
- Understand chunking.
- Understand embeddings.
- Understand vector search.
- Understand retrieval.
- Understand prompt construction.
- Understand tenant isolation.
- Consider token usage and cost.
- Consider failure and retry behavior.
- Do not casually replace the existing AI architecture.

---

## Testing and Verification

After implementation, run the relevant:

- Tests
- Type checks
- Lint
- Build
- Other project-specific validation

Use the project's existing scripts and conventions.

Never claim that something works unless it was actually verified.

If verification cannot be performed, explicitly say so.

---

## Git

Before changes:

- Inspect `git status`.
- Be aware of existing uncommitted work.
- Do not overwrite or discard unrelated user changes.

After changes:

- Review the diff.
- Confirm only intended files changed.
- Do not commit unless explicitly asked.

---

## Communication

When investigating:

Explain:

- What you found
- Where you found it
- How the pieces connect
- What appears correct
- What appears suspicious
- What differs from documentation
- What risks exist

When implementing:

Explain:

1. What will change
2. Why it needs to change
3. Which files are affected
4. Important tradeoffs

Keep explanations practical and tied to the actual Kundesk codebase.

---

## Golden Rule

Understand first.

Then plan.

Then implement.

Then verify.

Do not modify code merely because a modification is possible.