---
meta:
  title: "How Allô Maude becomes commercially credible by June 26, 2026"
  contentType: Conceptual
  category: Product design
---

# How Allô Maude becomes commercially credible by June 26, 2026

This specification defines the application, operating flows, evidence, and engineering work required to deliver Allô Maude as a credible first commercial version on June 26, 2026. The guided demonstration proves the application through its real modules. It never replaces or bypasses them.

## Document plan

- **Goal**: define a usable commercial application for tomorrow and a measured path to paid pilots
- **Audience**: product owner, developer, reviewer, and future implementation agents
- **Scope**: customer-facing brand, daily operations, preparation, correction, persistence, integrated demonstration, readiness gates, and verification
- **Out of scope for tomorrow**: unsupported production claims, broad integration work, and guaranteed market adoption
- **Open external dependencies**: a working Twilio number, a public real-time WebSocket endpoint, an available PostgreSQL database, and production credentials
- **Open design questions**: none; this document makes the product and demonstration boundary explicit

## Product decision

Allô Maude is the commercial product. Customers see, configure, test, and buy Allô Maude.

Scaly is the technical voice engine. The name Scaly remains valid in:

- Internal TypeScript identifiers and package names
- Technical status and diagnostics
- Infrastructure logs and audit actors
- Developer documentation
- The real-time service name

Scaly must not appear as a competing customer brand in:

- Public pages
- Pricing
- Customer navigation
- Dashboard copy
- Call transcripts shown to customers
- Onboarding
- Billing product names
- Customer exports
- Customer-facing SMS messages

## The application is the product

Allô Maude must remain useful when no demonstration is running. A business owner can prepare the company, configure Maude, inspect calls, manage follow-ups, correct gaps, and check readiness through normal application routes.

The guided demonstration is a controlled operating mode inside Allô Maude. It uses:

- The same company and agent domain models
- The same repository interface
- The same simulation or voice runtime
- The same intelligence and action engines
- The same consent and review logic
- The same call detail, follow-up, and overview pages
- The same reality labels and audit records

The demonstration cannot introduce:

- A separate demo-only data model
- Hard-coded results that skip application services
- A duplicate dashboard
- An alternate action engine
- A success state that the normal application cannot produce
- A hidden reset that destroys non-demo business data

Simulated calls use `source: "simulator"` and remain inspectable in the normal call history. Demo cleanup can remove tagged simulation records, but it cannot alter live records.

## Commercial operating modes

Allô Maude supports three environment modes with different evidence requirements:

| Mode | Persistence | Voice source | Intended use |
| --- | --- | --- | --- |
| Local demonstration | Memory or PostgreSQL | Deterministic simulation | Sales demonstration and development |
| Commercial preview | PostgreSQL required | Simulation, Voice Lab, or configured fallback | Owner preparation and pre-pilot validation |
| Live pilot | PostgreSQL required and verified | Twilio plus Scaly real-time voice, with human fallback | Real customer calls |

The memory store is a local demonstration tool. It cannot support a commercial preview or live pilot readiness verdict.

## Evidence standard

Commercial readiness means **zero known critical defects**, not zero defects in an absolute sense.

A readiness claim needs direct evidence:

| Claim | Required evidence |
| --- | --- |
| Local demo works | Reproducible launch command and browser smoke test |
| Core behavior works | Passing unit and integration tests |
| Production build works | Passing `npm run build` |
| Guided flow works | A persisted call links to intelligence, actions, and audit |
| Telephony works | A recorded end-to-end call through Twilio and the real-time bridge |
| PostgreSQL works | A successful live write, read, and delete check |
| An integration is real | Configured provider plus successful external operation |
| A value number is credible | Visible calculation method and an estimate label |

The interface uses four customer-readable states:

- **Verified**: the behavior ran successfully in the current environment
- **Configured, not verified**: credentials exist, but no successful operation proves the behavior
- **Simulated**: deterministic test data exercises the real application flow
- **Unavailable**: a dependency or implementation is missing

## Competitive research boundaries

The revision uses three evidence grades:

- **Grade A**: government or regulatory sources
- **Grade B**: independent customer reviews with a visible sample size
- **Grade C**: forums, vendor testimonials, and vendor comparison pages

Grade C evidence identifies hypotheses. It does not prove product quality or market demand.

### Supported findings

The available evidence supports these product requirements:

- Callers need a concrete outcome: an answer, message, transfer, booking request, or follow-up
- Small businesses value after-hours and overflow coverage
- Spam filtering reduces interruptions
- Human transfer must remain available
- The receiving human needs call context
- Owners need to change business facts and call rules without support tickets
- Pricing, overages, trial terms, and cancellation rules need explicit language
- Robotic pacing, latency, inconsistent answers, and long setup damage trust
- Quebec customers must receive service and information in French
- Recorded calls need meaningful notice, purpose, and consent

Sources:

- [Smith.ai reviews on Trustpilot](https://www.trustpilot.com/review/smith.ai)
- [Frontdesk AI reviews on Trustpilot](https://www.trustpilot.com/review/www.myaifrontdesk.com)
- [Dialzara reviews on Trustpilot](https://www.trustpilot.com/review/dialzara.com)
- [Construction discussion about AI answering services](https://www.reddit.com/r/Construction/comments/1jq3z0n/anyone_actually_trust_these_ai_call_answering/)
- [Small-business discussion about voice bots](https://www.reddit.com/r/smallbusiness/comments/1mdlzni/using_an_ai_voice_bot_instead_of_an_answering/)
- [RingCentral AI Receptionist capabilities](https://www.ringcentral.com/ai-receptionist.html)
- [OQLF guidance on customer service in French](https://www.oqlf.gouv.qc.ca/francisation/droits_linguistiques/droits/langue-du-commerce-et-des-affaires.html)
- [Privacy Commissioner guidance on recording customer calls](https://www.priv.gc.ca/en/privacy-topics/surveillance/02_05_d_14/)

## Primary customer

The first customer is a Quebec service business with one owner or a small team. The owner works away from a desk, loses calls during jobs, and needs French-first service with English support.

The initial industry focus remains:

- Plumbing
- Heating, ventilation, and air conditioning
- Electrical work
- Roofing
- Renovation
- Property maintenance
- Other home services with urgent or high-value inbound calls

This focus fits the repository's existing scripts, urgency logic, rescue queue, transfer behavior, and estimated-value model.

## Product promise

Allô Maude answers when the team cannot, collects the information required for the next action, escalates urgent calls, and shows the owner what happened.

The product does not promise:

- A confirmed appointment when no real calendar integration exists
- A firm price or professional diagnosis
- Full resolution of complex or sensitive questions
- A human identity
- Production telephony without an end-to-end call test
- Guaranteed revenue or market adoption

## Customer-facing information architecture

The application exposes nine connected operational surfaces. Each surface reads and writes the same tenant-scoped repository.

1. **Overview**: explains what Maude handled, what needs attention, and what value remains at risk
2. **Calls**: lists every call and opens its transcript, captured fields, intelligence, actions, consent, source, and audit evidence
3. **To follow up**: groups missed calls, hot opportunities, complaints, urgent tasks, and failed actions into an owner work queue
4. **Prepare Maude**: guides the owner through company facts, coverage, voice, rules, scripts, and scenario validation
5. **Learn**: lists unanswered questions, low-confidence results, unresolved conflicts, abandoned calls, and owner corrections
6. **Settings**: manages the business profile, retention, consent defaults, billing, and integrations
7. **Technical status**: reports persistence, providers, authentication, jobs, and infrastructure without implying commercial readiness
8. **Demo readiness**: proves that the application works locally through persisted simulation, tests, build, and browser flow
9. **Live-call readiness**: proves the external dependencies and evidence required for real customer calls

The guided demonstration starts from **Overview** or the public site. It creates a normal call record, then links through **Calls**, **To follow up**, **Learn**, and the readiness surfaces.

Founder-only and technical pages can retain Scaly terminology when they describe infrastructure.

## Owner operating flows

Allô Maude supports four complete owner workflows outside the guided demonstration.

### Prepare the business

```text
Prepare Maude
  -> import or enter business facts
  -> review and approve facts
  -> choose coverage
  -> configure voice and transfer rules
  -> run required scenarios
  -> resolve preparation gaps
  -> inspect Demo readiness
```

### Run daily operations

```text
Overview
  -> inspect urgent and recent outcomes
  -> open Calls or To follow up
  -> complete, retry, or assign actions
  -> return to Overview
```

### Correct Maude

```text
Learn
  -> open evidence from a call
  -> correct a business fact, rule, or script
  -> record the resolution
  -> rerun the affected scenario
  -> close the review item
```

### Move toward a live pilot

```text
Demo readiness
  -> prove application behavior
  -> configure persistent storage and providers
  -> inspect Technical status
  -> run Live-call readiness
  -> resolve every blocking item
```

## Module acceptance requirements

Each module must support a real owner task. A page that only displays seed metrics does not satisfy this specification.

| Module | Owner task | Required write or correction path |
| --- | --- | --- |
| Overview | Understand current outcomes and risks | Open the affected call, follow-up, or readiness issue |
| Calls | Inspect what Maude heard and decided | Analyze, correct, or route the call to Learn |
| To follow up | Work the operational queue | Execute, retry, complete, or inspect an action |
| Prepare Maude | Configure the business and validate behavior | Save approved facts, coverage, rules, and test results |
| Learn | Correct gaps and weak results | Resolve or ignore a review item with an audit note |
| Settings | Maintain account, compliance, billing, and integrations | Save tenant-scoped configuration without exposing protected billing writes |
| Technical status | Diagnose component availability | Open the relevant configuration or run a live verification |
| Demo readiness | Prove the application flow | Run checks and open the exact failing evidence |
| Live-call readiness | Prepare a real pilot | Run checks and open each blocking dependency |

Navigation uses these modules as the stable customer model. The implementation can group readiness pages under a **Readiness** navigation section, but it cannot hide their separate verdicts.

## Public site

The public site explains the application, leads prospects into a credible demonstration, and routes existing owners into the operational product.

The page contains:

- A French-first promise
- A concrete description of the target customer
- A visible sample call
- Proof of outcomes, not unsupported market statistics
- Pricing with included minutes, overage rules, setup fees, spam treatment, and transfer treatment
- A disclosure that the public demo uses simulated data
- A primary action labeled **See Maude handle a call**
- A secondary action labeled **Open my workspace**

The page must not describe Allô Maude as a platform under construction. It can describe unavailable external dependencies in the product status.

## Guided demonstration

The guided demonstration proves one entity across the complete application flow. It does not use a separate tunnel or result page.

```text
Choose scenario
  -> call the normal simulation API
  -> run the normal voice, intelligence, consent, review, and action services
  -> persist the normal domain records
  -> reveal conversation
  -> show qualification
  -> show planned actions
  -> open the call through Calls
  -> inspect audit and reality labels
  -> inspect resulting work through To follow up and Learn
  -> return to the updated Overview
```

The first release includes three recommended scenarios:

1. **Critical water damage**: French call, urgency, address and phone confirmation, human transfer
2. **Quote request**: lead qualification, estimated value, follow-up task, and consent
3. **English caller**: immediate language switch, qualification, and customer-readable result

A spam scenario remains available as an additional proof that spam minutes are excluded.

The demonstration passes only when the same records remain available after navigation and a server request. A visual animation without persisted records fails the demonstration gate.

## Prepare Maude

The preparation center combines the fragmented onboarding, company settings, agent settings, scripts, and voice laboratory into one task-based workflow.

### Preparation steps

1. Import the business website or enter business facts
2. Review services, areas, hours, policies, and contact details
3. Choose a coverage mode
4. Review Maude's greeting, tone, transfer rules, and answer limits
5. Run required scenarios
6. Review failures and knowledge gaps
7. Mark the local demo as ready
8. Run the separate live-call gate when telephony dependencies exist

The import step always creates a draft. The owner must approve facts before activation.

### Coverage modes

Allô Maude supports three explicit modes:

- **After hours**: Maude answers outside business hours
- **Overflow**: Maude answers when the team does not answer
- **Primary line**: Maude answers all inbound calls

The recommended pilot mode is after hours plus overflow. Primary-line operation requires stronger live-call evidence.

## Learn queue

The Learn queue creates a quality loop from real or simulated calls. It must not train an external model automatically.

A review item appears when:

- The intelligence confidence is below the configured threshold
- A required field remains missing
- A field conflict remains unresolved
- A call ends as abandoned
- The caller asks a question that Maude cannot answer
- The call transfers because of uncertainty
- The owner marks the result as incorrect

Each item includes:

- Call link
- Evidence excerpt
- Detected issue
- Suggested correction target
- Status: open, resolved, or ignored
- Resolution note
- Audit entries

The owner can correct a business fact, change an answer limit, update a script, or document that human handling is required.

## No-dead-end contract

Every completed interaction ends in one recorded outcome:

- Answered from approved business facts
- Booking request captured
- Message captured with required fields
- Human transfer requested
- Follow-up action created
- Spam rejected
- Explicit failure recorded with a review item

The interface must not label a booking request as a confirmed appointment unless an external calendar returns a successful event identifier.

## Human handoff

Human transfer remains non-negotiable.

Allô Maude transfers when:

- The caller asks for a human
- The caller is frustrated
- An emergency satisfies the configured transfer rules
- A question exceeds approved answer limits
- The system cannot safely continue

The receiving person gets:

- Caller identity when available
- Callback number
- Reason for the call
- Urgency
- Collected fields
- Transfer reason

SMS delivery remains **configured, not verified** until Twilio Messaging returns a successful identifier.

## Quebec and Canada requirements

Allô Maude starts every Quebec customer interaction in French. It switches to English when the caller uses English.

The product includes:

- French customer pages and commercial documents
- French-first greeting
- English language switching
- AI identity disclosure
- Recording notice and purpose when recording is enabled
- A path for callers who object to recording
- Configurable transcript retention
- Personal-information minimization
- Consent records and withdrawal

This specification is product design, not legal advice. Production launch still requires a legal review of provider contracts and data transfers.

## Application architecture

The existing modular monolith remains the delivery architecture. The implementation strengthens module boundaries instead of creating a separate demonstration application.

### Domain and service boundaries

- **Company configuration**: business facts, coverage, policies, follow-up, and compliance
- **Voice agent configuration**: Maude's identity, greeting, style, limits, and transfer policy
- **Call runtime**: deterministic simulation, Voice Lab, and live voice produce compatible call records
- **Call intelligence**: classifies intent, urgency, confidence, value estimate, and next action
- **Action engine**: plans and executes follow-ups with explicit provider states
- **Review service**: creates and resolves Learn queue items
- **Readiness services**: evaluate demo, technical, and live-call evidence independently
- **Repository**: persists every tenant-scoped domain record behind one asynchronous interface

Customer pages call application services through normal server routes. Pages cannot compute a second source of business truth from hard-coded fixtures.

### Persistence contract

The repository persists:

- Companies and agent configurations
- Coverage policies
- Calls, transcripts, intelligence, and source labels
- Actions and action audit entries
- Consent records and withdrawals
- Voice sessions and telemetry
- Review items and resolution notes
- Billing and usage state
- Readiness evidence with verification timestamps

PostgreSQL is mandatory for commercial preview and live pilot modes. The application must verify a real write, read, and delete operation before it labels persistence as verified.

The memory store remains available for local demonstration. The interface must display that its data resets on restart.

### Tenant isolation

Every customer route resolves the company from the authenticated session. Every record lookup checks company ownership.

Inbound voice resolves the company from the called phone number. Until that mapping exists, **Live-call readiness** remains limited to one pilot tenant and displays that limitation as a blocker for a second customer.

### State provenance

Each call and external action keeps enough provenance to support an honest label:

- Source: seed, simulator, Voice Lab, or live
- Provider: mock, configured provider, or verified provider
- Persistence mode: memory or PostgreSQL
- Verification timestamp
- External identifier when a provider confirms the operation

Customer status components derive labels from this provenance. Pages cannot set a green status with static copy.

## Readiness gates

Three separate views prevent a false ready state. Technical status reports components. Demo readiness proves application behavior. Live-call readiness proves real telephony.

### Technical status

**Technical status** reports component health without issuing a commercial verdict:

- Persistence provider and live verification
- Authentication and tenant source
- Voice providers and real-time bridge
- Messaging, calendar, billing, and scheduled jobs
- Retention and purge configuration
- Last successful external operation
- Known infrastructure warnings

### Demo readiness gate

`npm run demo:check` must verify:

- Customer-facing brand uses Allô Maude
- Required demo scenarios pass
- Deterministic simulation persists a call and actions
- The call detail exposes evidence and reality labels
- The overview reflects the new call
- Follow-up and Learn surfaces reflect the same call
- Unit tests pass
- Type checking passes
- Production build passes
- Local launch instructions work without external services
- No critical defect remains open

This gate can pass with the memory store and simulated calls.

### Live-call gate

`npm run pilot:check` must continue to verify:

- Twilio webhook signature
- Real-time bridge secret
- OpenAI configuration
- Public WebSocket endpoint
- Human fallback
- PostgreSQL live check when Prisma is selected
- Phone-number-to-company mapping posture
- Recording and consent configuration
- One successful end-to-end call
- Measured real latency
- Verified PostgreSQL persistence
- A persisted live call that appears in Calls, To follow up, and Learn when applicable

The live-call gate must fail or warn when evidence is absent. It must never inherit a pass result from the Demo readiness gate.

## Data model changes

The implementation adds focused domain types.

### Coverage policy

```typescript
type CoverageMode = "after_hours" | "overflow" | "primary";

interface CoveragePolicy {
  modes: CoverageMode[];
  overflowDelaySec: number;
}
```

### Review item

```typescript
type ReviewReason =
  | "low_confidence"
  | "missing_required_field"
  | "field_conflict"
  | "unanswered_question"
  | "abandoned_call"
  | "uncertain_transfer"
  | "owner_correction";

interface ReviewItem {
  id: string;
  companyId: string;
  callId: string;
  reason: ReviewReason;
  evidence: string;
  status: "open" | "resolved" | "ignored";
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}
```

The repository interface stores and lists review items. The memory and Prisma stores implement the same contract.

## Error handling

Customer-facing errors state:

- What failed
- Whether the call or data was preserved
- What the owner can do next
- Whether a human fallback remains active

External operations fail closed:

- Calendar failure creates a booking request and review item
- SMS failure keeps the action retryable
- Real-time voice failure routes to the configured human fallback
- Knowledge uncertainty creates a review item
- Missing tenant mapping blocks multi-client voice claims

No external error can silently become a successful customer state.

## Test strategy

Implementation follows test-driven development.

### Unit tests

- Coverage-mode decisions
- Review-item creation rules
- No-dead-end outcome validation
- Customer brand boundary
- Reality-label mapping
- Demo-readiness evaluation

### Integration tests

- Simulation persists call, actions, consent, and review items
- Normal owner configuration persists through the repository and survives a new request
- Demo-created records appear in normal Calls, To follow up, Learn, and Overview queries
- Booking requests remain unconfirmed without a provider identifier
- Human transfer includes context
- Customer routes use the resolved tenant
- Settings updates preserve protected billing fields
- Memory mode and PostgreSQL mode return distinct readiness evidence

### Browser smoke test

The local smoke test verifies:

1. Public page loads as Allô Maude
2. Prepare Maude saves a configuration change
3. Overview, Calls, To follow up, Learn, and Settings load for the same tenant
4. Guided demo starts through the normal application
5. A scenario completes
6. The persisted call opens in Calls
7. Actions and audit appear
8. To follow up and Learn reflect the call when applicable
9. The overview reflects the call
10. Technical status, Demo readiness, and Live-call readiness show separate evidence
11. Reality labels remain visible

### Existing regression suite

All existing tests must pass. The current rescue test failure must be fixed at its time-source root cause, not by weakening its assertion.

## Local launch contract

The repository gains two documented local commands that avoid stale production variables:

- `npm run app:local` starts the complete application with an explicit local persistence mode
- `npm run demo:check` verifies the controlled demonstration and application flow

The local application command must:

- Start every customer module
- Use PostgreSQL when the developer selects commercial-preview mode
- Permit memory mode only when it displays the reset warning
- Preserve deterministic scenario behavior
- Work on the supported Windows development environment

The README lists the exact commands, environment modes, expected local URL, and persistence consequences.

## Visual direction

Allô Maude uses a warm, practical visual identity:

- Teal as the trust and action color
- Warm neutral backgrounds
- Amber for attention and demo status
- Rose for urgent or failed outcomes
- Clear status chips with text, not color alone
- Maude's initial or a restrained voice motif

The interface uses the vocabulary of a business owner:

- **To call back**, not rescue queue
- **What Maude handled**, not call intelligence
- **Prepare Maude**, not agent configuration
- **Learn**, not model evaluation
- **Technical status**, not pilot readiness gate

## Release scope for June 26, 2026

The release is complete when:

- Allô Maude replaces Scaly on customer surfaces
- All nine operational modules support their defined owner tasks
- Company, agent, coverage, call, action, consent, review, and readiness records use the shared repository
- PostgreSQL mode passes its live persistence check for commercial preview
- The guided demonstration works from start to persisted evidence
- The guided demonstration uses the normal API, services, repository, and customer pages
- Prepare Maude unifies the preparation tasks
- The Learn queue exposes quality gaps
- Coverage modes are visible and stored
- The Demo readiness gate passes
- The complete test suite, type check, and build pass
- Local launch works from documented commands
- The readiness report lists every simulated, unavailable, configured, and verified component

The application can remain honest about unavailable live telephony. It is then a commercial preview ready for live-pilot configuration, not a live-call-ready product.

## Post-demo pilot work

The next pilot phase prioritizes:

1. Complete a real Twilio and OpenAI call
2. Measure latency and caller interruptions
3. Connect one calendar and prove event creation
4. Map inbound phone numbers to companies
5. Run 50 controlled calls across French, English, emergencies, transfers, and noisy audio
6. Recruit three to five Quebec home-service pilots
7. Measure setup time, completion rate, transfer success, hangups, corrections, and qualified opportunities

These measurements determine adoption. Competitive research cannot substitute for them.

## Acceptance criteria

The implementation is accepted only when all statements are true:

- No customer-facing page sells Scaly as the product
- The application remains usable when no guided demonstration is running
- Overview, Calls, To follow up, Prepare Maude, Learn, Settings, Technical status, Demo readiness, and Live-call readiness connect to shared tenant data
- Normal owner workflows can save configuration, inspect operations, correct gaps, and rerun checks
- Every demo scenario produces a persisted, inspectable result
- The demonstration cannot bypass the shared application services or create a duplicate cockpit
- Every completed interaction has an allowed outcome
- Every unresolved interaction creates a review item
- No booking appears confirmed without external confirmation
- Demo and live-call readiness have separate verdicts
- Memory mode never receives a commercial-preview or live-pilot persistence verdict
- PostgreSQL live verification passes before commercial preview receives a persistence-ready verdict
- Every mock, simulation, missing dependency, and unverified integration is labeled
- Tests, type checking, build, and browser smoke test pass
- The readiness report contains no known critical defect
- The report does not claim guaranteed adoption, revenue, or viral growth
