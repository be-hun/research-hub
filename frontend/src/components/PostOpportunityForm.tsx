"use client";

import { useState } from "react";
import { createOpportunity } from "@/lib/api";
import type { CollegeId, NewOpportunity, OpportunityType, StudentLevel } from "@/lib/types";

interface ProjectOption {
  id: string;
  title: string;
  colleges: CollegeId[];
}

const TYPES: { value: OpportunityType; label: string }[] = [
  { value: "research-assistant", label: "Research Assistant (RA)" },
  { value: "fellowship", label: "Paid Fellowship" },
  { value: "credit", label: "Academic Credit" },
  { value: "volunteer", label: "Volunteer / Shadowing" },
];

const LEVELS: { value: StudentLevel; label: string }[] = [
  { value: "undergraduate", label: "Undergraduate" },
  { value: "masters", label: "Master's / MPH / MS" },
  { value: "phd", label: "PhD / Post-bac" },
];

const inputCls =
  "w-full bg-white border border-outline rounded-lg px-3.5 py-2.5 text-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/15 focus:outline-none";

export default function PostOpportunityForm({ projects }: { projects: ProjectOption[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<OpportunityType>("research-assistant");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [levels, setLevels] = useState<StudentLevel[]>(["undergraduate"]);
  const [paid, setPaid] = useState(true);
  const [rate, setRate] = useState("");
  const [hours, setHours] = useState("10–15");
  const [term, setTerm] = useState("Fall 2025");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [persisted, setPersisted] = useState(false);

  const toggleLevel = (l: StudentLevel) =>
    setLevels((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const project = projects.find((p) => p.id === projectId);
    const body: NewOpportunity = {
      title,
      type,
      lab: "",
      sponsor: "",
      projectId: projectId || undefined,
      colleges: project?.colleges ?? [],
      description,
      skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      levels,
      paid,
      hourlyRate: paid && rate ? Number(rate) : undefined,
      hoursPerWeek: hours,
      term,
      deadline,
    };
    try {
      const res = await createOpportunity(body);
      setPersisted(res.persisted);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-6">
        <h2 className="font-headline text-headline-sm mb-1">Opportunity submitted</h2>
        <p className="text-body-md">
          {persisted
            ? "Your opening is published and will be matched with students."
            : "No backend is connected yet, so this opening was not saved."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="bg-white rounded-xl border border-surface-container-high p-6 space-y-4">
        <h2 className="font-headline text-headline-sm">1. Linked research context</h2>
        <label className="block">
          <span className="block text-label-lg mb-1.5">Associated project *</span>
          <select className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="bg-white rounded-xl border border-surface-container-high p-6 space-y-4">
        <h2 className="font-headline text-headline-sm">2. Opportunity details</h2>
        <label className="block">
          <span className="block text-label-lg mb-1.5">Title *</span>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Graduate Research Assistant – Computational Genomics"
            required
          />
        </label>
        <div>
          <span className="block text-label-lg mb-2">Type *</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`rounded-lg py-2 px-3 text-label-md border-2 ${
                  type === t.value ? "border-primary bg-primary/5 text-primary" : "border-outline text-tertiary hover:bg-surface-container-low"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="block text-label-lg mb-1.5">Position overview & research scope *</span>
          <textarea className={inputCls} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>
        <label className="block">
          <span className="block text-label-lg mb-1.5">Required skills (comma separated)</span>
          <input className={inputCls} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, SQL, HIPAA" />
        </label>
      </section>

      <section className="bg-white rounded-xl border border-surface-container-high p-6 space-y-4">
        <h2 className="font-headline text-headline-sm">3. Eligibility, commitment & compensation</h2>
        <div>
          <span className="block text-label-lg mb-2">Eligible academic level</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LEVELS.map((l) => (
              <label
                key={l.value}
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer ${
                  levels.includes(l.value) ? "border-primary bg-primary/5" : "border-outline"
                }`}
              >
                <input type="checkbox" checked={levels.includes(l.value)} onChange={() => toggleLevel(l.value)} className="rounded text-primary" />
                <span className="text-label-md">{l.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-label-lg mb-1.5">Weekly hours</span>
            <select className={inputCls} value={hours} onChange={(e) => setHours(e.target.value)}>
              <option>5–10</option>
              <option>10–15</option>
              <option>20</option>
              <option>35 (summer intensive)</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-label-lg mb-1.5">Start term</span>
            <select className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)}>
              <option>Spring 2025</option>
              <option>Summer 2025</option>
              <option>Fall 2025</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-label-lg mb-1.5">Application deadline *</span>
            <input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
          </label>
          <div>
            <span className="block text-label-lg mb-1.5">Compensation</span>
            <div className="flex items-center gap-2">
              <div className="flex bg-white p-1 rounded-lg border border-outline text-label-md">
                <button type="button" onClick={() => setPaid(true)} className={`px-3 py-1 rounded ${paid ? "bg-primary text-on-primary" : "text-tertiary"}`}>
                  Paid
                </button>
                <button type="button" onClick={() => setPaid(false)} className={`px-3 py-1 rounded ${!paid ? "bg-primary text-on-primary" : "text-tertiary"}`}>
                  Credit / Volunteer
                </button>
              </div>
              {paid && (
                <input
                  className={`${inputCls} !py-2`}
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="$ / hour"
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {status === "error" && <p className="text-error text-body-sm">Could not submit. Check the backend and try again.</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={status === "saving" || levels.length === 0}
          className="px-6 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg text-label-lg font-bold disabled:opacity-50"
        >
          {status === "saving" ? "Publishing…" : "Publish Opportunity"}
        </button>
      </div>
    </form>
  );
}
