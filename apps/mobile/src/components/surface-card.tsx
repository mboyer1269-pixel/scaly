import type { ReactNode } from "react";
import { View, Text } from "react-native";

export function SurfaceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10, padding: 16, borderRadius: 18, borderCurve: "continuous", backgroundColor: "white", boxShadow: "0 1px 4px rgba(15, 23, 42, 0.12)" }}>
      <Text selectable style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}>{title}</Text>
      {children}
    </View>
  );
}
