# Stack

- TypeScript
- NestJS
- MikroORM
- PostgreSQL
- Angular

# Applications

apps/api
REST API read-only.

apps/batch
Daily data ingestion pipeline.

apps/web
Angular frontend.

# Architectural rules

- API must never consume TSE directly.
- External sources are accessed only by the batch application.
- Batch pipeline:
  Extract -> Parse -> Normalize -> Validate -> Persist -> Export -> Publish.
- Raw source data must not be modified.
- Public data must only come from successfully published datasets.
- Batch operations must be idempotent.
- API does not contain write endpoints.
- Do not implement authentication.
- Do not create User, Account or Session entities.
- Do not persist visitor political preferences or match answers.

# Data

Official sources must always remain traceable.

Normalized records should preserve their source identifiers.

# Development

- Add tests for business rules.
- Run relevant tests after changes.
- Do not introduce dependencies without justification.
- Follow existing patterns before creating new abstractions.