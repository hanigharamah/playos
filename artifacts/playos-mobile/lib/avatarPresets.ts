import { createAvatar } from "@dicebear/core";
import { funEmoji } from "@dicebear/collection";

/**
 * Ten cartoon avatars a player can pick instead of a photo.
 *
 * WHY THIS EXISTS. The disc on a match card is the strongest conversion
 * element on Home — who is already in converts better than how many spots are
 * left, in a community this size. But the two options we had both fail at
 * launch: a photo needs someone to have uploaded one, and on day one nobody
 * has, while an initial gives thirty-five players roughly nine distinguishable
 * discs. A preset is pickable in one tap by every player from the moment they
 * sign up, which makes it the only one of the three that works on day one.
 *
 * WHY GENERATED, NOT TEN PNGs. These are rendered from @dicebear/core at
 * display time — MIT licensed, offline, no network, no asset pipeline, and
 * about 3.5 KB of SVG each. Ten bundled images would be the same pictures with
 * a download, a cache and ten files to art-direct.
 *
 * WHY A FIXED LIST. The seeds are frozen: a preset id is stored on the player,
 * so changing a seed would silently change the face of everyone who chose it.
 * Add to the end, never reorder, never edit.
 */

/** Frozen. Index+1 IS the stored preset id — do not reorder or edit. */
const SEEDS = [
  "midfield", "keeper", "striker", "winger", "sweeper",
  "captain", "playmaker", "libero", "target", "utility",
] as const;

export const AVATAR_PRESET_COUNT = SEEDS.length;

/** 1-based, so 0/null can mean "no preset chosen" without ambiguity. */
export type AvatarPresetId = number;

export function isValidPresetId(id: unknown): id is AvatarPresetId {
  return typeof id === "number" && Number.isInteger(id) && id >= 1 && id <= SEEDS.length;
}

// Generating an avatar is cheap but not free, and the picker renders all ten
// at once while every match card renders three. Memoised by id+size so a
// scroll does not re-run the generator on every frame.
const cache = new Map<string, string>();

/** The raw SVG for a preset, ready for react-native-svg's SvgXml. */
export function avatarPresetSvg(id: AvatarPresetId, size = 64): string | null {
  if (!isValidPresetId(id)) return null;
  const key = `${id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const svg = createAvatar(funEmoji, {
    seed: SEEDS[id - 1],
    size,
    // Transparent: the disc's own ring and the card behind it supply the
    // background, so a baked-in one would show as a square inside the circle.
    backgroundColor: [],
  }).toString();

  cache.set(key, svg);
  return svg;
}

/** Every preset, for the picker grid. */
export function allAvatarPresets(size = 64): { id: AvatarPresetId; svg: string }[] {
  return SEEDS.map((_, i) => ({ id: i + 1, svg: avatarPresetSvg(i + 1, size)! }));
}
