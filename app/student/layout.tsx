import "./student-v3.css";
import "./student-subject-themes.css";
import StudentSecurity from "./student-security";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentSecurity>{children}</StudentSecurity>;
}
