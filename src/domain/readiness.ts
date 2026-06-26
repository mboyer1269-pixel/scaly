export type RealityState = "verified" | "configured_not_verified" | "simulated" | "unavailable";

export interface RealityLabel {
  state: RealityState;
  label: string;
  detail: string;
}

export type ReadinessKind = "demo" | "live_call" | "technical";

export interface ReadinessEvidence {
  id: string;
  companyId: string;
  kind: ReadinessKind;
  status: RealityState;
  label: string;
  detail: string;
  callId?: string;
  externalId?: string;
  verifiedAt?: string;
  createdAt: string;
}
