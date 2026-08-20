"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import type { SubjectKey } from "../../../lib/subject-config";
import { useTeacherClient } from "../../../lib/teacher-client";
import AiDiagnosticBuilder from "./ai-diagnostic-builder";
import "./diagnostics.css";

type Question = { id: string; text: string; options: string[]; correctIndex: number; skill: string };
type Diagnostic = { id: string; title: string; instructions: string; published: boolean; questions: Question[]; plans: { low: string; medium: string; high: string } };
const newQuestion = (): Question => ({ id: crypto.randomUUID(), text: "", options: ["", "", "", ""], correctIndex: 0, skill: "" });
const emptyPlans = { low: "راجع المهارات الأساسية مع المعلم، ثم نفّذ أوراق العمل العلاجية وأعد التقييم.", medium: "راجع المهارات التي أخطأت فيها، ونفّذ تدريبًا قصيرًا قبل التقييم التالي.", high: "أداؤك متقن. انتقل إلى الأنشطة الإثرائية وحافظ على المراجعة المنتظمة." };

export default function DiagnosticsPage() {
  const session = useTeacherClient();
  const [items, setItems] = useState<Diagnostic[]>([]);
  const [title, setTitle] = useState(""); const [instructions, setInstructions] = useState("");
  const [questions, setQuestions] = useState<Question[]>([newQuestion()]); const [plans, setPlans] = useState(emptyPlans);
  const [message, setMessage] = useState("");
  const path = session?.teacherId && session.subjectKey ? tenantCollection(session.teacherId, session.subjectKey as SubjectKey, "diagnostics") : "";
  useEffect(() => { if (!path) return; return onSnapshot(collection(db, path), (snapshot) => setItems(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Diagnostic, "id">) })))); }, [path]);
  function updateQuestion(id: string, patch: Partial<Question>) { setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question)); }
  function useGenerated(generated: Array<Omit<Question, "id">>) { setQuestions(generated.map(question => ({ ...question, id: crypto.randomUUID() }))); if (!title.trim()) setTitle(`اختبار تشخيصي — ${session.subject || "المادة"}`); }
  async function save(published: boolean) {
    if (!path || !title.trim() || questions.some((question) => !question.text.trim() || question.options.some((option) => !option.trim()))) return setMessage("أكمل عنوان الاختبار وجميع الأسئلة والخيارات.");
    const id = crypto.randomUUID(); await setDoc(doc(db, path, id), { title: title.trim(), instructions: instructions.trim(), published, questions, plans, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setTitle(""); setInstructions(""); setQuestions([newQuestion()]); setPlans(emptyPlans); setMessage(published ? "تم نشر الاختبار في بوابة الطالب." : "تم حفظ الاختبار كمسودة.");
  }
  return <main className="diagnostics-page" dir="rtl"><section className="diagnostics-hero"><span>قياس وتشخيص</span><h1>الاختبارات التشخيصية والخطط العلاجية</h1><p>اكتب عنوان الاختبار وأوامرك، وسيجهز الذكاء الاصطناعي الأسئلة والخيارات والإجابات والمهارات.</p></section>
    <AiDiagnosticBuilder subjectId={session.subjectKey || ""} subjectName={session.subject || "المادة"} title={title} onTitleChange={setTitle} onGenerated={useGenerated} onMessage={setMessage} />
    <section id="manual-diagnostic-editor" className="diagnostic-builder"><header><div><h2>مراجعة الاختبار</h2><p>راجع الأسئلة وعدّلها قبل الحفظ أو النشر. الطالب يرى الاختبارات المنشورة فقط.</p></div></header><label>عنوان الاختبار<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="الاختبار التشخيصي الأول" /></label><label>تعليمات الطالب<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="اختر الإجابة الصحيحة لكل سؤال" /></label>
      <div className="questions-editor">{questions.map((question, index) => <article key={question.id}><header><strong>السؤال {index + 1}</strong>{questions.length > 1 && <button onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}>حذف</button>}</header><input value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} placeholder="نص السؤال" /><input value={question.skill} onChange={(event) => updateQuestion(question.id, { skill: event.target.value })} placeholder="المهارة التي يقيسها السؤال" />{question.options.map((option, optionIndex) => <label className="answer-option" key={optionIndex}><input type="radio" name={`correct-${question.id}`} checked={question.correctIndex === optionIndex} onChange={() => updateQuestion(question.id, { correctIndex: optionIndex })} /><input value={option} onChange={(event) => { const options = [...question.options]; options[optionIndex] = event.target.value; updateQuestion(question.id, { options }); }} placeholder={`الخيار ${optionIndex + 1}`} /></label>)}</article>)}</div><button className="add-question" onClick={() => setQuestions((current) => [...current, newQuestion()])}>+ إضافة سؤال</button>
      <section className="plan-editor"><h3>الخطة العلاجية حسب النتيجة</h3><label>أقل من ٥٠٪<textarea value={plans.low} onChange={(event) => setPlans({ ...plans, low: event.target.value })} /></label><label>من ٥٠٪ إلى ٧٩٪<textarea value={plans.medium} onChange={(event) => setPlans({ ...plans, medium: event.target.value })} /></label><label>٨٠٪ فأعلى<textarea value={plans.high} onChange={(event) => setPlans({ ...plans, high: event.target.value })} /></label></section>{message && <p className="diagnostic-message">{message}</p>}<div className="builder-actions"><button onClick={() => save(false)}>حفظ مسودة</button><button className="primary" onClick={() => save(true)}>نشر للطلاب</button></div></section>
    <section className="diagnostic-list"><h2>اختبارات المادة</h2>{!items.length && <p>لا توجد اختبارات حتى الآن.</p>}{items.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{item.questions.length} أسئلة • {item.published ? "منشور" : "مسودة"}</small></div><button onClick={() => path && deleteDoc(doc(db, path, item.id))}>حذف</button></article>)}</section></main>;
}
