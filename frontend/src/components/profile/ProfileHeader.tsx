import Image from "next/image";
import Link from "next/link";
import { PhotoCredit } from "@/components/CampusPhoto";
import Icon from "@/components/Icon";
import ShareButton from "@/components/ShareButton";
import SignOutButton from "@/components/SignOutButton";
import { college } from "@/lib/colleges";
import { PHOTOS } from "@/lib/photos";
import type { DemoResearcherProfile } from "@/lib/types";
import { EditInterestsButton } from "./EditInterests";

const COVER = PHOTOS.colleges;

/** The cover photo with the profile picture over its bottom edge, and the photo credit beside the picture. */
export function ProfileCover({ initials }: { initials: string }) {
  return (
    <figure className="relative">
      <div className="relative h-24 min-[400px]:h-28 sm:h-40 lg:h-48 bg-canvas">
        <Image src={COVER.src} alt={COVER.alt} fill priority sizes="(min-width: 1240px) 1240px, 100vw" className="object-cover" />
      </div>
      <div
        className="absolute left-4 sm:left-6 top-24 min-[400px]:top-28 sm:top-40 lg:top-48 -translate-y-1/2 w-24 h-24 sm:w-36 sm:h-36 rounded-full ring-4 ring-surface bg-cherry-tint text-cherry font-serif font-semibold text-[34px] sm:text-[52px] flex items-center justify-center select-none"
        aria-hidden="true"
      >
        {initials}
      </div>
      {/* Room for the lower half of the picture; the credit sits beside it. */}
      <PhotoCredit
        photo={COVER}
        className="min-h-[52px] sm:min-h-[76px] pl-[124px] sm:pl-[184px] pr-4 sm:pr-6 pt-2 text-right"
      />
    </figure>
  );
}

/** The pill every view of Maya carries: she is not a real person. */
export function SyntheticPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-soon-bg text-soon-ink px-2.5 py-0.5 text-tiny font-semibold whitespace-nowrap">
      <Icon name="science" size={14} />
      Synthetic demo account
    </span>
  );
}

/**
 * Maya's header card, LinkedIn style: cover, picture, name, headline, one stat line and the actions. `stats` is the
 * stat line, streamed in separately because it waits for the matches.
 */
export default function ProfileHeader({ profile, stats }: { profile: DemoResearcherProfile; stats: React.ReactNode }) {
  const c = college(profile.college);
  const headline = [profile.department, c?.name, "Temple University"].filter(Boolean).join(" · ");
  return (
    <header className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
      <ProfileCover initials={profile.initials} />
      <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-2 grid lg:grid-cols-[minmax(0,1fr)_auto] gap-x-10 gap-y-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-[30px] leading-[38px] sm:text-h1 break-words">{profile.name}</h1>
            <SyntheticPill />
          </div>
          <p className="text-body sm:text-lead text-ink-2 break-words">{headline}</p>
          <div className="text-small text-ink-3 min-h-[21px]">{stats}</div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <EditInterestsButton />
            <Link
              href="/ask"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-cherry text-cherry text-small font-semibold hover:bg-cherry-tint"
            >
              <Icon name="auto_awesome" size={18} />
              Ask about my research
            </Link>
            <ShareButton path="/account" title={`${profile.name} · ResearchConnect demo`} variant="outline" />
            <SignOutButton className="px-3 py-2 rounded-full text-small font-semibold text-ink-3 hover:text-cherry hover:bg-cherry-tint" />
          </div>
        </div>
        {c && (
          <ul className="hidden lg:block space-y-2.5 text-small font-semibold text-ink pt-1 max-w-[18rem]" aria-label="Affiliation">
            <li className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: `${c.color}22` }} aria-hidden="true">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
              </span>
              <Link href={`/colleges/${profile.college}`} className="hover:text-cherry hover:underline underline-offset-2">
                {c.name}
              </Link>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-md bg-cherry text-white font-serif flex items-center justify-center shrink-0" aria-hidden="true">
                T
              </span>
              Temple University
            </li>
          </ul>
        )}
      </div>
    </header>
  );
}
