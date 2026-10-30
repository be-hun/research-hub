import type { CollegeId } from "./types";

// Colors validated as a categorical set (lightness band, chroma, colorblind separation, contrast on the canvas).
export const COLLEGES: Record<CollegeId, { name: string; short: string; color: string }> = {
  medicine: { name: "Lewis Katz School of Medicine", short: "Medicine", color: "#C2185B" },
  "science-tech": { name: "College of Science & Technology", short: "Science & Technology", color: "#1E6FB8" },
  "public-health": { name: "College of Public Health", short: "Public Health", color: "#0F8B72" },
  engineering: { name: "College of Engineering", short: "Engineering", color: "#4F46B8" },
  education: { name: "College of Education & Human Development", short: "Education", color: "#D97706" },
  business: { name: "Fox School of Business", short: "Business", color: "#7C3AED" },
  media: { name: "Klein College of Media and Communication", short: "Media", color: "#F97316" },
};

export function college(id: CollegeId | null | undefined) {
  return id ? COLLEGES[id] : undefined;
}
