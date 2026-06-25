import type { RealityLabel } from "@/domain/readiness";
import type { Tone } from "@/lib/labels";
import { Badge } from "./ui";

const TONES: Record<RealityLabel["state"], Tone> = {
  verified: "emerald",
  configured_not_verified: "amber",
  simulated: "sky",
  unavailable: "slate",
};

export function RealityBadge({ reality }: { reality: RealityLabel }) {
  return <Badge tone={TONES[reality.state]}>{reality.label}</Badge>;
}
