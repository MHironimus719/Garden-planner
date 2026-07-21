// Family → display color for bed tiles. Falls back to gray.
export const familyColors: Record<string, string> = {
  solanaceae: "bg-red-400",
  brassicaceae: "bg-emerald-400",
  fabaceae: "bg-purple-400",
  cucurbitaceae: "bg-yellow-400",
  apiaceae: "bg-orange-400",
  alliaceae: "bg-pink-400",
  amaryllidaceae: "bg-pink-400",
  asteraceae: "bg-lime-400",
  chenopodiaceae: "bg-teal-400",
  amaranthaceae: "bg-teal-400",
  poaceae: "bg-amber-400",
  lamiaceae: "bg-indigo-400",
  malvaceae: "bg-rose-400",
};

export function familyColor(family: string | null): string {
  if (!family) return "bg-stone-300";
  return familyColors[family.toLowerCase()] ?? "bg-stone-300";
}
