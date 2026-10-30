import Card from "@/components/Card";
import Icon from "@/components/Icon";

const DOES = [
  "Answers only from consolidated records and authorized repositories.",
  "Cites verifiable sources (DOIs, NIH award numbers).",
  "States plainly when information is unavailable or unindexed.",
  "Explains cross-college matching logic in plain English.",
];
const DOES_NOT = [
  "Invent projects or investigators to satisfy a query.",
  "Infer private emails, unlisted phones, or confidential drafts.",
  "Assume an awarded grant is recruiting without PI confirmation.",
  "Send unvetted institutional data to third-party public models.",
];
const SOURCES = [
  ["NIH RePORTER", "Federal biomedical grants and sub-awards", "Weekly"],
  ["NSF Awards", "Science, engineering and computing awards", "Bi-weekly"],
  ["U.S. Dept. of Education", "Institute of Education Sciences awards", "Monthly"],
  ["ORCID & TUScholarShare", "Publications and institutional repository", "Live"],
  ["Faculty-confirmed profiles", "Self-attested details and mentoring availability", "Attested"],
];
const CONTROLS = [
  ["Review", "Inspect parsed profile data before it is published."],
  ["Edit & refine", "Change topics, mentorship tags and summaries at any time."],
  ["Hide", "Suppress specific awards or projects from discovery and matching."],
  ["Remove", "Purge your profile or disconnect public feeds."],
];

export default function ResponsibleAiPage() {
  return (
    <main className="max-w-[1440px] mx-auto px-margin py-space-xl">
      <header className="mb-space-xl">
        <h1 className="font-headline text-headline-xl tracking-tight mb-2">Responsible AI and Data Use</h1>
        <p className="text-body-lg text-tertiary max-w-4xl">
          ResearchConnect AI is an assistive discovery layer grounded in verified institutional records, federal
          repositories, and faculty-approved submissions.
        </p>
        <div className="mt-space-lg bg-[#EEF2FF] border border-[#C7D2FE] text-[#1E3A8A] p-6 rounded-xl flex items-start gap-4">
          <Icon name="shield" size={28} className="shrink-0" />
          <div>
            <h2 className="font-headline text-headline-sm">AI never invents research records.</h2>
            <p className="text-body-md">
              Summaries, match rationales and answers are drawn from indexed grant databases and faculty-authorized
              publications. Each claim carries its source.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div className="lg:col-span-7 space-y-space-lg">
          <Card title="What the AI can and can't do" icon="balance">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-4">
                <div className="flex items-center gap-2 text-[#166534] text-label-lg mb-3">
                  <Icon name="check_circle" size={20} /> What it does
                </div>
                <ul className="space-y-2 text-body-sm text-[#14532D]">
                  {DOES.map((d) => <li key={d}>• {d}</li>)}
                </ul>
              </div>
              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4">
                <div className="flex items-center gap-2 text-[#991B1B] text-label-lg mb-3">
                  <Icon name="cancel" size={20} /> What it does not do
                </div>
                <ul className="space-y-2 text-body-sm text-[#7F1D1D]">
                  {DOES_NOT.map((d) => <li key={d}>• {d}</li>)}
                </ul>
              </div>
            </div>
          </Card>

          <Card title="Where our data comes from" icon="database">
            <div className="divide-y divide-[#F1F5F9] mb-4">
              {SOURCES.map(([name, desc, sync]) => (
                <div key={name} className="py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-label-lg">{name}</div>
                    <div className="text-body-sm text-tertiary">{desc}</div>
                  </div>
                  <span className="text-label-sm text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0] shrink-0">{sync}</span>
                </div>
              ))}
            </div>
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-4 flex items-start gap-3 text-[#92400E] text-body-sm">
              <Icon name="info" size={22} className="shrink-0" />
              <p>
                <strong>Provenance note:</strong> Award records show funding history, not that a study is currently
                recruiting. Consult the Principal Investigator directly.
              </p>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-space-lg">
          <Card title="Your control (faculty & researchers)" icon="tune">
            <ol className="space-y-3">
              {CONTROLS.map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-md shrink-0">{i + 1}</span>
                  <div>
                    <div className="text-label-lg">{t}</div>
                    <p className="text-body-sm text-tertiary">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Privacy & data protection" icon="lock">
            <p className="text-body-sm text-tertiary">
              Uploaded files are processed privately and never indexed publicly. No faculty prompts, abstracts or
              profiles are used to train public foundation models. The preview environment uses simulated records.
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
