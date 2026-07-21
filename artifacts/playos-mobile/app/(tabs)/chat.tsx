import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Image, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { MessageCircle } from "lucide-react-native";
import { useMyConversations } from "@/lib/api";
import { SegmentedControl } from "@/components/SegmentedControl";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { colors, spacing, radius } from "@/lib/theme";
import { screen } from "@/lib/analytics";

/**
 * Real chat list backed by supabase/2026-07-mobile-design-support.sql
 * (conversations/messages tables). "Groups" shows one entry per game the
 * player has opened chat for (from the game-detail screen). "Messages"
 * (1:1 DMs) uses the same schema but has no "start a DM" entry point in
 * the app yet, so it's an honest empty state, not fake data.
 */
export default function Chat() {
  const router = useRouter();
  const { data: conversations, isLoading, refetch, isRefetching } = useMyConversations();
  const [tab, setTab] = useState<"messages" | "groups">("groups");

  useEffect(() => { screen("Chat"); }, []);

  const groups = (conversations ?? []).filter((c) => c.kind === "game_group");
  const direct = (conversations ?? []).filter((c) => c.kind === "direct");
  const list = tab === "groups" ? groups : direct;

  return (
    <FlatList
      style={styles.wrap}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.orange} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.header}>Chats</Text>
          <SegmentedControl
            options={[{ value: "messages", label: "Messages" }, { value: "groups", label: "Groups" }]}
            value={tab}
            onChange={setTab}
          />
        </View>
      }
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.empty}>
            <View style={styles.iconWrap}>
              <MessageCircle size={28} color={colors.inkFaint} />
            </View>
            <HandwrittenHeader style={styles.emptyTitle}>
              {tab === "groups" ? "no games yet" : "no messages yet"}
            </HandwrittenHeader>
            <Text style={styles.emptyBody}>
              {tab === "groups"
                ? "Book a game and open its chat to see the group here."
                : "Direct messages aren't available yet — join a game's group chat instead."}
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.id}`)}>
          <Image source={{ uri: getVenuePhoto(item.pitchName ?? "?", item.pitchPhotoUrl) }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item.gameTitle ?? "Group chat"}</Text>
            <Text style={styles.preview} numberOfLines={1}>{item.lastMessage ?? "No messages yet"}</Text>
          </View>
          {item.lastMessageAt && (
            <Text style={styles.time}>{format(new Date(item.lastMessageAt), "h:mm a")}</Text>
          )}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },
  header: { fontSize: 28, fontWeight: "800", color: colors.orange, marginBottom: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, marginTop: spacing.md, backgroundColor: "#FFFFFF", borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.hairline },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  preview: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  time: { fontSize: 11, color: colors.inkFaint },
  empty: { alignItems: "center", paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  emptyTitle: { fontSize: 32 },
  emptyBody: { color: colors.inkMuted, marginTop: spacing.sm, textAlign: "center", fontSize: 13, lineHeight: 19 },
});
