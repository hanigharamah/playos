import { View, Text, Image, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import { colors, gradients } from "@/lib/theme";
import { LinearGradient } from "expo-linear-gradient";
import { avatarPresetSvg, type AvatarPresetId } from "@/lib/avatarPresets";

/**
 * A player's face, in three tiers with a strict order of preference:
 *
 *   1. `uri`     — an uploaded photo (private bucket, signed for display)
 *   2. `preset`  — one of ten cartoon avatars, pickable in one tap
 *   3. initial   — the gradient disc, which can never fail
 *
 * The order matters and the last tier is load-bearing. A photo needs an upload
 * that has not happened on day one; a preset needs a choice the player may not
 * have made. The initial needs only a name, so the disc is never empty — and
 * an empty grey circle on a match card is worse than any of the three.
 */
export function Avatar({
  name,
  uri,
  preset,
  size = 44,
}: {
  name: string;
  uri?: string;
  /** 1-10, or null/undefined when the player has not chosen one. */
  preset?: AvatarPresetId | null;
  size?: number;
}) {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";

  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  // Generated at display time rather than bundled: MIT-licensed, offline, and
  // memoised per id+size so a scrolling list does not re-run the generator.
  const svg = preset ? avatarPresetSvg(preset, size) : null;
  if (svg) {
    return (
      <View style={[styles.preset, { width: size, height: size, borderRadius: size / 2 }]}>
        <SvgXml xml={svg} width={size} height={size} />
      </View>
    );
  }

  return (
    <LinearGradient
      // `vivid` is the WEB app's price/occupancy palette. Its coral end put a
      // white initial at ~2.7:1 — under even the large-text floor — and made
      // avatars the loudest thing on a soft cream-and-lavender screen. `cta` is
      // the redesign's own peach→lavender, and deep ink on it lands near 10:1.
      colors={gradients.cta}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.txt, { fontSize: size * 0.4 }]}>{initial}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  // The generated SVG is transparent, so the disc supplies its own ground.
  preset: {
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    backgroundColor: "rgba(255,236,222,0.95)",
  },
  txt: { color: colors.inkDeep, fontWeight: "700" },
});
