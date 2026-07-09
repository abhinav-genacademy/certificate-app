import { NextRequest, NextResponse } from "next/server";
import { deleteStudent, setStudentRevoked } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const { id: cohortId, studentId } = await params;

  const body = await request.json().catch(() => null);
  const revoked = Boolean(body?.revoked);

  try {
    await setStudentRevoked(cohortId, studentId, revoked);
  } catch (error) {
    console.error(`Failed to update student ${studentId}:`, error);
    const message = error instanceof Error ? error.message : "Failed to update student";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const { id: cohortId, studentId } = await params;

  try {
    await deleteStudent(cohortId, studentId);
  } catch (error) {
    console.error(`Failed to delete student ${studentId}:`, error);
    const message = error instanceof Error ? error.message : "Failed to delete student";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
