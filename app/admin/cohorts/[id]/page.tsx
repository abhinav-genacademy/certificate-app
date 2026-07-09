import Link from "next/link";
import { notFound } from "next/navigation";
import { getCohort, getMissingRequirements, getWeeklySubmissions } from "@/lib/store";
import { getAdminBasePath } from "@/lib/admin-base-path";
import { AddStudentForm } from "./_components/AddStudentForm";
import { GenerateButton } from "./_components/GenerateButton";
import { GenerateOneButton } from "./_components/GenerateOneButton";
import { RevokeButton } from "./_components/RevokeButton";
import { DeleteButton } from "./_components/DeleteButton";
import { RequirementListsForm } from "./_components/RequirementListsForm";

export const dynamic = "force-dynamic";

export default async function CohortDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [cohort, adminBase, week2, week3] = await Promise.all([
    getCohort(id),
    getAdminBasePath(),
    getWeeklySubmissions(id, "week2"),
    getWeeklySubmissions(id, "week3"),
  ]);

  if (!cohort) notFound();

  const students = [...cohort.students].sort((a, b) => {
    const byLast = a.lastName.localeCompare(b.lastName);
    return byLast !== 0 ? byLast : a.firstName.localeCompare(b.firstName);
  });
  const pendingCount = students.filter((s) => !s.credentialId).length;

  return (
    <main className="min-h-screen p-8 md:p-12 max-w-5xl mx-auto">
      <Link href={adminBase} className="text-sm text-muted-grey hover:text-academy-yellow">
        &larr; All cohorts
      </Link>

      <div className="flex items-center justify-between mt-5 mb-10">
        <div>
          <h1 className="text-2xl font-bold">{cohort.courseName}</h1>
          <div className="text-muted-grey mt-1">{cohort.cohortLabel}</div>
        </div>
        <GenerateButton cohortId={cohort.id} pendingCount={pendingCount} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 flex flex-col gap-8">
          <RequirementListsForm
            cohortId={cohort.id}
            week2Count={week2?.length ?? null}
            week3Count={week3?.length ?? null}
          />
          <AddStudentForm cohortId={cohort.id} />
        </div>

        <div className="md:col-span-2 brand-card p-7 overflow-x-auto">
          <h2 className="text-lg font-bold mb-5">
            Roster <span className="text-muted-grey text-sm font-normal">({students.length})</span>
          </h2>
          {students.length === 0 ? (
            <p className="text-sm text-muted-grey">
              No one on the roster yet — upload Week 2 and Week 3 project lists, or add someone
              manually.
            </p>
          ) : (
            <table className="w-full text-sm border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left text-muted-grey text-xs uppercase tracking-[1px]">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Credential ID</th>
                  <th className="py-2 pr-3 font-medium">Certificate</th>
                  <th className="py-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-white/[0.03] rounded-lg">
                    <td className="py-2.5 pr-3 rounded-l-lg">
                      {student.firstName} {student.lastName}
                      {student.source === "manual" && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-grey align-middle">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-grey">{student.email}</td>
                    <td className="py-2.5 pr-3">
                      {student.revokedAt ? (
                        <span className="inline-flex items-center gap-1.5 text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Revoked
                        </span>
                      ) : student.credentialId ? (
                        <span className="inline-flex items-center gap-1.5 text-academy-yellow">
                          <span className="w-1.5 h-1.5 rounded-full bg-academy-yellow" />
                          Issued
                        </span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 text-muted-grey">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/25" />
                            Pending
                          </span>
                          {(() => {
                            if (student.source === "manual") return null;
                            const missing = getMissingRequirements(week2, week3, student.email);
                            return missing.length > 0 ? (
                              <span className="text-[11px] text-muted-grey pl-3">
                                Missing: {missing.join(", ")}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {student.credentialId ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {student.certificateUrl && student.credentialId ? (
                        <a
                          href={`/verify/${student.credentialId}`}
                          target="_blank"
                          className="text-academy-yellow hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-3 rounded-r-lg">
                      <div className="flex items-center gap-3">
                        {student.credentialId ? (
                          <RevokeButton
                            cohortId={cohort.id}
                            studentId={student.id}
                            revoked={Boolean(student.revokedAt)}
                          />
                        ) : (
                          <GenerateOneButton cohortId={cohort.id} studentId={student.id} />
                        )}
                        <DeleteButton
                          cohortId={cohort.id}
                          studentId={student.id}
                          studentName={`${student.firstName} ${student.lastName}`.trim()}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
