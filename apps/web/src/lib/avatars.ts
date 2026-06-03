import { createAvatar } from "@dicebear/core";
import { adventurerNeutral } from "@dicebear/collection";

export const AVATAR_PRESETS = [
  "anand",
  "polgar",
  "fischer",
  "capablanca",
  "tal",
  "carlsen",
  "hou-yifan",
  "kasparov",
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export function buildAvatarDataUri(seed: string) {
  return createAvatar(adventurerNeutral, {
    seed,
    size: 96,
    radius: 14,
    backgroundColor: ["e5d1a7", "c7b48d", "9fb7a3", "b9a3a3"],
  }).toDataUri();
}
