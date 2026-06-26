# Allô Maude Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one persisted, inspectable Allô Maude workflow that uses the shared application repository from configuration through a critical-water-damage call, operations, correction, and separate readiness verdicts.

**Architecture:** Extend the existing modular Next.js monolith. The simulator, customer pages, readiness evaluators, and CLI use the same domain objects and `ScalyRepository`; no demo-only store or dashboard is introduced. Memory supports local demonstration, while Prisma persists the same new coverage, review, and readiness records.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma/PostgreSQL, Vitest, Tailwind CSS

---

### Task 1: Establish an honest green baseline

**Files:**
- Modify: `src/services/analytics.ts`
- Modify: `src/services/rescue.ts`
- Modify: `tests/rescue.test.ts`

- [ ] **Step 1: Use the existing failing ROI test as the regression test**

The current test creates calls relative to `2026-06-11`, while `computeDashboard()` and `computeRoiSnapshot()` use the wall clock independently.

- [ ] **Step 2: Run the failing test**

Run: `npm test -- tests/rescue.test.ts`

Expected: FAIL because `protectedCad` is `0` instead of `1200`.

- [ ] **Step 3: Inject one clock into both calculations**

Change the signatures to:

```typescript
export function computeDashboard(
  company: Company,
  calls: Call[],
  actions: ScalyAction[],
  periodDays = 14,
  now = new Date(),
): DashboardData;

export function computeRoiSnapshot(
  company: Company,
  d: DashboardData,
  calls: Call[],
  now = new Date(),
): RoiSnapshot;
```

Use `now.getTime()` instead of `Date.now()`. Pass `NOW` in the test.

- [ ] **Step 4: Run the regression and full baseline**

Run: `npm test -- tests/rescue.test.ts`

Expected: PASS.

Run: `npm test`

Expected: 213 tests pass before new feature tests are added.

- [ ] **Step 5: Commit**

```powershell
git add src/services/analytics.ts src/services/rescue.ts tests/rescue.test.ts
git commit -m "fix: make rescue analytics use one clock"
```

### Task 2: Add coverage, provenance, review, readiness, and reality domains

**Files:**
- Modify: `src/domain/company.ts`
- Modify: `src/domain/call.ts`
- Create: `src/domain/review.ts`
- Create: `src/domain/readiness.ts`
- Modify: `src/domain/index.ts`
- Create: `src/services/reality.ts`
- Test: `tests/reality.test.ts`
- Test: `tests/review.test.ts`
- Test: `tests/no-dead-end.test.ts`

- [ ] **Step 1: Write failing reality-label tests**

Cover:

```typescript
expect(deriveCallReality(simulatedCall, memoryInfo).state).toBe("simulated");
expect(deriveCallReality(liveCall, prismaInfo, verifiedEvidence).state).toBe("verified");
expect(deriveProviderReality({ configured: true, verified: false }).state).toBe("configured_not_verified");
expect(deriveProviderReality({ configured: false, verified: false }).state).toBe("unavailable");
```

- [ ] **Step 2: Write failing review and outcome tests**

Cover missing required fields, low confidence, abandoned calls, and valid outcomes:

```typescript
expect(createReviewItems({ call, requiredFields: ["adresse", "telephone"] }))
  .toContainEqual(expect.objectContaining({ reason: "missing_required_field" }));

expect(validateCallOutcome(transferredCall).valid).toBe(true);
expect(validateCallOutcome(callWithoutOutcome).valid).toBe(false);
```

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- tests/reality.test.ts tests/review.test.ts tests/no-dead-end.test.ts`

Expected: FAIL because modules and types do not exist.

- [ ] **Step 4: Implement focused domain types**

Add:

```typescript
export type CoverageMode = "after_hours" | "overflow" | "primary";
export interface CoveragePolicy { modes: CoverageMode[]; overflowDelaySec: number; }

export type RealityState = "verified" | "configured_not_verified" | "simulated" | "unavailable";
export interface RealityLabel { state: RealityState; label: string; detail: string; }

export type ReviewReason =
  | "low_confidence"
  | "missing_required_field"
  | "field_conflict"
  | "unanswered_question"
  | "abandoned_call"
  | "uncertain_transfer"
  | "owner_correction";

export interface ReviewItem {
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

Add call provenance for `verifiedAt` and optional external identifiers without changing the existing `source`.

- [ ] **Step 5: Implement pure services**

`src/services/reality.ts` derives labels from call source, store info, provider configuration, external identifiers, and verification timestamps.

`src/services/review.ts` creates review items from actual gaps.

`src/services/outcome.ts` accepts only answered, booking-request, message, transfer, follow-up, spam, or explicit-failure outcomes.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `npm test -- tests/reality.test.ts tests/review.test.ts tests/no-dead-end.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/domain src/services/reality.ts src/services/review.ts src/services/outcome.ts tests/reality.test.ts tests/review.test.ts tests/no-dead-end.test.ts
git commit -m "feat: add Allo Maude evidence domains"
```

### Task 3: Persist coverage, review items, and readiness evidence in both stores

**Files:**
- Modify: `src/data/companies.ts`
- Modify: `src/server/store.ts`
- Modify: `src/server/prisma-store.ts`
- Modify: `src/server/seed.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260625_allo_maude_vertical_slice/migration.sql`
- Test: `tests/repository-evidence.test.ts`

- [ ] **Step 1: Write a failing repository contract test**

Instantiate `InMemoryStore`, then save and read:

```typescript
await store.updateCompany(company.id, { coverage: { modes: ["after_hours", "overflow"], overflowDelaySec: 20 } });
await store.saveReviewItem(review);
await store.saveReadinessEvidence(evidence);

expect((await store.getCompany(company.id))?.coverage.modes).toContain("overflow");
expect(await store.listReviewItems(company.id)).toContainEqual(review);
expect(await store.listReadinessEvidence(company.id, "demo")).toContainEqual(evidence);
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/repository-evidence.test.ts`

Expected: FAIL because repository methods and fields do not exist.

- [ ] **Step 3: Extend the shared repository**

Add the same methods to `ScalyRepository`, `InMemoryStore`, and `PrismaStore`:

```typescript
listReviewItems(companyId: string, status?: ReviewStatus): Promise<ReviewItem[]>;
saveReviewItem(item: ReviewItem): Promise<ReviewItem>;
resolveReviewItem(id: string, resolution: string, status?: "resolved" | "ignored"): Promise<ReviewItem | undefined>;
listReadinessEvidence(companyId: string, kind?: ReadinessKind): Promise<ReadinessEvidence[]>;
saveReadinessEvidence(evidence: ReadinessEvidence): Promise<ReadinessEvidence>;
```

- [ ] **Step 4: Add Prisma models and migration**

Add `coverage Json` to `Company`, plus `ReviewItem` and `ReadinessEvidence` models with tenant indexes and relations.

- [ ] **Step 5: Seed explicit coverage**

Give every seed company a coverage policy. Do not seed fake verified readiness evidence.

- [ ] **Step 6: Generate Prisma and run the contract test**

Run: `npm run db:generate`

Run: `npm test -- tests/repository-evidence.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add prisma src/data/companies.ts src/server tests/repository-evidence.test.ts
git commit -m "feat: persist coverage reviews and readiness evidence"
```

### Task 4: Build the shared critical-water-damage workflow

**Files:**
- Create: `src/services/simulation-workflow.ts`
- Modify: `src/services/simulator.ts`
- Modify: `src/app/api/simulate/route.ts`
- Test: `tests/vertical-slice.test.ts`

- [ ] **Step 1: Write a failing vertical test**

The test runs a deterministic French critical-water-damage scenario through `InMemoryStore` and asserts:

```typescript
expect(call.source).toBe("simulator");
expect(call.language).toBe("fr");
expect(call.intelligence?.urgency).toBe("critique");
expect(call.intelligence?.collectedFields.telephone).toBeTruthy();
expect(call.intelligence?.collectedFields.adresse).toBeTruthy();
expect(call.status).toBe("transferred");
expect(actions.length).toBeGreaterThan(0);
expect(await store.getCall(call.id)).toEqual(call);
expect(await store.listActions(company.id, call.id)).toHaveLength(actions.length);
expect((await store.getAuditLog()).some((e) => e.detail === call.id)).toBe(true);
expect((await store.listReviewItems(company.id)).some((i) => i.callId === call.id)).toBe(true);
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/vertical-slice.test.ts`

Expected: FAIL because the workflow does not exist and review evidence is not persisted.

- [ ] **Step 3: Implement one orchestration service**

Create:

```typescript
export async function runSimulationWorkflow(
  repo: ScalyRepository,
  input: SimulationInput,
): Promise<SimulationWorkflowResult>
```

It calls `simulateCall()`, validates the outcome, persists call and actions, persists consent, creates review items from real gaps, records audit evidence, and returns reality labels.

- [ ] **Step 4: Make the critical scenario deterministic**

Use the existing plumbing industry script and urgent persona. Select or add a fixed seed that captures address and phone, requests transfer, and leaves one legitimate follow-up gap. Do not hard-code the result after simulation.

- [ ] **Step 5: Route the API through the workflow**

`POST /api/simulate` calls `runSimulationWorkflow()` when `persist !== false`. The response includes `reviewItems`, `reality`, and `auditRecorded`.

- [ ] **Step 6: Run vertical and regression tests**

Run: `npm test -- tests/vertical-slice.test.ts tests/simulator.test.ts tests/consent.test.ts tests/action-engine.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/services/simulation-workflow.ts src/services/simulator.ts src/app/api/simulate/route.ts tests/vertical-slice.test.ts
git commit -m "feat: persist the critical water damage workflow"
```

### Task 5: Add Demo readiness without weakening Live-call readiness

**Files:**
- Create: `src/services/demo-readiness.ts`
- Create: `scripts/demo-check.ts`
- Modify: `package.json`
- Create: `tests/demo-readiness.test.ts`
- Modify: `src/services/pilot-readiness.ts`
- Modify: `tests/pilot-readiness.test.ts`

- [ ] **Step 1: Write failing Demo readiness tests**

Cover:

```typescript
expect(evaluateDemoReadiness(memoryEvidence).verdict).toBe("pass");
expect(evaluateDemoReadiness(missingVerticalEvidence).verdict).toBe("fail");
expect(evaluateDemoReadiness(memoryEvidence).commercialPreviewReady).toBe(false);
```

The pass means local demonstration ready, not commercial-preview ready.

- [ ] **Step 2: Add a failing Live-call separation test**

Assert that a passing Demo readiness report does not change `evaluatePilotReadiness()` and memory mode remains non-persistent.

- [ ] **Step 3: Run and verify RED**

Run: `npm test -- tests/demo-readiness.test.ts tests/pilot-readiness.test.ts`

Expected: FAIL because Demo readiness does not exist.

- [ ] **Step 4: Implement the pure evaluator and CLI**

The evaluator checks brand boundary, vertical scenario evidence, shared repository evidence, tests, type checking, build, and memory-mode limitations.

`npm run demo:check` runs the targeted evidence checks and exits `1` on a structural failure.

- [ ] **Step 5: Run and verify GREEN**

Run: `npm test -- tests/demo-readiness.test.ts tests/pilot-readiness.test.ts`

Expected: PASS.

Run: `npm run demo:check`

Expected: PASS or an honest FAIL that identifies the next incomplete implementation step.

- [ ] **Step 6: Commit**

```powershell
git add src/services/demo-readiness.ts scripts/demo-check.ts package.json tests/demo-readiness.test.ts src/services/pilot-readiness.ts tests/pilot-readiness.test.ts
git commit -m "feat: separate demo and live call readiness"
```

### Task 6: Build the operational customer surfaces

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Create: `src/components/RealityBadge.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/calls/page.tsx`
- Modify: `src/app/(app)/calls/[id]/page.tsx`
- Create: `src/app/(app)/follow-up/page.tsx`
- Create: `src/app/(app)/learn/page.tsx`
- Create: `src/components/ReviewItemActions.tsx`
- Create: `src/app/api/reviews/[id]/route.ts`
- Create: `src/app/(app)/readiness/demo/page.tsx`
- Create: `src/app/(app)/readiness/live/page.tsx`
- Modify: `src/app/(app)/status/page.tsx`
- Test: `tests/brand-boundary.test.ts`

- [ ] **Step 1: Write the failing brand-boundary test**

Scan customer-facing pages and components for rendered `Scaly` copy while allowing technical status and internal identifiers.

Run: `npm test -- tests/brand-boundary.test.ts`

Expected: FAIL on current public, pricing, sidebar, dashboard, simulator, and customer forms.

- [ ] **Step 2: Build a shared reality badge**

Map the four states to text plus color:

```typescript
verified -> "Vérifié"
configured_not_verified -> "Configuré, non vérifié"
simulated -> "Simulé"
unavailable -> "Indisponible"
```

- [ ] **Step 3: Rebrand and connect Overview and Calls**

Use Allô Maude and Maude in rendered customer copy. Overview reads repository calls, actions, reviews, and store provenance. Calls and call detail show source and reality labels.

- [ ] **Step 4: Build To follow up**

Read rescue entries and pending, failed, or configuration-required actions from the shared repository. Provide useful links and action execution.

- [ ] **Step 5: Build Learn**

Read persisted review items. Provide resolve and ignore actions through the tenant-checked review API, with required resolution text.

- [ ] **Step 6: Build separate readiness pages**

Demo readiness shows local flow evidence. Live-call readiness uses `evaluatePilotReadiness()`. Technical status continues to show components without issuing either verdict.

- [ ] **Step 7: Run targeted tests**

Run: `npm test -- tests/brand-boundary.test.ts tests/vertical-slice.test.ts tests/demo-readiness.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/components src/app tests/brand-boundary.test.ts
git commit -m "feat: connect Allo Maude operational surfaces"
```

### Task 7: Build Prepare Maude and the integrated demonstration

**Files:**
- Create: `src/app/(app)/prepare/page.tsx`
- Create: `src/components/CoverageForm.tsx`
- Modify: `src/components/SimulatorClient.tsx`
- Modify: `src/app/(app)/simulator/page.tsx`
- Modify: `src/app/api/company/route.ts`
- Test: `tests/coverage.test.ts`

- [ ] **Step 1: Write failing coverage tests**

Test allowed mode combinations, overflow-delay bounds, and repository persistence.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/coverage.test.ts`

Expected: FAIL because coverage validation and UI contract do not exist.

- [ ] **Step 3: Implement coverage validation and persistence**

Permit `after_hours`, `overflow`, and `primary`; require `overflowDelaySec` from `5` through `120`.

- [ ] **Step 4: Build Prepare Maude**

Show business facts, coverage form, Maude configuration links, scenario completion state, review gaps, Demo readiness, and Live-call readiness. Every card links to a write or correction path.

- [ ] **Step 5: Integrate the guided scenario**

The simulator labels itself as an integrated proof. The result links to Calls, To follow up, Learn, and Overview using the persisted IDs returned by the normal API.

- [ ] **Step 6: Run tests**

Run: `npm test -- tests/coverage.test.ts tests/vertical-slice.test.ts tests/brand-boundary.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/app src/components/CoverageForm.tsx src/components/SimulatorClient.tsx tests/coverage.test.ts
git commit -m "feat: add Prepare Maude and integrated proof flow"
```

### Task 8: Build the public Allô Maude entry point

**Files:**
- Create: `src/app/allo-maude/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `src/components/PricingPlans.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Confirm the brand-boundary test is RED for public surfaces**

Run: `npm test -- tests/brand-boundary.test.ts`

Expected: FAIL before public rebranding.

- [ ] **Step 2: Implement `/allo-maude`**

Use a French-first Allô Maude page with:

- Product explanation
- Critical-call proof
- CTA to `/prepare`
- CTA to `/simulator`
- Simulation disclosure
- No Scaly customer copy

- [ ] **Step 3: Make `/` the Allô Maude entry**

Render or redirect to the same customer proposition. Update metadata and pricing product names.

- [ ] **Step 4: Apply the visual system**

Use a practical Quebec service-business aesthetic: deep teal, work-order amber, warm white, clear provenance stamps, strong keyboard focus, responsive layout, and reduced-motion support.

- [ ] **Step 5: Run brand and build checks**

Run: `npm test -- tests/brand-boundary.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/app src/components/PricingPlans.tsx
git commit -m "feat: launch the Allo Maude customer brand"
```

### Task 9: Add the local launch contract and perform full verification

**Files:**
- Create: `scripts/app-local.ts`
- Modify: `package.json`
- Modify: `README.md`
- Create: `docs/LAUNCH_READINESS.md`

- [ ] **Step 1: Add a local application command**

`npm run app:local` forces `STORE_PROVIDER=memory` for a local demonstration and prints the reset warning and URL. It starts the complete application, not a demo-only app.

- [ ] **Step 2: Document both persistence modes**

README documents:

- `npm run app:local`
- PostgreSQL commercial-preview setup
- `npm run demo:check`
- `npm run pilot:check`
- What resets in memory mode
- What remains unavailable without external credentials

- [ ] **Step 3: Run the complete automated verification**

Run:

```powershell
npm run typecheck
npm test
npm run build
npm run demo:check
npm run pilot:check
```

Expected:

- Type check, tests, build, and Demo readiness pass
- Live-call readiness may warn or fail only for declared external blockers

- [ ] **Step 4: Launch and run the browser smoke flow**

Start: `npm run app:local`

Verify:

1. `/allo-maude`
2. `/prepare`
3. Critical water damage simulation
4. Persisted `/calls/:id`
5. `/follow-up`
6. `/learn`
7. `/dashboard`
8. `/readiness/demo`
9. `/readiness/live`

- [ ] **Step 5: Write the Launch Readiness Report**

Record command outputs, browser evidence, P0 defects fixed, remaining warnings, unavailable integrations, persistence mode, and the exact live-pilot blockers.

- [ ] **Step 6: Commit**

```powershell
git add scripts/app-local.ts package.json README.md docs/LAUNCH_READINESS.md
git commit -m "docs: add Allo Maude launch readiness evidence"
```
