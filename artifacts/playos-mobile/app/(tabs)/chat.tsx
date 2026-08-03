import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Image, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BAR_INSET, useMatchDayBar } from "@/components/MatchDayBar";
import { format, isToday, isYesterday } from "date-fns";
import { MessageCircle } from "lucide-react-native";
import { useMyConversations } from "@/lib/api";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { EmptyState } from "@/components/EmptyState";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { WarmCanvas } from "@/components/WarmCanvas";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

// Exact palette from the Figma Chats screen (node 1:6)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";

function stamp(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM");
}

/**
 * Chat list backed by supabase/2026-07-mobile-design-support.sql
 * (conversations/messages). "Groups" is one entry per game the player has
 * opened chat for; "Messages" (1:1 DMs) has no entry point yet, so it shows
 * an honest empty state rather than fake rows.
 */
const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

export default function Chat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Content drops by the bar's height while it is showing (Figma 834:470).
  const barInset = useMatchDayBar() ? BAR_INSET : 0;
  const { data: conversations, isLoading, refetch, isRefetching } = useMyConversations();
  const [tab, setTab] = useState<"messages" | "groups">("groups");

  useEffect(() => { screen("Chat"); }, []);

  const groups = (conversations ?? []).filter((c) => c.kind === "game_group");
  const direct = (conversations ?? []).filter((c) => c.kind === "direct");
  const list = tab === "groups" ? groups : direct;

  return (
    <View style={styles.wrap}>
      {/* Dot vortex corner art, mirrored from Profile (Figma 1:6 header art) */}
      <Image source={require("../../assets/dotvortex.png")} style={styles.vortex} resizeMode="cover" />

      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 + barInset }]}
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.orange} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <HandwrittenHeader style={styles.header}>chats</HandwrittenHeader>
            <View style={styles.segment}>
              <Pressable
                style={[styles.segmentHalf, tab === "messages" && styles.segmentActive]}
                onPress={() => setTab("messages")}
              >
                <Text style={[styles.segmentText, tab === "messages" && styles.segmentTextActive]}>messages</Text>
              </Pressable>
              <Pressable
                style={[styles.segmentHalf, tab === "groups" && styles.segmentActive]}
                onPress={() => setTab("groups")}
              >
                <Text style={[styles.segmentText, tab === "groups" && styles.segmentTextActive]}>groups</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon={<MessageCircle size={38} color="#C2703A" strokeWidth={1.8} />}
              title={tab === "groups" ? "no chats yet" : "no messages yet"}
              body={
                tab === "groups"
                  ? "book a game and its group chat opens 20 min before kickoff."
                  : "direct messages aren't available yet — join a game's group chat instead."
              }
              actionLabel={tab === "groups" ? "browse matches" : undefined}
              onAction={tab === "groups" ? () => router.push("/browse") : undefined}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.id}`)}>
            <Image
              source={{ uri: getVenuePhoto(item.pitchName ?? "?", item.pitchPhotoUrl) }}
              style={styles.avatar}
            />
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>{item.gameTitle ?? "Group chat"}</Text>
              <Text style={styles.preview} numberOfLines={2}>{item.lastMessage ?? "No messages yet"}</Text>
            </View>
            <View style={styles.rowMeta}>
              <Text style={styles.time}>{stamp(item.lastMessageAt)}</Text>
              {/* The design shows an unread dot here. Left out deliberately:
                  there's no read-state tracking in the schema yet (needs a
                  per-user last_read_at on conversations), and a dot that never
                  clears is worse than no dot. */}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
    // paddingTop is applied at the call site from the safe-area inset: the
  // fixed value here was smaller than the Dynamic Island's inset, so the first
  // element rendered underneath it.
  content: { paddingHorizontal: 20, paddingBottom: 130 },

  vortex: { position: "absolute", top: -25, right: -25, width: 320, height: 273, opacity: 0.9 },

  header: { fontSize: 34, marginBottom: spacing.xl },

  segment: {
    flexDirection: "row", height: 44, borderRadius: 22, padding: 3, marginBottom: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2,
  },
  segmentHalf: { flex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  segmentActive: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2,
  },
  segmentText: { fontSize: 14, color: MUTED },
  segmentTextActive: { fontWeight: "600", color: INK },

  row: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12, minHeight: 84,
    // Mock 69:191 rules a 1px #EDEDED line under every row, inset to the
    // text column so it starts past the avatar.
    borderBottomWidth: 1, borderBottomColor: "#EFE6DC",
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  rowText: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: "700", color: INK },
  preview: { fontSize: 13, color: MUTED, marginTop: 4 },
  rowMeta: { alignItems: "flex-end", gap: 8 },
  time: { fontSize: 12, color: MUTED },

});
