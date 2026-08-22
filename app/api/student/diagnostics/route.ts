import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { readStudentAccessToken } from "../../../../lib/server/portal-auth";

function accessFrom(request: Request) {
  const header = request.headers.get("authorization") || "";
  return readStudentAccessToken(header.startsWith("Bearer ") ? header.slice(7) : "");
}

export async function GET(request: Request) {
  const access = accessFrom(request);
  if (!access) return NextResponse.json({ ok: false }, { status: 401 });
  const root = `portalV2Data/${access.teacherId}/subjects/${access.subjectId}`;
  const [tests, results] = await Promise.all([
    adminDb().collection(`${root}/diagnostics`).where("published", "==", true).get(),
    adminDb().collection(`${root}/diagnosticResults`).where("studentId", "==", access.studentId).get(),
  ]);
  const completed = new Map(results.docs.map((item) => [item.data().diagnosticId, item.data()]));
  const diagnostics = tests.docs.map((item) => {
    const data = item.data();
    const result = completed.get(item.id);
    return {
      id: item.id,
      title: data.title,
      instructions: data.instructions || "",
      questionCount: Array.isArray(data.questions) ? data.questions.length : 0,
      questions: result ? [] : (data.questions || []).map((question: Record<string, unknown>) => ({ id: question.id, text: question.text, options: question.options, skill: question.skill || "" })),
      completed: !!result,
      result: result ? { score: result.score, total: result.total, percentage: result.percentage, plan: result.teacherPlan || result.plan, weakSkills: result.weakSkills || [] } : null,
    };
  });
  return NextResponse.json({ ok: true, diagnostics });
}

export async function POST(request: Request) {
  const access = accessFrom(request);
  if (!access) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json();
  const diagnosticId = String(body?.diagnosticId || "");
  const answers = body?.answers && typeof body.answers === "object" ? body.answers as Record<string, number> : {};
  const root = `portalV2Data/${access.teacherId}/subjects/${access.subjectId}`;
  const resultId = `${diagnosticId}__${access.studentId}`;
  const resultRef = adminDb().collection(`${root}/diagnosticResults`).doc(resultId);
  if ((await resultRef.get()).exists) return NextResponse.json({ ok: false, message: "تم أداء هذا الاختبار مسبقًا" }, { status: 409 });
  const test = await adminDb().collection(`${root}/diagnostics`).doc(diagnosticId).get();
  if (!test.exists || test.data()?.published !== true) return NextResponse.json({ ok: false }, { status: 404 });
  const data = test.data()!;
  const questions = Array.isArray(data.questions) ? data.questions : [];
  let score = 0; const weakSkills = new Set<string>();
  for (const question of questions) {
    const correct = Number(answers[String(question.id)]) === Number(question.correctIndex);
    if (correct) score += 1; else if (question.skill) weakSkills.add(String(question.skill));
  }
  const total = questions.length;
  const percentage = total ? Math.round((score / total) * 100) : 0;
  const plans = data.plans || {};
  const plan = percentage >= 80 ? plans.high : percentage >= 50 ? plans.medium : plans.low;
  const result = { diagnosticId, studentId: access.studentId, teacherId: access.teacherId, subjectId: access.subjectId, score, total, percentage, plan: plan || "راجع المهارات التي لم تتقنها مع المعلم.", weakSkills: [...weakSkills], submittedAt: new Date().toISOString() };
  await resultRef.set(result);
  return NextResponse.json({ ok: true, result });
}
