import { View, Text, StyleSheet } from "react-native";
import { Star } from "lucide-react-native";
import { colors } from "@/lib/theme";

export function RatingStars({ rating, count }: { rating: number; count?: number }) {
  return (
    <View style={styles.row}>
      <Star size={12} color={colors.orange} fill={colors.orange} />
      <Text style={styles.txt}>{rating.toFixed(1)}{count != null ? ` (${count})` : ""}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 3 },
  txt: { fontSize: 12, color: colors.inkMuted, fontWeight: "500" },
});
