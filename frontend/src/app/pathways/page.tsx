import Link from "next/link";
import Card from "@/components/Card";
import Icon from "@/components/Icon";
import OpportunityCard from "@/components/OpportunityCard";
import { getOpportunities } from "@/lib/api";

// Sample student context. Replaced by the backend once student profiles exist.
const INTERESTS = ["AI in Clinical Workflows", "Healthcare Operations", "Predictive Analytics", "Data Privacy & Governance", "EHR Interoperability"];

const AREAS = [
  {
    title: "AI for Health & Clinical Decision Support",
    colleges: ["Lewis Katz School of Medicine", "Fox School of Business (MIS)", "College of Public Health"],
    skills: ["Python / PyTorch", "SQL / OMOP CDM", "Clinical Workflow Analysis", "Healthcare Informatics"],
    stats: "14 active faculty researchers • 6 active NIH/NSF lab projects",
    why: "Connects database and systems-design coursework with clinical predictive algorithms and hospital informatics pipelines.",
    confidence: 96,
  },
  {
    title: "Learning Analytics & Healthcare Education AI",
    colleges: ["College of Education and Human Development", "Fox School of Business", "College of Science & Technology"],
    skills: ["Statistical Data Modeling", "Survey Instrument Design", "Python Data Visualization", "R Studio"],
    stats: "8 active faculty researchers • 3 funded education innovation grants",
    why: "Bridges information architecture with computational learning telemetry used in medical training analytics.",
    confidence: 89,
  },
  {
    title: "Biomedical Sensors & IoT Telemetry Governance",
    colleges: ["College of Engineering", "Fox School of Business", "College of Public Health"],
    skills: ["Time-Series Telemetry Analysis", "API Integrations", "Data Security Standards (HIPAA)", "Cloud Analytics"],
    stats: "11 active faculty researchers • 5 cross-college pilot awards",
    why: "Aligns with systems integrity and streaming health data compliance for wearable devices.",
    confidence: 84,
  },
];

const MENTORS = [
  { initials: "ER", name: "Dr. Elena Rostova, MD, PhD", role: "Professor of Emergency Medicine & Biomedical Informatics", focus: "Accepting 1–2 undergraduate research assistants for Epic EHR telemetry analysis.", id: "r-rostova" },
  { initials: "JC", name: "Dr. Julian Chen, PhD", role: "Associate Professor of Healthcare Management & MIS", focus: "Seeking MIS students with strong SQL/Python foundations for hospital capacity modeling.", id: "r-chen" },
  { initials: "AT", name: "Dr. Aris Thorne, PhD", role: "Associate Professor of Computer & Information Sciences", focus: "Co-advising algorithmic fairness and EHR triage data curation.", id: "r-thorne" },
];

const READINESS = [
  { label: "Resume / CV tailored for research", done: true },
  { label: "One-paragraph research intent statement", done: false },
  { label: "Unofficial Temple academic transcript", done: true },
  { label: "Draft introductory email to faculty mentor", done: false },
  { label: "One faculty reference", done: true },
];

export default async function PathwaysPage() {
  const opportunities = await getOpportunities();
  const done = READINESS.filter((r) => r.done).length;

  return (
    <main className="max-w-[1440px] mx-auto px-margin py-8 space-y-space-xl">
      <div>
        <h1 className="font-headline text-headline-lg">Student Research Pathways</h1>
        <p className="text-body-md text-tertiary">Research areas, mentors and openings matched to your interests.</p>
      </div>

      <Card title="Your interests" icon="interests">
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <span key={i} className="px-3 py-1 rounded-full bg-[#EEF2FF] text-[#2F4FD1] border border-[#C7D2FE] text-label-md">
              {i}
            </span>
          ))}
        </div>
      </Card>

      <section>
        <h2 className="font-headline text-headline-md mb-space-md">Recommended research areas</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">
          {AREAS.map((a) => (
            <article key={a.title} className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-headline text-headline-sm leading-snug">{a.title}</h3>
                <span className="text-label-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                  {a.confidence}% match
                </span>
              </div>
              <p className="text-body-sm text-tertiary">{a.colleges.join(" • ")}</p>
              <div className="flex flex-wrap gap-1">
                {a.skills.map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-surface-container text-xs rounded">{s}</span>
                ))}
              </div>
              <p className="text-xs text-on-surface-variant">{a.stats}</p>
              <p className="text-body-sm text-tertiary">
                <strong className="text-on-surface">Why this fits:</strong> {a.why}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-headline text-headline-md mb-space-md">Faculty to know</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">
          {MENTORS.map((m) => (
            <article key={m.id} className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-primary-fixed text-primary font-headline flex items-center justify-center">{m.initials}</div>
                <div>
                  <h3 className="text-label-lg font-bold">{m.name}</h3>
                  <p className="text-xs text-tertiary">{m.role}</p>
                </div>
              </div>
              <p className="text-body-sm text-tertiary mb-3">
                <strong className="text-on-surface">Mentorship focus:</strong> {m.focus}
              </p>
              <button className="px-3 py-1.5 rounded-lg border border-surface-container-highest text-label-md hover:bg-surface-container-low">
                Request mentorship info
              </button>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-space-md">
          <h2 className="font-headline text-headline-md">Verified opportunities</h2>
          <Link href="/opportunities" className="text-label-lg text-primary hover:underline inline-flex items-center gap-1">
            View all <Icon name="arrow_forward" size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
          {opportunities.slice(0, 2).map((o) => (
            <OpportunityCard key={o.id} opp={o} />
          ))}
        </div>
      </section>

      <Card title="Your application readiness" icon="task_alt" aside={<span className="text-label-md text-tertiary">{done} of {READINESS.length} complete</span>}>
        <div className="w-full bg-surface-container-high h-2 rounded-full mb-4 overflow-hidden">
          <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${(done / READINESS.length) * 100}%` }} />
        </div>
        <ul className="space-y-2 text-label-md">
          {READINESS.map((r) => (
            <li key={r.label} className="flex items-center gap-2.5">
              <Icon name={r.done ? "check_circle" : "radio_button_unchecked"} size={18} className={r.done ? "text-emerald-600" : "text-outline"} />
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
