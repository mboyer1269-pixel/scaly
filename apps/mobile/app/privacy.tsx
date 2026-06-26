import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { mobileFetch } from "@/api/client";
import { SurfaceCard } from "@/components/surface-card";

export default function Privacy() {
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function exportData() {
    const data = await mobileFetch<{ generatedAt: string }>("/api/mobile/v1/privacy/export");
    setStatus(`Export généré : ${data.generatedAt}`);
  }

  async function deleteAccount() {
    try {
      await mobileFetch("/api/mobile/v1/privacy/delete-account", {
        method: "POST",
        body: JSON.stringify({ confirmation }),
      });
      setStatus("Suppression exécutée. Une preuve d'audit minimale est conservée.");
    } catch (cause) {
      Alert.alert("Suppression impossible", cause instanceof Error ? cause.message : "Erreur");
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 14, backgroundColor: "#f8fafc" }}>
      <SurfaceCard title="Export portable">
        <Text selectable style={{ color: "#334155" }}>Téléchargez les données de l'entreprise depuis l'API sécurisée.</Text>
        <Action label="Générer l'export" onPress={() => void exportData()} />
      </SurfaceCard>
      <SurfaceCard title="Suppression de compte">
        <Text selectable style={{ color: "#334155" }}>Tapez SUPPRIMER ALLO MAUDE pour retirer les données opérationnelles.</Text>
        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="SUPPRIMER ALLO MAUDE"
          style={{ minHeight: 48, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, paddingHorizontal: 12 }}
        />
        <Action label="Supprimer définitivement" destructive disabled={confirmation !== "SUPPRIMER ALLO MAUDE"} onPress={() => void deleteAccount()} />
      </SurfaceCard>
      {status && <Text selectable style={{ color: "#0f766e" }}>{status}</Text>}
    </ScrollView>
  );
}

function Action({ label, onPress, disabled, destructive }: { label: string; onPress: () => void; disabled?: boolean; destructive?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: destructive ? "#be123c" : "#0f172a", opacity: disabled ? 0.45 : 1 }}
    >
      <Text style={{ color: "white", fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}
