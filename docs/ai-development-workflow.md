# Kundesk — AI Development Workflow

## Purpose

This document defines how AI coding agents should work on Kundesk.

The goal is not simply to generate code.

The goal is to safely understand, modify, and improve an existing production-oriented system without losing architectural context or introducing hidden reliability and security problems.

---

# 1. Core Workflow

Every substantial task follows this sequence:

    USER
      ↓
    Explain the problem / goal
      ↓
    AI
    Read relevant documentation
      ↓
    AI
    Inspect existing implementation
      ↓
    AI
    Understand dependencies and data flow
      ↓
    AI
    Explain findings
      ↓
    USER
    Review / clarify
      ↓
    AI
    Propose implementation plan
      ↓
    USER
    Approve / adjust
      ↓
    AI
    Implement
      ↓
    AI
    Run verification
      ↓
    AI
    Review diff
      ↓
    USER
    Final review

Do not skip investigation for non-trivial changes.

---

# 2. Phase 0 — Understand the Project

Before beginning substantial work, AI should understand:

- What Kundesk is
- Current project phase
- Current project state
- Existing architecture
- Existing conventions
- Important business rules
- Known unfinished work
- Known technical debt
- Known risks

Read:

- `AGENTS.md`
- `docs/project-bible*`
- `docs/phase-handoff*`
- Relevant documentation under `docs/`

Then inspect the codebase.

---

# 3. Documentation First

The project documentation provides important context that may not be obvious from the source code.

At minimum, understand the following.

## Project Bible

Determine:

- Product purpose
- Users
- Business concepts
- Architecture
- Important decisions
- Domain rules
- Intended behavior

## Phase Handoff

Determine:

- Current phase
- What has been completed
- What is currently being worked on
- What remains
- Known problems
- Important next steps
- Previous decisions

## Other Documentation

Look for:

- Architecture decisions
- Technical specifications
- Feature documentation
- Security notes
- Database decisions
- AI/RAG documentation
- Deployment information
- Testing strategy

Do not assume every document is current.

---

# 4. Documentation vs Code

Always distinguish between:

### Intended System

What the project documentation says Kundesk should do.

### Actual System

What the current implementation actually does.

If they differ:

    DOCUMENTATION
         ↓
    Expected behavior

    CODE
         ↓
    Actual behavior

         ↓
       Compare

         ↓

    Identify discrepancy

Do not silently "fix" the discrepancy.

First explain it.

If the discrepancy requires a decision, ask the user before making a potentially consequential change.

---

# 5. Initial Codebase Analysis

When starting a new Kundesk session, inspect the following.

## Repository

Understand:

- Directory structure
- Workspaces
- Package manager
- `package.json`
- Configuration files
- Environment variable usage
- Git status
- Existing scripts

## Frontend

Understand:

- Application structure
- Routes
- Components
- State management
- Data fetching
- Authentication
- Authorization
- Forms
- Error handling
- Loading states

## Backend

Understand:

- API structure
- Routes/controllers
- Services
- Database access
- Validation
- Error handling
- Authentication
- Authorization
- Business logic

## Database

Understand:

- Schema
- Relationships
- Constraints
- Indexes
- Migrations
- Tenant boundaries
- Transactions
- Important data integrity rules

## Authentication

Understand:

- Login flow
- Session/token strategy
- User identity
- Organization/business identity
- Role handling
- Authorization checks
- Protected routes
- Protected API operations

## Multi-tenancy

Trace the complete flow:

    Request
      ↓
    Authenticated User
      ↓
    Business / Tenant
      ↓
    Authorization
      ↓
    Database Query
      ↓
    Tenant-scoped Data

Verify that tenant isolation is enforced consistently.

Pay particular attention to:

- API routes
- Server actions
- Services
- Database queries
- Related entities
- Background jobs
- AI/RAG operations
- Realtime events

## Payments

Trace:

    Client
      ↓
    Backend
      ↓
    Payment Provider
      ↓
    Webhook
      ↓
    Verification
      ↓
    Database
      ↓
    Business State

Pay special attention to:

- Signature verification
- Amount verification
- Payment status
- Idempotency
- Duplicate events
- Retries
- Race conditions
- Concurrent updates
- Invalid client state

## AI / RAG

Trace:

    Document
      ↓
    Processing
      ↓
    Chunking
      ↓
    Embedding
      ↓
    Vector Storage
      ↓
    Retrieval
      ↓
    Prompt
      ↓
    LLM
      ↓
    Response

Understand tenant isolation throughout the entire pipeline.

Also understand:

- Document ingestion
- Chunking strategy
- Embedding model
- Vector database
- Similarity search
- Retrieval filtering
- Prompt construction
- Streaming
- Error handling
- Retry behavior
- Token usage
- Cost considerations

## Background Jobs

Understand:

- Cron jobs
- Queues
- Scheduling
- Retries
- Failure handling
- Idempotency
- Long-running tasks
- External API calls

## Redis / Caching

Understand:

- What is cached
- Cache keys
- TTLs
- Invalidation
- Tenant boundaries
- Failure behavior
- Whether Redis is used for locks, queues, sessions, or other coordination

## Realtime

Understand:

- Event source
- Server-side publishing
- Client subscription
- Authentication/authorization
- Tenant isolation
- Event payloads
- Failure behavior

---

# 6. Investigation Mode

When the user asks:

> "Why is this happening?"

Do NOT immediately modify code.

Instead:

1. Reproduce or trace the behavior.
2. Find the relevant implementation.
3. Follow the data flow.
4. Identify the root cause.
5. Explain the root cause.
6. Identify possible fixes.
7. Recommend the safest fix.

A useful investigation report should roughly follow:

    ## What I found

    ...

    ## Root cause

    ...

    ## Why it happens

    ...

    ## Recommended fix

    ...

    ## Risks / side effects

    ...

No code changes until implementation is requested or approved.

---

# 7. Implementation Mode

Once implementation is approved:

1. Re-check the relevant files.
2. Make the smallest reasonable change.
3. Follow existing conventions.
4. Avoid unrelated refactors.
5. Preserve existing behavior outside the task.
6. Consider edge cases.
7. Verify the change.

Do not expand a focused task into an unrelated architectural rewrite.

---

# 8. Reliability Checklist

For backend, database, payment, webhook, job, or data-related changes, consider the following.

## Idempotency

What happens if the same request or event happens twice?

## Retry

What happens if the operation is retried?

## Concurrency

What happens if two requests happen simultaneously?

## Race Conditions

Can two operations observe or modify the same state incorrectly?

## Partial Failure

What happens if step 2 succeeds but step 3 fails?

## Transaction

Should multiple database operations be atomic?

## External Services

What happens if an external API:

- Times out
- Returns an error
- Returns malformed data
- Is temporarily unavailable
- Processes the request but the response is lost

## Webhooks

What happens if the provider sends:

- The same webhook twice
- Webhooks out of order
- A webhook after a timeout
- A webhook after the user has already triggered another state transition

## Data Integrity

Can invalid or inconsistent state be created?

---

# 9. Security Checklist

For security-sensitive changes, verify:

- Authentication
- Authorization
- Tenant isolation
- Input validation
- Server-side validation
- Secret handling
- IDOR protection
- Database access boundaries
- Webhook verification
- Payment verification
- Error information leakage

Never trust client-side claims for security-sensitive state.

Do not blindly trust:

- Client-side authorization
- Client-provided tenant IDs
- Client-provided payment status
- Client-provided prices
- Client-provided privileged fields

These must be independently verified server-side where applicable.

---

# 10. Database Change Checklist

Before changing database behavior:

1. Inspect the existing schema.
2. Understand affected relationships.
3. Check constraints.
4. Check indexes.
5. Check existing migrations.
6. Consider existing data.
7. Consider nullable vs required fields.
8. Consider defaults.
9. Consider concurrent writes.
10. Consider transaction boundaries.
11. Consider migration safety.

Do not make destructive schema changes casually.

Never assume a migration is safe simply because the new schema compiles.

---

# 11. AI / RAG Change Checklist

Before changing AI functionality, understand the existing pipeline.

Consider:

- Tenant isolation
- Document ownership
- Document processing
- Chunking
- Embeddings
- Vector search
- Retrieval filters
- Prompt construction
- Model selection
- Streaming
- Token usage
- Cost
- Rate limits
- Retry behavior
- Failure handling
- Hallucination risks

Do not replace an existing AI architecture simply because another approach is newer or more fashionable.

---

# 12. Payment / Webhook Change Checklist

Payment-related code is security-critical.

Before changing it, understand:

    User Action
        ↓
    Application
        ↓
    Payment Provider
        ↓
    Payment Result
        ↓
    Webhook
        ↓
    Signature Verification
        ↓
    Business Validation
        ↓
    Database Update

Verify:

- Webhook signature
- Transaction/order identity
- Payment amount
- Payment status
- Tenant/business ownership
- Idempotency
- Duplicate webhook handling
- Retry handling
- Concurrent requests
- Final database state

Never mark a payment successful solely because the frontend says payment succeeded.

---

# 13. Testing and Verification

After implementation, run the relevant:

- Tests
- Type checks
- Lint
- Build
- Integration tests
- Other project-specific validation

Use the project's existing scripts and conventions.

Do not invent commands if the repository already defines the appropriate scripts.

Never claim that something works unless it was actually verified.

If verification cannot be performed, explicitly state:

- What could not be verified
- Why it could not be verified
- What was verified instead

---

# 14. Diff Review

Before considering work complete, inspect the final diff.

Check:

- Which files changed?
- Are all changes related to the task?
- Did any unrelated behavior change?
- Were dependencies added unnecessarily?
- Were migrations created correctly?
- Were security boundaries preserved?
- Were tenant boundaries preserved?
- Were error cases handled?
- Were tests added or updated where appropriate?
- Were configuration files changed unexpectedly?
- Were generated files modified unnecessarily?

Do not commit unless explicitly asked.

---

# 15. Git Safety

Before making changes:

    git status

Understand the current working tree.

There may already be uncommitted user work.

Never:

- Reset unrelated changes
- Delete user work
- Checkout over unrelated changes
- Force-reset the repository
- Rewrite history

unless explicitly instructed.

After implementation:

    git diff

Review what actually changed.

---

# 16. Do Not Over-Engineer

Kundesk should become better, not unnecessarily more complicated.

Prefer:

    Simple
    +
    Correct
    +
    Maintainable
    +
    Production-safe

over:

    Complex
    +
    Clever
    +
    Unnecessary

Do not introduce:

- New frameworks without a reason
- New dependencies without a reason
- New abstractions without a reason
- Large refactors for small problems
- Duplicate utilities
- Duplicate business logic

Use existing project patterns when they are appropriate.

---

# 17. Handling Ambiguous Requirements

Do not invent important business rules.

If ambiguity affects:

- Data integrity
- Security
- Payments
- Authorization
- Tenant isolation
- Business logic
- User-visible behavior
- Existing architecture

Explain the ambiguity and ask for a decision.

For low-risk implementation details, follow existing project conventions.

---

# 18. Handling Documentation Conflicts

If the project documentation says one thing and the code does another, report it explicitly.

Use a format such as:

    ## Documentation

    The project documentation says:
    ...

    ## Implementation

    The current code does:
    ...

    ## Difference

    ...

    ## Impact

    ...

    ## Recommendation

    ...

Do not automatically rewrite documentation to match the code.

Do not automatically rewrite code to match documentation.

The user should understand the discrepancy before a consequential decision is made.

---

# 19. Communication Style

Be direct and practical.

Do not bury the important finding.

Prefer:

> "The bug is here because X happens before Y."

over:

> "There are several interesting aspects of the implementation..."

When explaining technical concepts:

- Use concrete examples.
- Explain the actual code path.
- Mention the relevant files.
- Explain why the behavior matters.
- Distinguish facts from assumptions.

The goal is for the user to understand the reasoning, not just receive code.

---

# 20. Substantial Change Protocol

For substantial changes, follow this protocol.

## Before implementation

Explain:

1. What is currently happening
2. Why it happens
3. What needs to change
4. Proposed approach
5. Files likely to change
6. Important edge cases
7. Security/reliability implications

Then wait for approval when the change is consequential.

## During implementation

- Keep the change focused.
- Follow existing architecture.
- Avoid unrelated refactors.
- Preserve unrelated behavior.

## After implementation

Report:

1. What changed
2. Why
3. Files changed
4. Tests/checks run
5. Results
6. Remaining concerns

---

# 21. Small Change Protocol

For a small, obvious change, the process can be lighter.

Examples:

- Typo fix
- Small UI text change
- Simple localized styling adjustment
- Clearly scoped bug fix

Still:

- Inspect the relevant code.
- Make the smallest change.
- Verify it.
- Review the diff.

Do not apply unnecessary ceremony to trivial changes.

---

# 22. Completion Standard

A task is not complete merely because code was written.

A task is complete when:

1. The intended behavior is understood.
2. The implementation is correct.
3. Relevant edge cases are considered.
4. Security boundaries are preserved.
5. Tenant isolation is preserved.
6. Data integrity is preserved.
7. Relevant verification has passed.
8. The final diff is understood.
9. Any remaining limitations are clearly reported.

---

# 23. Golden Rule

    READ FIRST
        ↓
    UNDERSTAND
        ↓
    PLAN
        ↓
    CHANGE
        ↓
    VERIFY
        ↓
    REVIEW

Never reverse this order for substantial work.
