import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { SegmentedControl } from "@/components/SegmentedControl";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

/**
 * UI shell only — there is no chat/messaging table or backend anywhere in
 * Supabase (checked supabase-api.ts and the schema). Showing fabricated
 * conversations here would be actively misleading, so this is an honest
 * "not built yet" state rather than a fake inbox. Wire this up once a
 * messages/conversations table + realtime channel exist.
 */
export default function Chat() {
  const [tab, setTab] = useState<"messages" | "groups">("messages");

  useEffect(() => { screen("Chat"); }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>Chats</Text>
      <SegmentedControl
        options={[{ value: "messages", label: "Messages" }, { value: "groups", label: "Groups" }]}
        value={tab}
        onChange={setTab}
      />
      <View style={styles.empty}>
        <View style={styles.iconWrap}>
          <MessageCircle size={28} color={colors.inkFaint} />
        </View>
        <HandwrittenHeader style={styles.emptyTitle}>coming soon</HandwrittenHeader>
        <Text style={styles.emptyBody}>
          Chat isn't built yet. For now, join a game's WhatsApp group from its confirmation screen.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep, padding: spacing.lg, paddingTop: spacing.xxl },
  header: { fontSize: 28, fontWeight: "800", color: colors.inkNavy, marginBottom: spacing.lg },
  empty: { alignItems: "center", paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  emptyTitle: { fontSize: 32 },
  emptyBody: { color: colors.inkMuted, marginTop: spacing.sm, textAlign: "center", fontSize: 13, lineHeight: 19 },
});
