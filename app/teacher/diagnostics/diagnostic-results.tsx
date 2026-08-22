"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import type { SubjectKey } from "../../../lib/subject-config";
import "./diagnostic-results.css";

type Diagnostic = { id: string; title: string };
type Student = { id: string; name?: string; class?: string; nationalId?: string };
type Result = {
  id: string;
  diagnosticId: string;
  studentId: string;
  score: number;
  total: number;
  percentage: number;
  plan?: string;
  weakSkills?: string[];
  teacherPlan?: string;
  submittedAt?: string;
};

function level(percentage: number) {
  if (percentage >= 80) return { label: "متقن", className: "high" };
  if (percentage >= 50) return { label: "يحتاج تحسين", className: "medium" };
  return { label: "يحتاج دعم علاجي", className: "low" };
}

function suggestedPlan(result: Result, studentName: string, subjectName: string) {
  const skills = result.weakSkills?.length ? result.weakSkills.join("، ") : "المهارات الأساسية في الاختبار";
  if (result.percentage >= 80) return `خطة إثرائية للطالب ${studentName} في مادة ${subjectName}: المحافظة على الإتقان، حل أنشطة إثرائية، وتطبيق المهارات في مواقف جديدة.`;
  if (result.percentage >= 50) return `خطة تحسين للطالب ${studentName} في مادة ${subjectName}: مراجعة ${skills}، حل تدريبات قصيرة متدرجة، ثم إعادة قياس بعد المتابعة.`;
  return `خطة علاجية للطالب ${studentName} في مادة ${subjectName}: شرح مبسط لمهارات ${skills}، تدريب موجه مع المعلم، واجب علاجي قصير، ثم إعادة الاختبار.`;
}

export default function DiagnosticResults({ teacherId, subjectKey, subjectName, diagnostics }: { teacherId: string; subjectKey: SubjectKey; subjectName: string; diagnostics: Diagnostic[] }) {
  const [results, setResults] = useState<Result[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedTest, setSelectedTest] = useState("all");
  const [editing, setEditing] = useState<Result | null>(null);
  const [planText, setPlanText] = useState("");
  const [message, setMessage] = useState("");

  const resultsPath = tenantCollection(teacherId, subjectKey, "diagnosticResults");
  const studentsPath = tenantCollection(teacherId, subjectKey, "students");

  useEffect(() => {
    const stopResults = onSnapshot(collection(db, resultsPath), snapshot => setResults(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Result, "id">) }))));
    const stopStudents = onSnapshot(collection(db, studentsPath), snapshot => setStudents(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Student, "id">) }))));
    return () => { stopResults(); stopStudents(); };
  }, [resultsPath, studentsPath]);

  const studentMap = useMemo(() => new Map(students.map(student => [student.id, student])), [students]);
  const testMap = useMemo(() => new Map(diagnostics.map(test => [test.id, test.title])), [diagnostics]);
  const visible = useMemo(() => results.filter(result => selectedTest === "all" || result.diagnosticId === selectedTest).sort((a, b) => b.percentage - a.percentage), [results, selectedTest]);
  const average = visible.length ? Math.round(visible.reduce((sum, item) => sum + item.percentage, 0) / visible.length) : 0;
  const weakSkills = useMemo(() => {
    const counts = new Map<string, number>();
    visible.forEach(result => (result.weakSkills || []).forEach(skill => counts.set(skill, (counts.get(skill) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [visible]);

  function openPlan(result: Result) {
    const student = studentMap.get(result.studentId);
    setEditing(result);
    setPlanText(result.teacherPlan || result.plan || suggestedPlan(result, student?.name || "الطالب", subjectName));
    setMessage("");
  }

  async function savePlan() {
    if (!editing || !planText.trim()) return;
    await updateDoc(doc(db, resultsPath, editing.id), { teacherPlan: planText.trim(), updatedAt: new Date().toISOString() });
    setEditing(null);
    setPlanText("");
    setMessage("تم حفظ الخطة العلاجية وستظهر للطالب.");
  }

  return <section className="diagnostic-results-panel" dir="rtl">
    <header className="results-heading"><div><small>المتابعة والتحليل</small><h2>نتائج الطلاب والخطط العلاجية</h2><p>عرض مباشر لدرجات الطلاب والمهارات الضعيفة والخطة المقترحة لكل طالب.</p></div><label>تصفية حسب الاختبار<select value={selectedTest} onChange={event => setSelectedTest(event.target.value)}><option value="all">جميع الاختبارات</option>{diagnostics.map(test => <option key={test.id} value={test.id}>{test.title}</option>)}</select></label></header>
    <div className="results-stats"><article><strong>{visible.length}</strong><span>نتيجة مسجلة</span></article><article><strong>{average}٪</strong><span>متوسط الأداء</span></article><article><strong>{visible.filter(item => item.percentage < 50).length}</strong><span>يحتاجون دعمًا علاجيًا</span></article><article><strong>{visible.filter(item => item.percentage >= 80).length}</strong><span>طلاب متقنون</span></article></div>
    {weakSkills.length ? <div className="weak-skills-summary"><b>أكثر المهارات حاجة للمراجعة</b>{weakSkills.map(([skill, count]) => <span key={skill}>{skill} <em>{count}</em></span>)}</div> : null}
    {message && <p className="diagnostic-message">{message}</p>}
    {!visible.length ? <p className="empty-results">لا توجد نتائج طلاب لهذا الاختبار حتى الآن.</p> : <div className="results-table-wrap"><table><thead><tr><th>الطالب</th><th>الفصل</th><th>الاختبار</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th><th>المهارات الضعيفة</th><th>الخطة العلاجية</th></tr></thead><tbody>{visible.map(result => { const student = studentMap.get(result.studentId); const status = level(result.percentage); return <tr key={result.id}><td data-label="الطالب"><strong>{student?.name || result.studentId}</strong></td><td data-label="الفصل">{student?.class || "غير محدد"}</td><td data-label="الاختبار">{testMap.get(result.diagnosticId) || "اختبار تشخيصي"}</td><td data-label="الدرجة">{result.score} من {result.total}</td><td data-label="النسبة"><b>{result.percentage}٪</b></td><td data-label="المستوى"><span className={`result-level ${status.className}`}>{status.label}</span></td><td data-label="المهارات">{result.weakSkills?.length ? result.weakSkills.join("، ") : "لا توجد مهارات ضعيفة"}</td><td data-label="الخطة"><button className="plan-button" onClick={() => openPlan(result)}>{result.teacherPlan ? "عرض وتعديل الخطة" : "إنشاء خطة علاجية"}</button></td></tr>; })}</tbody></table></div>}
    {editing && <div className="diagnostic-plan-modal" role="dialog" aria-modal="true"><section><header><div><small>خطة علاجية فردية</small><h3>{studentMap.get(editing.studentId)?.name || "الطالب"}</h3><p>الدرجة: {editing.score} من {editing.total} — {editing.percentage}٪</p></div><button onClick={() => setEditing(null)}>×</button></header><label>الخطة العلاجية<textarea value={planText} onChange={event => setPlanText(event.target.value)} rows={8} /></label><div className="modal-actions"><button onClick={() => setPlanText(suggestedPlan(editing, studentMap.get(editing.studentId)?.name || "الطالب", subjectName))}>توليد خطة مقترحة</button><button className="primary" onClick={savePlan}>حفظ وإظهارها للطالب</button></div></section></div>}
  </section>;
}
