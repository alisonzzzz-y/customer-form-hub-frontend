import { useState, useRef } from "react";
import { Ticket } from "./api";
import { Screen, ToastMsg } from "./types";
import { Sidebar, Toast } from "./components/shared";
import { LoginScreen } from "./screens/LoginScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { AnswerReviewScreen } from "./screens/AnswerReviewScreen";
import { IntakeUploadScreen } from "./screens/IntakeUploadScreen";
import { IntakeCheckScreen } from "./screens/IntakeCheckScreen";
import { ClarificationEmailScreen } from "./screens/ClarificationEmailScreen";
import { QuestionExtractionScreen } from "./screens/QuestionExtractionScreen";
import { SMEPackageScreen } from "./screens/SMEPackageScreen";
import { ETATrackingScreen } from "./screens/ETATrackingScreen";
import { ReminderEmailScreen } from "./screens/ReminderEmailScreen";
import { FinalReviewScreen } from "./screens/FinalReviewScreen";

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [smeReturned, setSmeReturned] = useState(false);
  const [ticketCompleted, setTicketCompleted] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const idRef = useRef(0);

  const addToast = (message: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now() + ++idRef.current;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  };
  const removeToast = (id: number) =>
    setToasts((p) => p.filter((t) => t.id !== id));
  const addLog = (e: string) => setLog((p) => [...p, e]);

  // Not logged in → show the login screen
  if (!currentUser) {
    return <LoginScreen onLogin={(name) => setCurrentUser(name)} />;
  }

  return (
    <div
      className="h-screen w-screen flex overflow-hidden bg-[#F5F4F1]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <Sidebar
        screen={screen}
        setScreen={setScreen}
        currentUser={currentUser}
        onLogout={() => setCurrentUser(null)}
      />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {screen === "dashboard" && (
          <DashboardScreen
            setScreen={setScreen}
            ticketCompleted={ticketCompleted}
            setActiveTicket={setActiveTicket}
          />
        )}
        {screen === "intake-upload" && (
          <IntakeUploadScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
          />
        )}
        {screen === "intake-check" && (
          <IntakeCheckScreen
            setScreen={setScreen}
            intakeComplete={intakeComplete}
            addToast={addToast}
            addLog={addLog}
            onSimulateReply={() => setIntakeComplete(true)}
          />
        )}
        {screen === "clarification-email" && (
          <ClarificationEmailScreen
            setScreen={setScreen}
            onSimulateReply={() => setIntakeComplete(true)}
            addToast={addToast}
            addLog={addLog}
          />
        )}
        {screen === "question-extraction" && (
          <QuestionExtractionScreen setScreen={setScreen} addLog={addLog} />
        )}
        {screen === "answer-review" && (
          <AnswerReviewScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
            activeTicket={activeTicket}
          />
        )}
        {screen === "sme-package" && (
          <SMEPackageScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
          />
        )}
        {screen === "eta-tracking" && (
          <ETATrackingScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
            smeReturned={smeReturned}
            setSmeReturned={setSmeReturned}
            activeTicket={activeTicket}
          />
        )}
        {screen === "reminder-email" && (
          <ReminderEmailScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
          />
        )}
        {screen === "final-review" && (
          <FinalReviewScreen
            setScreen={setScreen}
            addToast={addToast}
            addLog={addLog}
            onComplete={() => setTicketCompleted(true)}
            smeReturned={smeReturned}
          />
        )}
      </main>
      <Toast toasts={toasts} remove={removeToast} />
    </div>
  );
}
