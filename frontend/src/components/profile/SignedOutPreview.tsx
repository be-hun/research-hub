import { signInAsDemo } from "@/app/account/actions";
import Icon from "@/components/Icon";
import { college } from "@/lib/colleges";
import type { DemoResearcherProfile } from "@/lib/types";
import { ProfileCover, SyntheticPill } from "./ProfileHeader";

const PREVIEW = [
  { icon: "edit", title: "Research interests", text: "Topics and keywords you can edit. Every match on the site follows them." },
  { icon: "science", title: "New for you", text: "Recruiting trials and active grants that share your interests, from public records." },
  { icon: "group", title: "People to connect with", text: "Researchers whose active or recent work overlaps with yours, ranked the same everywhere." },
  { icon: "bookmark", title: "Saved", text: "Researchers and records you keep, in this browser only." },
];

/** /account when nobody is signed in: Maya's profile header as a preview, and the one way in. */
export default function SignedOutPreview({ profile }: { profile: DemoResearcherProfile }) {
  const c = college(profile.college);
  const headline = [profile.department, c?.name, "Temple University"].filter(Boolean).join(" · ");
  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <section aria-labelledby="preview-title" className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
          <ProfileCover initials={profile.initials} />
          <div className="px-4 sm:px-6 pb-6 pt-2 space-y-3">
            <p className="text-tiny font-semibold uppercase tracking-wider text-cherry">Demo account</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 id="preview-title" className="text-[30px] leading-[38px] sm:text-h1 break-words">
                {profile.name}
              </h1>
              <SyntheticPill />
            </div>
            <p className="text-body sm:text-lead text-ink-2 break-words">{headline}</p>
            <p className="text-body text-ink-2">
              See ResearchConnect as a researcher would. Sign in as Maya, a synthetic biomedical engineering researcher,
              to see how the site works for someone looking for collaborators and active research.
            </p>
            <form action={signInAsDemo} className="pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-cherry text-white font-semibold hover:bg-cherry-dark"
              >
                <Icon name="person" size={20} />
                Sign in as Maya (demo)
              </button>
            </form>
            <p className="text-tiny text-ink-3">
              No password and no real account. Maya&apos;s changes stay in this browser and are cleared when you sign out.
            </p>
          </div>
        </section>

        <section aria-labelledby="preview-list" className="bg-surface border border-line rounded-xl shadow-card p-4 sm:p-6">
          <h2 id="preview-list" className="text-[22px] leading-[30px]">
            What&apos;s on her profile
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3 mt-4">
            {PREVIEW.map((item) => (
              <li key={item.title} className="flex gap-3 rounded-lg border border-line p-3">
                <span className="w-9 h-9 rounded-full bg-cherry-tint text-cherry flex items-center justify-center shrink-0" aria-hidden="true">
                  <Icon name={item.icon} size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-small font-semibold text-ink">{item.title}</span>
                  <span className="block text-small text-ink-2">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-tiny text-ink-3 mt-4">
            A discovery aid, not a recommendation. Matches count shared topics and keywords in public records.
          </p>
        </section>
      </div>
    </main>
  );
}
