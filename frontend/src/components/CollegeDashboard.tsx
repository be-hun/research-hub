import Link from "next/link";
import AwardRow from "@/components/AwardRow";
import BarList from "@/components/charts/BarList";
import YearBars from "@/components/charts/YearBars";
import { ConfidenceChip } from "@/components/ConfidenceNotice";
import Section from "@/components/Section";
import { COLLEGES } from "@/lib/colleges";
import { count } from "@/lib/format";
import { trendData } from "@/lib/series";
import type { CollegeDashboard as Dashboard } from "@/lib/types";

const TOPIC_COLOR = "#6B6862"; // one neutral hue: the bars compare length, not identity

export default function CollegeDashboard({ d }: { d: Dashboard }) {
  const c = d.college;
  const total = c.awards + c.trials + c.publications;
  const trend = trendData(d.trend);
  const fy = d.fundingYears.length ? `FY${d.fundingYears[0]}–FY${d.fundingYears[1]}` : "";

  if (total === 0) {
    return (
      <div className="bg-surface border border-line rounded-xl px-6 py-10 text-center">
        <h2 className="text-h2">No records mapped to this college yet</h2>
        <p className="text-body text-ink-2 mt-2 max-w-xl mx-auto">
          None of the public sources we import name this college on a grant, trial or publication. That does not mean
          there is no research here: many records only name the university, or a unit we can&apos;t map yet.
        </p>
        <Link href="/search" className="inline-block mt-5 text-cherry underline underline-offset-2">
          Search all records
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="grid lg:grid-cols-2 gap-12">
        <Section title="Grant funding over time" subtitle={fy ? `Money obligated each fiscal year, ${fy}, by funder` : "Money obligated each fiscal year"}>
          {d.trend.length ? (
            <YearBars caption={`${c.name}: grant funding by fiscal year`} data={trend.data} series={trend.series} />
          ) : (
            <p className="text-small text-ink-3">No grant funding recorded for this college since FY2022.</p>
          )}
          <p className="text-tiny text-ink-3 mt-3">Funding totals show how much was awarded, not the quality or impact of the research.</p>
        </Section>

        <Section title="Top research topics" subtitle="Records in this college with each topic">
          {d.topics.length ? (
            <BarList
              caption={`${c.name}: records by topic`}
              rows={d.topics.map((t) => ({
                key: t.id,
                label: t.name,
                href: `/search?college=${c.id}&topic=${t.id}`,
                color: TOPIC_COLOR,
                value: t.records,
                valueLabel: count(t.records, "record"),
                detail: count(t.awards, "grant"),
              }))}
            />
          ) : (
            <p className="text-small text-ink-3">No topics assigned to these records.</p>
          )}
        </Section>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.6fr] gap-12">
        <Section id="researchers" title="Researchers" subtitle="Most public records first; not a measure of impact">
          {d.researchers.length ? (
            <ul className="bg-surface border border-line rounded-xl divide-y divide-line">
              {d.researchers.map((r) => (
                <li key={r.researcherId} className="px-4 py-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/researchers/${r.researcherId}`} className="font-medium hover:text-cherry">
                      {r.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-tiny text-ink-3">
                      {r.department && <span>{r.department}</span>}
                      {r.identityConfidence !== "high" && <ConfidenceChip confidence={r.identityConfidence} />}
                    </div>
                  </div>
                  <span className="text-small text-ink-3 num shrink-0">{count(r.records, "record")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-ink-3">No researcher profiles are assigned to this college.</p>
          )}
        </Section>

        <Section title="Research with other colleges" subtitle="Grants with investigators from this college and another">
          {d.partners.length > 0 && (
            <p className="text-small text-ink-2 mb-4">
              {d.partners.map((p, i) => (
                <span key={p.college}>
                  {i > 0 && " · "}
                  <Link href={`/colleges/${p.college}`} className="text-cherry hover:underline underline-offset-2">
                    {COLLEGES[p.college].short}
                  </Link>{" "}
                  <span className="num text-ink-3">({count(p.records, "grant")})</span>
                </span>
              ))}
            </p>
          )}
          {d.crossCollege.length ? (
            <ul className="bg-surface border border-line rounded-xl px-4 sm:px-5">
              {d.crossCollege.map((p) => (
                <AwardRow key={p.id} project={p} />
              ))}
            </ul>
          ) : (
            <p className="text-small text-ink-3">No grants here list investigators from another college.</p>
          )}
        </Section>
      </div>

      <Section title="Recent records" subtitle="Newest start date first" action={{ href: `/search?college=${c.id}`, label: `All ${total.toLocaleString()}` }}>
        <ul className="bg-surface border border-line rounded-xl px-4 sm:px-5">
          {d.recent.map((p) => (
            <AwardRow key={p.id} project={p} />
          ))}
        </ul>
      </Section>

      <Section title="Coverage and limitations">
        <div className="grid md:grid-cols-2 gap-8 text-small text-ink-2">
          <div>
            <table className="w-full">
              <caption className="sr-only">Records in this college by source</caption>
              <thead>
                <tr className="text-left text-ink-3 text-tiny">
                  <th className="font-semibold py-1 pr-3">Source</th>
                  <th className="font-semibold py-1 pr-3">Covers</th>
                  <th className="font-semibold py-1 text-right">Records</th>
                </tr>
              </thead>
              <tbody>
                {d.sources.map((s) => (
                  <tr key={s.label} className="border-t border-line align-top">
                    <td className="py-1.5 pr-3">
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-cherry underline underline-offset-2">
                        {s.label}
                      </a>
                    </td>
                    <td className="py-1.5 pr-3 text-ink-3">{s.coverage}</td>
                    <td className="py-1.5 text-right num">{s.records.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Colleges come from what each source reports. Some are inferred from an NSF directorate, a trial site, or the
              investigators&apos; other records, and may be wrong.
            </li>
            <li>
              {count(d.unassignedRecords, "record")} across Temple name no college we can map, so they appear on no
              college page.
            </li>
            <li>Grant records are funding history, not proof that a study is active or recruiting.</li>
            <li>
              Researchers are matched across sources by name, which can combine different people. Profiles marked
              &ldquo;Name match&rdquo; are not confirmed.
            </li>
            {d.trend.some((y) => y.mayBeIncomplete) && <li>The latest fiscal year may be incomplete.</li>}
          </ul>
        </div>
      </Section>
    </div>
  );
}
