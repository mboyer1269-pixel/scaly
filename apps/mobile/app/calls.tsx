import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { mobileFetch } from "@/api/client";
import { SurfaceCard } from "@/components/surface-card";

type MobileCall = {
  id: string;
  startedAt: string;
  callerName?: string;
  fromNumber: string;
  status: string;
  urgency?: string;
  summary?: string;
};

export default function Calls() {
  const [calls, setCalls] = useState<MobileCall[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mobileFetch<{ calls: MobileCall[] }>("/api/mobile/v1/calls").then((data) => setCalls(data.calls)).catch((cause) => setError(cause instanceof Error ? cause.message : "Erreur"));
  }, []);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 12, backgroundColor: "#f8fafc" }}>
      {error && <Text selectable style={{ color: "#be123c" }}>{error}</Text>}
      {calls.map((call) => (
        <SurfaceCard key={call.id} title={call.callerName ?? call.fromNumber}>
          <Text selectable style={{ color: "#475569" }}>{new Date(call.startedAt).toLocaleString("fr-CA")} · {call.status}</Text>
          <Text selectable style={{ color: call.urgency === "critique" ? "#be123c" : "#334155", fontWeight: "700" }}>{call.urgency ?? "urgence inconnue"}</Text>
          {call.summary && <Text selectable style={{ color: "#334155" }}>{call.summary}</Text>}
        </SurfaceCard>
      ))}
    </ScrollView>
  );
}
