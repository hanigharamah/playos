import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format } from "date-fns";
import { ArrowLeft, Send } from "lucide-react-native";
import { useConversationMessages, useSendMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, radius, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

export default function ChatThread() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: messages, isLoading } = useConversationMessages(conversationId ?? null);
  const sendMessage = useSendMessage();
  const [body, setBody] = useState("");
  const listRef = useRef<FlatList>(null);

  useEffect(() => { screen("ChatThread", { conversationId }); }, [conversationId]);
  useEffect(() => {
    if (messages?.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }, [messages?.length]);

  const send = () => {
    if (!body.trim() || !conversationId) return;
    sendMessage.mutate({ conversationId, body }, { onSuccess: () => setBody("") });
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Group chat</Text>
        <View style={{ width: 20 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet — say hi 👋</Text>}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                </View>
                <Text style={styles.bubbleTime}>{format(new Date(item.createdAt), "h:mm a")}</Text>
              </View>
            );
          }}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor={colors.inkFaint}
          value={body}
          onChangeText={setBody}
          multiline
        />
        <Pressable onPress={send} disabled={!body.trim() || sendMessage.isPending} style={styles.sendBtn}>
          <Send size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: colors.hairline },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  empty: { textAlign: "center", color: colors.inkMuted, marginTop: spacing.xxl },
  bubbleRow: { alignItems: "flex-start", maxWidth: "80%" },
  bubbleRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleTheirs: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.hairline, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.inkNavy, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: colors.ink },
  bubbleTextMine: { color: "#FFFFFF" },
  bubbleTime: { fontSize: 10, color: colors.inkFaint, marginTop: 2 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: colors.hairline },
  input: { flex: 1, backgroundColor: "#F2F2F7", borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.ink, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.pink, alignItems: "center", justifyContent: "center" },
});
