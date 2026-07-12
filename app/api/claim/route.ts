import { NextRequest, NextResponse } from "next/server";
import { findByIdentity, getMissingRequirements, getWeeklySubmissions } from "@/lib/store";
import { generateCertificateForStudent } from "@/lib/generate-certificate";
import { buildLinkedInAddUrl } from "@/lib/linkedin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const ASSESSMENT_FORM_URL = "https://docs.google.com/forms/d/1s1iU5O3MTMqbAvx-I2gjtFXrEQp_xkg3msZvPLCluqg/";

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  return url.replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  // Cheap first line of defense against hammering this public, unauthenticated
  // endpoint — a match here can trigger a real Chromium render below.
  if (!(await checkRateLimit(`claim:${ip}`, 10, 60))) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a minute and try again." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { error: "First name, last name, and email are required" },
      { status: 400 }
    );
  }

  if (!(await checkRateLimit(`claim-identity:${email.toLowerCase()}`, 5, 60))) {
    return NextResponse.json(
      { error: "Too many attempts for this email — please wait a minute and try again." },
      { status: 429 }
    );
  }

  try {
    const matches = await findByIdentity(firstName, lastName, email);

    if (matches.length === 0) {
      return NextResponse.json(
        {
          error:
            "We couldn't find an enrollment matching those details. Please finish the Week 2 and Week 3 projects, and then complete the assessment.",
        },
        { status: 404 }
      );
    }

    // Only generate for enrollments that have never been issued — never
    // auto-regenerate a revoked one, revocation must stick until an admin
    // explicitly restores it.
    const pending = matches.filter((m) => !m.student.credentialId && !m.student.revokedAt);
    const missingByMatch: string[][] = [];
    if (pending.length > 0) {
      // First person to verify triggers generation on the spot instead of
      // requiring an admin to have already clicked "Generate certificates."
      // Patch the in-memory match with the result directly rather than
      // re-running findByIdentity (which re-reads every cohort) — a re-read
      // right behind the write we just made can lag anyway.
      const weeklySubmissionsByCohort = new Map<
        string,
        [Awaited<ReturnType<typeof getWeeklySubmissions>>, Awaited<ReturnType<typeof getWeeklySubmissions>>]
      >();
      for (const match of pending) {
        let missing: string[] = [];
        if (match.student.source !== "manual") {
          let lists = weeklySubmissionsByCohort.get(match.cohort.id);
          if (!lists) {
            lists = await Promise.all([
              getWeeklySubmissions(match.cohort.id, "week2"),
              getWeeklySubmissions(match.cohort.id, "week3"),
            ]);
            weeklySubmissionsByCohort.set(match.cohort.id, lists);
          }
          missing = getMissingRequirements(lists[0], lists[1], match.student.email);
        }
        if (missing.length > 0) {
          missingByMatch.push(missing);
          continue;
        }
        try {
          const result = await generateCertificateForStudent(match.cohort, match.student.id);
          match.student.credentialId = result.credentialId;
          match.student.certificateUrl = result.certificateUrl;
          match.student.issuedAt = result.issuedAt;
        } catch (error) {
          console.error(
            `Failed to generate certificate for student ${match.student.id} in cohort ${match.cohort.id}:`,
            error
          );
        }
      }
    }

    const issued = matches.filter(
      (m) =>
        m.student.credentialId &&
        m.student.certificateUrl &&
        m.student.issuedAt &&
        !m.student.revokedAt
    );

    if (issued.length === 0) {
      const revoked = matches.filter((m) => m.student.revokedAt);
      if (revoked.length > 0) {
        const courses = revoked.map((m) => m.cohort.courseName).join(", ");
        return NextResponse.json(
          {
            status: "revoked",
            message: `Your certificate for ${courses} has been revoked and is no longer valid. Contact The Gen Academy if you believe this is a mistake.`,
          },
          { status: 200 }
        );
      }
      if (missingByMatch.length > 0) {
        const uniqueMissing = Array.from(new Set(missingByMatch.flat()));
        return NextResponse.json(
          {
            status: "pending",
            message: `You're almost there — please submit your ${uniqueMissing.join(" and ")} before your certificate can be issued.`,
          },
          { status: 200 }
        );
      }
      return NextResponse.json(
        {
          status: "pending",
          message:
            "You've completed Week 2 and Week 3 — please finish the assessment to receive your certificate.",
          actionUrl: ASSESSMENT_FORM_URL,
          actionLabel: "Go to assessment",
        },
        { status: 200 }
      );
    }

    const baseUrl = getBaseUrl();
    const certificates = issued.map(({ cohort, student }) => {
      const verifyUrl = `${baseUrl}/verify/${student.credentialId}`;
      const issuedAt = new Date(student.issuedAt!);
      return {
        firstName: student.firstName,
        courseName: cohort.courseName,
        cohortLabel: cohort.cohortLabel,
        credentialId: student.credentialId!,
        certificateUrl: student.certificateUrl!,
        verifyUrl,
        issuedAt: issuedAt.toISOString(),
        linkedInAddUrl: buildLinkedInAddUrl({
          courseName: cohort.courseName,
          credentialId: student.credentialId!,
          verifyUrl,
          issuedAt,
        }),
      };
    });

    return NextResponse.json({ status: "issued", certificates });
  } catch (error) {
    console.error("Failed to process claim:", error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
