"use client";
import { useState } from "react";
import "./ai-diagnostic-builder.css";

type GeneratedQuestion = { text: string; options: string[]; correctIndex: number; skill: string };

type Props = {
  subjectId: string;
  subjectName: string;
  title: string;
  onTitleChange: (title: string) => void;
  onGenerated: (questions: GeneratedQuestion[]) => void;
  onMessage: (message: string) => void;
};

export default function AiDiagnosticBuilder({ subjectId, subjectName, title, onTitleChange, onGenerated, onMessage }: Props) {
  const [sourceType, setSourceType] = useState<"topic" | "file" | "url">("topic");
  const [command, setCommand] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("متدرج");
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [manualAvailable, setManualAvailable] = useState(false);

  function continueManually() {
    const drafts = Array.from({ length: Math.min(30, Math.max(3, count)) }, () => ({
      text: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      skill: "",
    }));
    onGenerated(drafts);
    if (!title.trim()) onTitleChange(`اختبار تشخيصي — ${subjectName}`);
    onMessage(`تم تجهيز ${drafts.length} أسئلة فارغة. اكتب الأسئلة والخيارات ثم احفظ الاختبار أو انشره.`);
    requestAnimationFrame(() => document.getElementById("manual-diagnostic-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function generate() {
    if (!title.trim()) return onMessage("اكتب عنوان الاختبار أولًا.");
    if (!command.trim() && sourceType === "topic") return onMessage("اكتب أوامرك للذكاء الاصطناعي، مثل موضوع الاختبار ونوع الأسئلة.");

    const form = new FormData();
    form.set("subjectId", subjectId);
    form.set("sourceType", sourceType);
    form.set("topic", command);
    form.set("url", url);
    form.set("conditions", `${command}\nنوّع مواضع الإجابات الصحيحة بالتساوي بين الخيارات الأربعة، ولا تجعل الإجابة الصحيحة دائمًا في الموضع نفسه.`);
    form.set("count", String(count));
    form.set("difficulty", difficulty);
    form.set("grade", grade);
    if (file) form.set("file", file);

    setLoading(true);
    setManualAvailable(false);
    onMessage("جارٍ تنفيذ أوامرك وإنشاء الاختبار…");
    try {
      const response = await fetch("/api/teacher/diagnostics/generate", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 503) {
          setManualAvailable(true);
          onMessage("خدمة الذكاء الاصطناعي غير مفعلة حاليًا. يلزم تفعيل AI Gateway، ويمكنك المتابعة يدويًا الآن.");
          return;
        }
        onMessage(data.message || "تعذر إنشاء الاختبار.");
        return;
      }
      onGenerated(data.questions);
      onMessage(`تم إنشاء اختبار «${title.trim()}» وفيه ${data.questions.length} أسئلة. راجعه قبل النشر.`);
      requestAnimationFrame(() => document.getElementById("manual-diagnostic-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setManualAvailable(true);
      onMessage("تعذر الاتصال بخدمة التوليد الذكي، ويمكنك متابعة إنشاء الاختبار يدويًا.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="ai-test-builder">
    <header><div><span>✦ إنشاء بالأوامر</span><h2>قل للذكاء الاصطناعي ماذا تريد</h2><p>اكتب عنوان الاختبار ثم أعطه أمرك، وسيجهز الأسئلة والخيارات والإجابات والمهارات.</p></div></header>

    <label>عنوان الاختبار
      <input value={title} onChange={event => onTitleChange(event.target.value)} placeholder="مثال: الاختبار التشخيصي للوحدة الأولى" />
    </label>

    <label>أوامر المعلم
      <textarea value={command} onChange={event => setCommand(event.target.value)} placeholder="مثال: أنشئ ١٠ أسئلة اختيار من متعدد عن الدولة السعودية الأولى للصف الثاني الثانوي، متدرجة الصعوبة، تقيس الفهم لا الحفظ، ونوّع أماكن الإجابات الصحيحة." />
    </label>

    <div className="source-tabs">
      <button type="button" className={sourceType === "topic" ? "active" : ""} onClick={() => setSourceType("topic")}>من الأوامر فقط</button>
      <button type="button" className={sourceType === "file" ? "active" : ""} onClick={() => setSourceType("file")}>أوامر + ملف</button>
      <button type="button" className={sourceType === "url" ? "active" : ""} onClick={() => setSourceType("url")}>أوامر + رابط</button>
    </div>

    {sourceType === "file" && <label className="file-drop">الملف المرجعي<input type="file" accept=".pdf,.txt,.csv,.md,.json" onChange={event => setFile(event.target.files?.[0] || null)} /><small>{file?.name || "PDF أو ملف نصي — حتى ٨ ميجابايت"}</small></label>}
    {sourceType === "url" && <label>رابط المحتوى<input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" /></label>}

    <div className="generation-rules">
      <label>عدد الأسئلة<input type="number" min="3" max="30" value={count} onChange={event => setCount(Number(event.target.value))} /></label>
      <label>الصعوبة<select value={difficulty} onChange={event => setDifficulty(event.target.value)}><option>سهل</option><option>متوسط</option><option>متدرج</option><option>متقدم</option></select></label>
      <label>الصف<input value={grade} onChange={event => setGrade(event.target.value)} placeholder="الثاني الثانوي" /></label>
    </div>

    <div className="ai-builder-actions">
      <button type="button" className="generate-button" disabled={loading || !subjectId} onClick={generate}>{loading ? "جارٍ تنفيذ الأوامر…" : "✦ نفّذ الأوامر وأنشئ الاختبار"}</button>
      {manualAvailable && <button type="button" className="manual-fallback-button" onClick={continueManually}>متابعة يدويًا</button>}
    </div>
  </section>;
}
