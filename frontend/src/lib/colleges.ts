import type { CollegeId } from "./types";

export const COLLEGES: Record<CollegeId, { name: string; short: string; color: string }> = {
  medicine: { name: "Katz School of Medicine", short: "Medicine", color: "#E11D48" },
  "public-health": { name: "College of Public Health", short: "Public Health", color: "#0D9488" },
  "science-tech": { name: "College of Science & Technology", short: "Science & Technology", color: "#0284C7" },
  engineering: { name: "College of Engineering", short: "Engineering", color: "#1E3A8A" },
  business: { name: "Fox School of Business", short: "Fox Business", color: "#7C3AED" },
  media: { name: "Klein College of Media", short: "Klein Media", color: "#F97316" },
  education: { name: "College of Education & Human Development", short: "Education", color: "#D97706" },
};
