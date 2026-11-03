// Openly licensed photos of Temple University from Wikimedia Commons, downloaded at 1600px.
// Every photo shows its credit where it appears; the About page lists them all. Captions say what the photo
// actually shows: colleges without a photo of their own building get a general campus photo, captioned as such.

export interface CampusPhoto {
  src: string;
  alt: string;
  caption: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string; // the Commons file page
}

export const PHOTOS = {
  "medicine": {
    src: "/images/campus/medicine.jpg",
    alt: "Lewis Katz School of Medicine, Temple University",
    caption: "Lewis Katz School of Medicine",
    author: "ajay_suresh",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Lewis_Katz_School_of_Medicine_at_Temple_University_(53564185696).jpg",
  },
  "science-tech": {
    src: "/images/campus/science-tech.jpg",
    alt: "Science and Education Research Center, Temple University",
    caption: "Science and Education Research Center",
    author: "Megan Miller",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Science_and_Education_Research_Center.jpg",
  },
  "business": {
    src: "/images/campus/business.jpg",
    alt: "Alter Hall, home of the Fox School of Business, Temple University",
    caption: "Alter Hall, home of the Fox School of Business",
    author: "Jrcla2",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Alter_Hall_entrance_-_Temple_University.jpg",
  },
  "media": {
    src: "/images/campus/media.jpg",
    alt: "Howard Gittis Student Center on Main Campus, Temple University",
    caption: "Howard Gittis Student Center on Main Campus",
    author: "ImagineerJC",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Howard_Gittis_Student_Center.jpg",
  },
  "liberal-arts": {
    src: "/images/campus/liberal-arts.jpg",
    alt: "Anderson Hall, Temple University",
    caption: "Anderson Hall",
    author: "Megan Miller",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Anderson_Hall_(Temple_University).jpg",
  },
  "public-health": {
    src: "/images/campus/public-health.jpg",
    alt: "Cherry blossoms on Main Campus, Temple University",
    caption: "Cherry blossoms on Main Campus",
    author: "AGnias47",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Cherry_Blossoms_at_Temple_University.jpg",
  },
  "engineering": {
    src: "/images/campus/engineering.jpg",
    alt: "The Bell Tower in winter, Temple University",
    caption: "The Bell Tower in winter",
    author: "ImagineerJC",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Temple_University_Bell_Tower_in_winter.jpg",
  },
  "education": {
    src: "/images/campus/education.jpg",
    alt: "The south end of Main Campus at Broad Street, Temple University",
    caption: "The south end of Main Campus at Broad Street",
    author: "ImagineerJC",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:South_end_of_Temple%27s_Main_Campus.jpg",
  },
  "people": {
    src: "/images/campus/people.jpg",
    alt: "Charles Library, Temple University",
    caption: "Charles Library",
    author: "Jim.henderson",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Charles_Library_winter_jeh.jpg",
  },
  "colleges": {
    src: "/images/campus/colleges.jpg",
    alt: "Beury Beach, the Bell Tower and Paley Library, Temple University",
    caption: "Beury Beach, the Bell Tower and Paley Library",
    author: "ImagineerJC",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Beury_Beach,_Bell_Tower,_Paley_Library.jpg",
  },
} satisfies Record<string, CampusPhoto>;

export type PhotoKey = keyof typeof PHOTOS;
