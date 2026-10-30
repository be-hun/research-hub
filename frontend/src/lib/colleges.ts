import type { CollegeId } from "./types";

// The validated eight-hue categorical palette, assigned in its validated order to colleges in their usual
// display order (largest first). Every bar and tag also carries the college name, so color is never the
// only cue.
export const COLLEGES: Record<CollegeId, { name: string; short: string; color: string }> = {
  medicine: { name: "Lewis Katz School of Medicine", short: "Medicine", color: "#2A78D6" },
  "science-tech": { name: "College of Science & Technology", short: "Science & Technology", color: "#EB6834" },
  "public-health": { name: "College of Public Health", short: "Public Health", color: "#1BAF7A" },
  engineering: { name: "College of Engineering", short: "Engineering", color: "#EDA100" },
  education: { name: "College of Education & Human Development", short: "Education", color: "#E87BA4" },
  "liberal-arts": { name: "College of Liberal Arts", short: "Liberal Arts", color: "#008300" },
  business: { name: "Fox School of Business", short: "Business", color: "#6250D6" },
  media: { name: "Klein College of Media and Communication", short: "Media", color: "#E34948" },
};

export function college(id: CollegeId | null | undefined) {
  return id ? COLLEGES[id] : undefined;
}

export const KIND_LABELS = { award: "Grant", trial: "Clinical trial", publication: "Publication" } as const;
