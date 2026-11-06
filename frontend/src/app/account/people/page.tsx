import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/Icon";
import DiscoveryNote from "@/components/profile/DiscoveryNote";
import PersonRow from "@/components/profile/PersonRow";
import { getForYouPeople } from "@/lib/api";
import { demoProfileInput } from "@/lib/demo";

export const metadata: Metadata = { title: "People who share your interests" };

function PageLink({ page, children, label }: { page: number; children: React.ReactNode; label: string }) {
  return (
    <Link
      href={page > 1 ? `/account/people?page=${page}` : "/account/people"}
      aria-label={label}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-line-strong bg-surface text-small font-semibold text-ink-2 hover:border-cherry hover:text-cherry"
    >
      {children}
    </Link>
  );
}

/** Everyone who shares the demo profile's interests, 20 to a page, in the same order and with the same bands as For you. */
export default async function PeoplePage({ searchParams }: { searchParams: { page?: string } }) {
  const input = demoProfileInput();
  if (!input) redirect("/account");
  const requested = Math.max(1, Math.floor(Number(searchParams.page) || 1));
  const data = await getForYouPeople(input, requested);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  if (requested > pages) redirect(pages > 1 ? `/account/people?page=${pages}` : "/account/people");
  const first = (data.page - 1) * data.pageSize + 1;
  const last = first + data.results.length - 1;

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
        <section aria-labelledby="people-title" className="bg-surface border border-line rounded-xl shadow-card min-w-0">
          <div className="p-4 sm:p-6 border-b border-line">
            <nav aria-label="Breadcrumb" className="text-small text-ink-3 mb-2">
              <Link href="/account" className="hover:text-ink">My account</Link> <span aria-hidden="true">/</span>{" "}
              <span className="text-ink-2">People</span>
            </nav>
            <h1 id="people-title" className="text-[30px] leading-[38px] sm:text-h1 break-words">
              {data.total.toLocaleString()} {data.total === 1 ? "researcher shares" : "researchers share"} your interests
            </h1>
            <p className="text-small text-ink-3 mt-1">
              People with active or recent work that shares your topics or keywords, best overlap first. The same order,
              bands and ranks as on your account page and their own pages.
            </p>
          </div>
          {data.results.length ? (
            <ul className="divide-y divide-line px-4 sm:px-6">
              {data.results.map((p) => (
                <PersonRow key={p.researcherId} person={p} total={data.total} detailed />
              ))}
            </ul>
          ) : (
            <p className="p-6 text-small text-ink-3">No researchers share your interests yet. Add a topic or keyword on your account page.</p>
          )}
          {data.total > 0 && (
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 sm:px-6 py-4">
              <span className="text-small text-ink-3 num">
                {first.toLocaleString()}–{last.toLocaleString()} of {data.total.toLocaleString()} · page {data.page} of {pages}
              </span>
              <span className="flex items-center gap-2">
                {data.page > 1 && (
                  <PageLink page={data.page - 1} label="Previous page">
                    <Icon name="chevron_left" size={18} /> Previous
                  </PageLink>
                )}
                {data.page < pages && (
                  <PageLink page={data.page + 1} label="Next page">
                    Next <Icon name="chevron_right" size={18} />
                  </PageLink>
                )}
              </span>
            </nav>
          )}
        </section>
        <aside className="space-y-6 min-w-0 lg:sticky lg:top-20">
          <DiscoveryNote />
          <Link href="/account" className="inline-flex items-center gap-1 text-small font-semibold text-cherry hover:underline underline-offset-2">
            <Icon name="chevron_left" size={18} /> Back to your profile
          </Link>
        </aside>
      </div>
    </main>
  );
}
