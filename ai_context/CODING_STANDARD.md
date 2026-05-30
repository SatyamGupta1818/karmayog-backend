# Implementation Workflow Rules

# Before Writing Any Code

Before implementing any feature, always provide:

* Feature overview
* Business requirement understanding
* Database impact
* API design
* Module impact
* Architecture approach
* Folder/file structure
* Required DTOs
* Required entities
* Required services
* Required guards/interceptors
* Validation strategy
* Error handling strategy
* Redis/cache impact
* Security considerations
* Scalability considerations

---

# Implementation Plan Format

Before implementation, always generate:

```md id="ehj38j"
# Feature Implementation Plan

## Objective
Explain what needs to be built.

## Business Logic
Explain the feature flow.

## Database Changes
- New tables
- Entity changes
- Relations
- Indexes

## API Endpoints
- Method
- Route
- Payload
- Response

## Backend Flow
Controller → Service → Repository → Database

## Required Files
List all files/modules to create/update.

## Security
Explain auth/permission requirements.

## Validation Rules
List DTO validations.

## Error Handling
List possible exceptions/errors.

## Scalability Notes
Mention future scalability considerations.
```

---

# Approval Before Implementation

After generating the implementation plan:

DO NOT directly start coding.

Always ask for approval using:

```txt id="yo0m42"
Type:
"Proceed with implementation"

to start development.
```

---

# Swagger Rules

Every API must include:

* Swagger decorators
* API descriptions
* Request examples
* Response examples
* Auth documentation
* Tags
* Error responses

Use:

* ApiTags
* ApiOperation
* ApiResponse
* ApiBearerAuth
* ApiProperty

Swagger documentation is mandatory for all APIs.

---

# Design Pattern Rules

Use proper design patterns where applicable.

Common patterns:

* Repository Pattern
* Service Pattern
* Dependency Injection
* Factory Pattern
* Strategy Pattern
* Guard Pattern
* Modular Architecture

Avoid:

* tightly coupled code
* business logic inside controllers
* duplicated logic

---

# Backend Flow Standard

Every feature should follow:

```txt id="j71k9i"
Controller
   ↓
Service
   ↓
Repository
   ↓
Database
```

Optional layers:

* Guards
* Interceptors
* Validators
* Cache layer
* Queue layer

---

# AI Development Rules

Before generating code:

* Analyze existing architecture
* Reuse existing patterns
* Follow module structure
* Follow naming conventions
* Follow centralized architecture

Never:

* generate random structure
* break existing architecture
* duplicate services/utilities

---

# Development Commands

Before implementation:

* Generate implementation plan
* Wait for approval

Approval command:

```txt id="4x0ep6"
Proceed with implementation
```

For modifications:

```txt id="vf33gn"
Proceed with refactor
```

For API generation:

```txt id="5l4v7u"
Proceed with API implementation
```

For database changes:

```txt id="cxol37"
Proceed with migration changes
```

---

# Engineering Goal

Development should always prioritize:

* scalability
* maintainability
* clean architecture
* centralized systems
* reusable code
* production-grade practices

---
