import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { mobileFetch } from "@/api/client";
import { SurfaceCard } from "@/components/surface-card";

type Overview = {
  company: { name: string; sectorLabel: string; city: string };
  dashboard: { callsTotal: number; urgentOpen: number; pipelineValueCad: number; missed: number };
  store: { provider: string; persistent: boolean };
};

export default function Home() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mobileFetch<Overview>("/api/mobile/v1/overview").then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Erreur"));
  }, []);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 14, backgroundColor: "#f8fafc" }}>
      {error && <Text selectable style={{ color: "#be123c" }}>{error}</Text>}
      <SurfaceCard title={data?.company.name ?? "Allô Maude"}>
        <Text selectable style={{ color: "#475569" }}>{data ? `${data.company.sectorLabel} · ${data.company.city}` : "Chargement..."}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Metric label="Appels" value={String(data?.dashboard.callsTotal ?? "—")} />
          <Metric label="Urgences" value={String(data?.dashboard.urgentOpen ?? "—")} />
          <Metric label="Manqués" value={String(data?.dashboard.missed ?? "—")} />
        </View>
      </SurfaceCard>

      <NavLink href="/calls" label="Voir les appels" />
      <NavLink href="/follow-up" label="Actions à suivre" />
      <NavLink href="/privacy" label="Confidentialité et données" />
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 92, gap: 4, padding: 12, borderRadius: 14, backgroundColor: "#f1f5f9" }}>
      <Text selectable style={{ color: "#475569", fontSize: 12 }}>{label}</Text>
      <Text selectable style={{ color: "#0f172a", fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: 16, borderRadius: 16, backgroundColor: "#0f172a" }}>
        <Text style={{ color: "white", fontWeight: "700" }}>{label}</Text>
      </Pressable>
    </Link>
  );
}
