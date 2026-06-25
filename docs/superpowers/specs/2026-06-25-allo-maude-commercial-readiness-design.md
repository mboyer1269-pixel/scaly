---
meta:
  title: "How Allô Maude becomes commercially credible by June 26, 2026"
  contentType: Conceptual
  category: Product design
---

# How Allô Maude becomes commercially credible by June 26, 2026

This specification defines the product, user flow, evidence, and engineering work required to present Allô Maude as a credible commercial application on June 26, 2026. It separates the customer product from the Scaly voice engine, preserves honest status labels, and prioritizes outcomes that small businesses can test.

## Document plan

- **Goal**: define a testable product release for tomorrow and a measured path to paid pilots
- **Audience**: product owner, developer, reviewer, and future implementation agents
- **Scope**: customer-facing brand, guided demonstration, preparation workflow, quality review, readiness gates, and verification
- **Out of scope for tomorrow**: unsupported production claims, broad integration work, and guaranteed market adoption
- **Open external dependencies**: a working Twilio number, a public real-time WebSocket endpoint, an available PostgreSQL database, and production credentials

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

The customer application uses six primary destinations:

1. **Overview**: value, urgent calls, calls to recover, and recent outcomes
2. **Calls**: call history, transcripts, intelligence, actions, and evidence
3. **To follow up**: rescue queue, hot leads, complaints, and pending actions
4. **Prepare Maude**: company facts, coverage, voice, rules, and scenario tests
5. **Learn**: unanswered questions, low-confidence calls, abandoned calls, and owner corrections
6. **Settings**: business profile, consent, billing, integrations, and technical status links

Founder-only and technical pages can retain Scaly terminology where it describes infrastructure.

## Public site

The public site does one job: lead a prospect into a credible product demonstration.

The page contains:

- A French-first promise
- A concrete description of the target customer
- A visible sample call
- Proof of outcomes, not unsupported market statistics
- Pricing with included minutes, overage rules, setup fees, spam treatment, and transfer treatment
- A disclosure that the public demo uses simulated data
- A primary action labeled **See Maude handle a call**

The page must not describe Allô Maude as a platform under construction. It can describe unavailable external dependencies in the product status.

## Guided demonstration

The guided demonstration proves one entity across the complete application flow.

```text
Choose scenario
  -> run deterministic call
  -> reveal conversation
  -> show qualification
  -> show planned actions
  -> open persisted call
  -> inspect audit and reality labels
  -> return to updated overview
```

The first release includes three recommended scenarios:

1. **Critical water damage**: French call, urgency, address and phone confirmation, human transfer
2. **Quote request**: lead qualification, estimated value, follow-up task, and consent
3. **English caller**: immediate language switch, qualification, and customer-readable result

A spam scenario remains available as an additional proof that spam minutes are excluded.

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

## Readiness gates

Two separate gates prevent a false ready state.

### Commercial demo gate

`npm run demo:check` must verify:

- Customer-facing brand uses Allô Maude
- Required demo scenarios pass
- Deterministic simulation persists a call and actions
- The call detail exposes evidence and reality labels
- The overview reflects the new call
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

The live-call gate must fail or warn when evidence is absent. It must never inherit a pass result from the commercial demo gate.

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
- Booking requests remain unconfirmed without a provider identifier
- Human transfer includes context
- Customer routes use the resolved tenant
- Settings updates preserve protected billing fields

### Browser smoke test

The local smoke test verifies:

1. Public page loads as Allô Maude
2. Guided demo starts
3. A scenario completes
4. The persisted call opens
5. Actions and audit appear
6. The overview reflects the call
7. Reality labels remain visible

### Existing regression suite

All existing tests must pass. The current rescue test failure must be fixed at its time-source root cause, not by weakening its assertion.

## Local launch contract

The repository gains one documented demo command that forces the memory store and avoids stale local production variables.

The command must:

- Start the customer application
- Avoid PostgreSQL when the demo does not require it
- Display the demo status
- Preserve deterministic scenario behavior
- Work on the supported Windows development environment

The README lists the exact command and the expected local URL.

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
- The guided demonstration works from start to persisted evidence
- Prepare Maude unifies the preparation tasks
- The Learn queue exposes quality gaps
- Coverage modes are visible and stored
- The commercial demo gate passes
- The complete test suite, type check, and build pass
- Local launch works from documented commands
- The readiness report lists every simulated, unavailable, configured, and verified component

The release can remain honest about unavailable live telephony. A live-call claim requires the separate evidence defined above.

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
- Every demo scenario produces a persisted, inspectable result
- Every completed interaction has an allowed outcome
- Every unresolved interaction creates a review item
- No booking appears confirmed without external confirmation
- Demo and live-call readiness have separate verdicts
- Every mock, simulation, missing dependency, and unverified integration is labeled
- Tests, type checking, build, and browser smoke test pass
- The readiness report contains no known critical defect
- The report does not claim guaranteed adoption, revenue, or viral growth
