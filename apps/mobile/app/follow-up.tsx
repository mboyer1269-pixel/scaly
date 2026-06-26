import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { mobileFetch } from "@/api/client";
import { SurfaceCard } from "@/components/surface-card";

type MobileAction = { id: string; title: string; status: string; createdAt: string };

export default function FollowUp() {
  const [actions, setActions] = useState<MobileAction[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mobileFetch<{ actions: MobileAction[] }>("/api/mobile/v1/follow-up").then((data) => setActions(data.actions)).catch((cause) => setError(cause instanceof Error ? cause.message : "Erreur"));
  }, []);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 12, backgroundColor: "#f8fafc" }}>
      {error && <Text selectable style={{ color: "#be123c" }}>{error}</Text>}
      {actions.map((action) => (
        <SurfaceCard key={action.id} title={action.title}>
          <Text selectable style={{ color: "#475569" }}>{action.status} · {new Date(action.createdAt).toLocaleString("fr-CA")}</Text>
        </SurfaceCard>
      ))}
      {actions.length === 0 && !error && <Text selectable style={{ color: "#475569" }}>Aucune action en attente.</Text>}
    </ScrollView>
  );
}
