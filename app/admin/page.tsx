import Link from "next/link";
import { listCohortSummaries, getCohort } from "@/lib/store";
import { getAdminBasePath } from "@/lib/admin-base-path";
import { LogoutButton } from "./_components/LogoutButton";
import { CreateCohortForm } from "./_components/CreateCohortForm";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [summaries, adminBase] = await Promise.all([listCohortSummaries(), getAdminBasePath()]);
  const cohorts = (await Promise.all(summaries.map((s) => getCohort(s.id)))).filter(
    (c) => c !== null
  );

  return (
    <main className="min-h-screen p-8 md:p-12 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-12">
        <div>
          <div className="text-[13px] tracking-[6px] text-academy-yellow font-semibold uppercase">
            The Gen Academy
          </div>
          <h1 className="text-3xl font-bold mt-2">Certificate admin</h1>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-[3px] text-muted-grey font-semibold">
            Cohorts
          </h2>
          {cohorts.length === 0 && (
            <div className="brand-card p-8 text-muted-grey text-sm text-center">
              No cohorts yet — create one to get started.
            </div>
          )}
          {cohorts.map((cohort) => {
            const issued = cohort.students.filter((s) => s.credentialId).length;
            return (
              <Link
                key={cohort.id}
                href={`${adminBase}/cohorts/${cohort.id}`}
                className="brand-card p-6 flex items-center justify-between hover:border-academy-yellow/40 hover:-translate-y-0.5 transition"
              >
                <div>
                  <div className="font-bold text-lg">{cohort.courseName}</div>
                  <div className="text-sm text-muted-grey mt-0.5">{cohort.cohortLabel}</div>
                </div>
                <div className="text-sm text-right">
                  <div className="text-academy-yellow font-semibold">
                    {issued}/{cohort.students.length} issued
                  </div>
                  <div className="text-muted-grey mt-0.5">
                    {new Date(cohort.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <CreateCohortForm adminBase={adminBase} />
      </div>
    </main>
  );
}
