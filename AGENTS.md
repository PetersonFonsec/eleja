# AGENTS.md

## 1. Project Context

This repository contains a Brazilian electoral information and
transparency platform.

The product transforms public and official electoral data into
normalized, traceable, easy-to-consume information.

The initial focus is the 2026 Brazilian general election, but the
architecture must support future elections and post-election
transparency features.

Before implementing any task, read the relevant documentation in
`/docs`:

-   `docs/PRODUCT.md`
-   `docs/ARCHITECTURE.md`
-   `docs/DATA_MODEL.md`
-   `docs/DATA_PIPELINE.md`
-   `docs/ROADMAP.md`

Documentation is part of the architecture. Do not silently contradict
documented decisions.

------------------------------------------------------------------------

## 2. Core Stack

### API

-   TypeScript
-   NestJS
-   MikroORM
-   PostgreSQL
-   REST

### Batch

-   TypeScript
-   NestJS or compatible Node application
-   MikroORM
-   PostgreSQL

### Web

-   Angular
-   TypeScript

### Storage

-   Cloudflare R2 for raw source files and public datasets.

### Initial Batch Execution

-   Daily execution.
-   GitHub Actions is the preferred initial scheduler/executor.
-   The batch implementation must remain portable to Lambda, serverless
    containers, traditional cron, or another executor.

------------------------------------------------------------------------

## 3. Repository Boundaries

The expected high-level structure is:

``` text
/
├── AGENTS.md
├── docs/
├── apps/
│   ├── api/
│   ├── batch/
│   └── web/
└── packages/
    ├── database/
    ├── domain/
    └── shared/
```

Respect existing repository structure if it differs slightly.

Do not reorganize large portions of the repository unless explicitly
requested.

### `apps/api`

Public read-only REST API.

### `apps/batch`

Daily ingestion and dataset publication process.

### `apps/web`

Angular application.

### `packages/database`

Database infrastructure, MikroORM configuration, migrations, and shared
persistence concerns when appropriate.

### `packages/domain`

Domain concepts and business rules that genuinely need to be shared.

### `packages/shared`

Small technical utilities or contracts shared between applications.

Do not turn `shared` into a dumping ground.

------------------------------------------------------------------------

# 4. Fundamental Architectural Rules

## AR-001 --- API Must Never Access Electoral Sources

The REST API must never call TSE or other external electoral sources to
satisfy an HTTP request.

Correct:

``` text
HTTP Request
    ↓
REST API
    ↓
PostgreSQL
```

Incorrect:

``` text
HTTP Request
    ↓
REST API
    ↓
TSE
```

External data ingestion belongs exclusively to the batch pipeline.

------------------------------------------------------------------------

## AR-002 --- Batch Owns External Data Ingestion

The batch application is responsible for:

``` text
Extract
  ↓
Raw Storage
  ↓
Parse
  ↓
Normalize
  ↓
Validate
  ↓
Persist
  ↓
Export
  ↓
Publish
```

Do not mix these responsibilities into controllers or API services.

------------------------------------------------------------------------

## AR-003 --- No Real-Time Requirement

The initial requirement is one batch execution per day.

Do not introduce:

-   polling;
-   streaming;
-   Kafka;
-   RabbitMQ;
-   event streaming platforms;
-   CDC;
-   frequent scheduled synchronization;

unless explicitly requested.

------------------------------------------------------------------------

## AR-004 --- Last Valid Dataset Must Remain Available

Never remove or invalidate the currently published dataset before the
replacement dataset has successfully completed processing and
validation.

Expected behavior:

``` text
Dataset A
PUBLISHED

Dataset B
PROCESSING

→ API continues serving Dataset A.

Dataset B
FAILED

→ API continues serving Dataset A.
```

Only successfully validated datasets may become published.

------------------------------------------------------------------------

## AR-005 --- Batch Must Be Idempotent

Reprocessing the same source dataset must not create duplicate domain
records.

Prefer:

-   stable source identifiers;
-   database unique constraints;
-   deterministic transformations;
-   upsert/update strategies where appropriate.

Do not rely exclusively on application checks when a database constraint
can enforce the invariant.

------------------------------------------------------------------------

## AR-006 --- Preserve Traceability

Normalized information must retain enough metadata to determine its
origin.

Whenever applicable preserve:

-   source;
-   source identifier;
-   source URL;
-   original value;
-   import timestamp;
-   dataset version.

A public claim should eventually be traceable back to an official
source.

------------------------------------------------------------------------

## AR-007 --- No Authentication

Authentication is explicitly outside the current scope.

Do not create:

``` text
User
Account
Session
Login
Password
RefreshToken
AccessToken
```

Do not install authentication libraries unless explicitly requested.

------------------------------------------------------------------------

## AR-008 --- Do Not Persist Visitor Political Preferences

The system must not persist an individual visitor's political
preferences.

Do not create:

``` text
UserPoliticalProfile
UserAnswer
PoliticalPreference
FavoriteCandidate
UserSearchHistory
```

Future electoral match answers should remain client-side or exist only
transiently during calculation.

------------------------------------------------------------------------

## AR-009 --- Prefer Minimal Infrastructure

This project prioritizes low operational cost and simplicity.

Do not introduce infrastructure because it may theoretically be useful
later.

Avoid premature:

-   microservices;
-   queues;
-   distributed caches;
-   event buses;
-   Kubernetes;
-   Elasticsearch;
-   complex orchestration.

Introduce infrastructure only when a current requirement justifies it.

------------------------------------------------------------------------

## AR-010 --- Batch Must Be Compute-Provider Agnostic

Business logic must not be implemented directly inside a Lambda handler,
GitHub Action, or another provider-specific entry point.

Preferred:

``` ts
await electionImportJob.execute();
```

Then adapters may invoke it from:

``` text
CLI
GitHub Actions
Lambda
Serverless container
Cron
```

Provider-specific code must remain at the boundary.

------------------------------------------------------------------------

# 5. Data Modeling Rules

## Person and Candidacy Are Different Concepts

A person may participate in multiple elections.

Always model:

``` text
Person
   ↓
Candidacy
   ↓
Election
```

Do not collapse `Person` and `Candidacy` into a single entity.

A candidacy may change across elections:

-   party;
-   office;
-   ballot number;
-   electoral state/city;
-   status.

The person remains the same domain concept.

------------------------------------------------------------------------

## Canonical Model Must Not Mirror TSE Schemas

Do not expose source column naming throughout the domain.

Example source:

``` text
NM_CANDIDATO
SG_PARTIDO
DS_CARGO
```

must be translated into canonical domain concepts.

Source-specific names should remain confined to extraction/parsing
layers.

------------------------------------------------------------------------

## Preserve Original Values When Normalization Loses Information

Example:

``` text
sourceCategory:
"Publicidade por materiais impressos"

normalizedCategory:
ADVERTISING
```

If normalization reduces detail, preserve the source representation when
useful for auditability.

------------------------------------------------------------------------

## Money

Use PostgreSQL decimal/numeric-compatible types for monetary values.

Do not use floating-point arithmetic for campaign money or declared
asset values.

------------------------------------------------------------------------

## Database Constraints

Use database constraints to protect important invariants.

Examples:

-   unique source identifiers;
-   required foreign keys;
-   unique canonical codes;
-   appropriate indexes.

Do not depend only on TypeScript validation for persistent invariants.

------------------------------------------------------------------------

# 6. MikroORM Rules

MikroORM is the selected ORM.

Do not introduce Prisma, TypeORM, Sequelize, Drizzle, or another ORM.

Follow established MikroORM patterns already present in the repository.

Prefer explicit entities and relationships.

Keep persistence concerns separate from controllers.

Migrations must be versioned.

Do not use schema auto-update behavior in production as a replacement
for migrations.

Avoid leaking MikroORM implementation details throughout unrelated
domain code.

------------------------------------------------------------------------

# 7. Batch Pipeline Rules

Keep pipeline stages independently understandable and testable.

Avoid:

``` ts
async function runEverything() {
  // download
  // unzip
  // parse
  // normalize
  // validate
  // persist
  // generate csv
  // upload
}
```

Prefer explicit stages/components:

``` text
Extractor
Parser
Normalizer
Validator
Repository/Persistence
Exporter
Publisher
```

Do not create abstractions merely to satisfy this naming scheme. Each
abstraction must have a real responsibility.

------------------------------------------------------------------------

## Extract

Only obtain the source material.

Do not normalize domain values during extraction.

------------------------------------------------------------------------

## Raw Storage

Preserve original source files before transformation.

Initial storage target: Cloudflare R2.

Raw files must remain unchanged.

------------------------------------------------------------------------

## Parse

Translate physical source formats into source-oriented structures.

Parsing should understand:

-   CSV;
-   ZIP;
-   encoding;
-   source columns;
-   primitive values.

Parsing should not contain unrelated domain business rules.

------------------------------------------------------------------------

## Normalize

Translate source-oriented structures into canonical domain
representations.

Normalization must be deterministic whenever possible.

------------------------------------------------------------------------

## Validate

Validation occurs before publication.

Distinguish where useful between:

``` text
fatal error
rejected record
warning
```

Do not silently discard invalid records.

------------------------------------------------------------------------

## Persist

Persistence must be idempotent.

Use transactions when a group of changes must succeed atomically.

Avoid loading entire very large datasets into memory when
streaming/chunked processing is practical.

------------------------------------------------------------------------

## Export

Generate public normalized datasets.

Initial formats:

``` text
CSV
```

Potential files:

``` text
candidates.csv
assets.csv
contacts.csv
full-dataset.zip
```

Do not generate large public downloads dynamically through the REST API.

------------------------------------------------------------------------

## Publish

Publishing is the final pipeline stage.

Only fully processed and validated datasets can become `latest`.

------------------------------------------------------------------------

# 8. Dataset Versioning

Every public dataset release must be identifiable.

Initial version format may be based on the processing date:

``` text
2026-08-08
```

Expected lifecycle:

``` text
PROCESSING
    ↓
READY
    ↓
PUBLISHED
```

Failure:

``` text
PROCESSING
    ↓
FAILED
```

A failed version must never replace the current published version.

------------------------------------------------------------------------

# 9. REST API Rules

The API is primarily read-only.

Controllers should remain thin.

Controllers are responsible for:

-   HTTP mapping;
-   request validation;
-   query parameter handling;
-   delegation.

Business/query logic belongs outside controllers.

Prefer predictable REST resources.

Examples:

``` text
GET /dataset
GET /elections
GET /elections/:id
GET /candidates
GET /candidates/:id
GET /candidates/:id/assets
GET /candidates/:id/contacts
```

Support pagination for collections.

Avoid unbounded collection endpoints.

Use consistent error responses.

Do not expose database entities blindly if a public response contract is
more appropriate.

------------------------------------------------------------------------

# 10. CSV and Public Dataset Rules

Public files should be served directly from object storage/CDN.

Correct:

``` text
Browser
   ↓
Cloudflare R2
```

Avoid:

``` text
Browser
   ↓
NestJS
   ↓
download 500 MB
```

Prefer stable paths for the latest version:

``` text
datasets/2026/latest/candidates.csv
```

and immutable historical versions:

``` text
datasets/2026/2026-08-08/candidates.csv
```

------------------------------------------------------------------------

# 11. Testing Rules

Tests are required for meaningful business logic.

Prioritize tests for:

-   parsers;
-   normalizers;
-   validators;
-   idempotency;
-   dataset publication rules;
-   query/filter behavior;
-   critical domain rules.

Use small real-world fixtures when possible.

Example:

``` text
fixtures/
  tse/
    candidates-sample.csv
    assets-sample.csv
```

Tests must not require the live TSE website to be available.

Mock infrastructure boundaries, not the business rule being tested.

Avoid tests that merely reproduce implementation details.

------------------------------------------------------------------------

# 12. External Source Rules

Prefer official/public sources.

For electoral data, TSE is the primary source unless documentation
states otherwise.

Do not silently replace an official source with scraped third-party
information.

If another source is required, preserve provenance.

External API or file format assumptions should be isolated behind
source-specific components.

------------------------------------------------------------------------

# 13. Privacy and Safety

This project deals with political information.

Treat neutrality, provenance, and privacy as product requirements.

Never infer or persist an individual visitor's:

-   political ideology;
-   party preference;
-   voting intention;
-   candidate preference.

Do not implement political profiling.

Only candidate contact information intentionally published as a
public/professional contact should be stored.

------------------------------------------------------------------------

# 14. AI-Generated Content

Future features may use AI for proposal summarization and semantic
search.

AI output must never silently replace official data.

When AI-generated interpretation is persisted or displayed, preserve:

-   source document;
-   supporting excerpt where practical;
-   page/location where available;
-   explicit indication that the content was generated or interpreted by
    AI.

Never fabricate a candidate position when evidence is insufficient.

------------------------------------------------------------------------

# 15. Code Quality

Prefer simple, readable TypeScript.

Follow existing repository conventions before creating new ones.

Avoid:

-   speculative abstractions;
-   unnecessary generic frameworks;
-   oversized services;
-   hidden side effects;
-   duplicated business rules.

Use meaningful names.

Keep functions focused.

Use dependency injection where it provides a clear testing or
architectural benefit.

Do not create an interface for every class by default.

Do not create abstractions for hypothetical future providers unless a
current boundary already requires one.

------------------------------------------------------------------------

# 16. Dependency Rules

Do not add a dependency when the platform or an existing dependency
already solves the problem adequately.

Before adding a dependency:

1.  verify that it is necessary;
2.  check whether an equivalent already exists in the repository;
3.  prefer actively maintained libraries;
4.  consider bundle/runtime impact;
5.  explain non-obvious additions in the task summary.

Do not change major dependency versions unless the task requires it.

------------------------------------------------------------------------

# 17. Scope Control

Implement only the requested task.

Do not opportunistically implement future roadmap features.

Example:

If the task is:

``` text
Implement candidate CSV parser
```

do not also implement:

``` text
candidate REST API
R2 publication
proposal AI
authentication
frontend candidate page
```

Small supporting refactors are acceptable when necessary and clearly
related.

------------------------------------------------------------------------

# 18. Working With Existing Code

Before editing:

1.  inspect relevant files;
2.  inspect nearby patterns;
3.  inspect tests;
4.  inspect relevant documentation;
5.  understand current behavior.

Do not replace existing patterns simply because another style is
preferred.

If existing code conflicts with documented architecture, call it out
before making a broad architectural change.

------------------------------------------------------------------------

# 19. Definition of Done

Unless the task explicitly says otherwise, after implementation:

1.  run relevant automated tests;
2.  run lint;
3.  run TypeScript type checking if separate;
4.  run the relevant build;
5.  fix failures introduced by the changes;
6.  review the final diff;
7.  verify that the task stayed within scope.

Do not claim a command passed unless it was actually executed
successfully.

If a validation step cannot be executed, state why.

------------------------------------------------------------------------

# 20. Final Task Report

At the end of an implementation task, provide a concise report
containing:

``` text
Summary
- what was implemented

Files changed
- important files

Tests
- commands executed
- result

Architecture
- relevant decisions or tradeoffs

Not validated
- anything that could not be verified
```

Do not produce a long narrative when a concise engineering summary is
sufficient.

------------------------------------------------------------------------

# 21. Code Review Mode

When explicitly asked to review code, do not immediately modify files
unless the user also asked for fixes.

Review for:

1.  correctness;
2.  data integrity;
3.  architectural rule violations;
4.  privacy issues;
5.  idempotency;
6.  missing validation;
7.  error handling;
8.  performance problems;
9.  unnecessary complexity;
10. missing tests.

Prioritize findings by severity.

Reference concrete files and code locations.

Avoid cosmetic comments unless they materially improve maintainability.

------------------------------------------------------------------------

# 22. Performance Guidance

Do not prematurely optimize normal API queries.

However, data ingestion may involve large CSV files.

For batch processing:

-   avoid unnecessary full-file copies;
-   prefer streams/chunks when datasets are large;
-   batch database writes when appropriate;
-   avoid one SQL round-trip per row;
-   add indexes based on actual query requirements.

Measure before introducing complex optimization.

------------------------------------------------------------------------

# 23. Observability

The initial system needs lightweight observability.

Batch executions should record enough information to answer:

``` text
Did today's job run?
Did it succeed?
How many records were read?
How many were inserted?
How many were updated?
How many were rejected?
What failed?
How long did it take?
```

Do not introduce a large observability platform during the MVP unless
required.

------------------------------------------------------------------------

# 24. Cost Awareness

Low infrastructure cost is an explicit requirement.

When choosing between technically valid approaches, prefer the simpler
and cheaper solution unless it creates a significant reliability or
maintainability problem.

Current direction:

``` text
Batch execution:
GitHub Actions initially

Raw + CSV:
Cloudflare R2

Database:
PostgreSQL

API:
small read-only NestJS service
```

Avoid routing large file downloads through paid compute.

------------------------------------------------------------------------

# 25. Documentation Updates

Update documentation when a task intentionally changes:

-   architecture;
-   domain model;
-   pipeline;
-   product scope;
-   roadmap assumptions.

Do not update documentation for trivial implementation details.

If implementation requires contradicting an existing architectural
decision, do not silently change the code. Surface the conflict.

------------------------------------------------------------------------

# 26. Guiding Principle

When uncertain between a sophisticated solution and a simple solution
that satisfies the current requirements:

> Choose the simple solution.

The system should be easy for another engineer --- or another Codex
session --- to understand from the repository itself.
