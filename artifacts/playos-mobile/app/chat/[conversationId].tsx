import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { useConversationMessages, useSendMessage, useMyConversations, useGetGame } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { BtnOutline } from "@/components/BtnOutline";
import { Callout } from "@/components/Callout";
import { colors } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const RED = "#BF2626";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

/** Chat closes this long after full time. Surfaced in the footer. */
const CHAT_CLOSES_MINUTES_AFTER = 20;

type Pending = { id: string; body: string; failedAt: string };

const pendingKey = (id: string) => `playos.chat.pending.${id}`;

/**
 * Group chat thread, with the send-failure state from Figma 698:664.
 *
 * The annotation's hard rule: a failed message is NEVER silently dropped. It
 * stays in place with a red edge and a "not sent · tap to retry" affordance.
 * The callout promises the message is "saved on your phone", so failures are
 * persisted to AsyncStorage — component state alone would lose them when the
 * app is killed, which is exactly when a player on a weak signal backgrounds
 * it. The retention rule (chat closes 20 min after full time) is shown in the
 * footer so it's visible before it bites.
 */
export default function ChatThread() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { data: messages, isLoading } = useConversationMessages(conversationId ?? null);
  const { data: conversations } = useMyConversations();
  const sendMessage = useSendMessage();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const listRef = useRef<FlatList>(null);

  const conversation = conversations?.find((c) => c.id === conversationId);
  const { data: game } = useGetGame(conversation?.gameId ?? "");

  useEffect(() => { screen("ChatThread", { conversationId }); }, [conversationId]);

  // Restore anything that failed to send in a previous session. Merge rather
  // than overwrite: a send can fail while this read is still in flight, and a
  // blind setPending would drop the message we just promised to keep.
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    void AsyncStorage.getItem(pendingKey(conversationId)).then((raw) => {
      if (cancelled || !raw) return;
      let stored: Pending[] = [];
      try {
        stored = JSON.parse(raw) as Pending[];
      } catch {
        // Storage truncated by a kill mid-write. Drop it rather than crash.
        void AsyncStorage.removeItem(pendingKey(conversationId));
        return;
      }
      setPending((live) => {
        const seen = new Set(live.map((p) => p.id));
        return [...stored.filter((p) => !seen.has(p.id)), ...live];
      });
    });
    return () => { cancelled = true; };
  }, [conversationId]);

  // Always derive the next queue from the live state, never from a captured
  // snapshot — concurrent retries otherwise write over each other.
  const persist = useCallback((update: (live: Pending[]) => Pending[]) => {
    setPending((live) => {
      const next = update(live);
      if (conversationId) void AsyncStorage.setItem(pendingKey(conversationId), JSON.stringify(next));
      return next;
    });
  }, [conversationId]);

  useEffect(() => {
    if (messages?.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }, [messages?.length]);

  const trySend = (text: string, pendingId?: string) => {
    if (!conversationId) return;
    sendMessage.mutate(
      { conversationId, body: text },
      {
        onSuccess: () => {
          // Only clear the composer for a fresh send; a retry must not wipe a
          // draft the player has since typed.
          if (pendingId) persist((live) => live.filter((p) => p.id !== pendingId));
          else setBody("");
        },
        onError: () => {
          // Keep it on screen rather than dropping it. A retry that fails again
          // stays queued where it already is.
          if (pendingId) return;
          setBody("");
          persist((live) => [...live, { id: `p${Date.now()}-${live.length}`, body: text, failedAt: new Date().toISOString() }]);
        },
      },
    );
  };

  const retryAll = () => pending.forEach((p) => trySend(p.body, p.id));

  const teamSize = game ? game.capacity / 2 : null;
  const kickoff = game ? new Date(game.kickoffTime) : null;
  const hasFailed = pending.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      // Root-level view with no header, so no offset — 90 left the input
      // pill floating ~90pt above the keyboard on iOS.
      keyboardVerticalOffset={0}
    >
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <HandwrittenHeader style={styles.title}>
            {conversation?.pitchName?.toLowerCase() ?? "group chat"}
          </HandwrittenHeader>
          {teamSize !== null && kickoff && (
            <Text style={styles.subtitle}>
              {teamSize}v{teamSize}  ·  {kickoff.getTime() < Date.now() ? "kicked off" : "kicks off"} {format(kickoff, "h:mm a")}
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.orange} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>no messages yet — say hi</Text>}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <View style={[styles.row, mine && styles.rowMine]}>
                {/* ChatMessage carries sender_id but no name, so an avatar
                    here could only ever render "?". Omitted until the query
                    joins the sender's profile. */}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={styles.bubbleText}>{item.body}</Text>
                </View>
                {mine && (
                  <Text style={styles.meta}>{format(new Date(item.createdAt), "h:mm a")}  ·  sent</Text>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            hasFailed ? (
              <View>
                {pending.map((p) => (
                  <Pressable key={p.id} onPress={() => trySend(p.body, p.id)} style={styles.failedWrap}>
                    <View style={styles.failedRow}>
                      <Text style={styles.bang}>!</Text>
                      <View style={[styles.bubble, styles.bubbleMine, styles.bubbleFailed]}>
                        <Text style={styles.bubbleText}>{p.body}</Text>
                      </View>
                    </View>
                    <Text style={styles.metaFailed}>not sent  ·  tap to retry</Text>
                  </Pressable>
                ))}

                <Callout
                  tone="neutral"
                  icon={<Text style={styles.disc}>●</Text>}
                  title="you are on a weak signal"
                  body="the message is saved on your phone. we will send it the moment you reconnect, or you can retry now."
                  style={{ marginTop: 26 }}
                />

                <BtnOutline
                  label="retry sending"
                  tone="warning"
                  onPress={retryAll}
                  disabled={sendMessage.isPending}
                  style={{ marginTop: 20 }}
                />
              </View>
            ) : null
          }
        />
      )}

      <View style={styles.inputWrap}>
        <View style={styles.inputPill}>
          <TextInput
            style={styles.input}
            placeholder="message the group…"
            placeholderTextColor="#ADADB2"
            value={body}
            onChangeText={setBody}
            multiline
          />
          <Pressable
            onPress={() => trySend(body.trim())}
            disabled={!body.trim() || sendMessage.isPending}
            style={[styles.sendBtn, !body.trim() && styles.sendBtnOff]}
          >
            <Text style={styles.sendGlyph}>↑</Text>
          </Pressable>
        </View>
        <Text style={styles.retention}>chat closes {CHAT_CLOSES_MINUTES_AFTER} minutes after full time</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  backGlyph: { fontSize: 20, fontWeight: "700", color: INK, lineHeight: 22 },
  headerText: { marginLeft: 14, flex: 1 },
  title: { fontSize: 26, color: "#FA810B" },
  subtitle: { fontSize: 12.5, color: MUTED, marginTop: 2 },

  list: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, flexGrow: 1 },
  empty: { textAlign: "center", color: MUTED, marginTop: 60 },

  row: { flexDirection: "row", alignItems: "flex-start", marginBottom: 22 },
  rowMine: { flexDirection: "column", alignItems: "flex-end" },
  bubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, maxWidth: 250 },
  bubbleTheirs: {
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)", marginLeft: 8,
  },
  bubbleMine: {
    backgroundColor: "rgba(255,138,0,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)", maxWidth: 220,
  },
  bubbleFailed: { borderWidth: 1.5, borderColor: "rgba(191,38,38,0.5)" },
  bubbleText: { fontSize: 14, color: INK },
  meta: { fontSize: 11, color: MUTED, marginTop: 6 },

  failedWrap: { alignItems: "flex-end", marginBottom: 22 },
  failedRow: { flexDirection: "row", alignItems: "center" },
  bang: { fontSize: 13, fontWeight: "700", color: RED, marginRight: 12 },
  metaFailed: { fontSize: 11.5, fontWeight: "600", color: RED, marginTop: 6 },
  disc: { fontSize: 13, fontWeight: "700", color: "#3A3A3E" },

  inputWrap: { paddingHorizontal: 20, paddingBottom: 20 },
  inputPill: {
    flexDirection: "row", alignItems: "center", minHeight: 52, borderRadius: 26, paddingLeft: 17, paddingRight: 7,
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  input: { flex: 1, fontSize: 14, color: INK, maxHeight: 100, paddingVertical: 14 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  sendBtnOff: { backgroundColor: "#E8E0D8" },
  sendGlyph: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  retention: { fontSize: 12, color: MUTED, textAlign: "center", marginTop: 14 },
});
