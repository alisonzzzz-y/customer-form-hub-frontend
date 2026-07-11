import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { KnowledgeBaseScreen } from "./app/screens/KnowledgeBaseScreen";
import { Toast } from "./app/components/shared";
import { ToastMsg } from "./app/types";
import "./styles/index.css";

// Standalone dev preview for KnowledgeBaseScreen while its route is not yet
// wired into App.tsx (routing is done by Alison — see NOTES_FOR_ALISON.md).
// Served by Vite in dev only: http://localhost:<port>/kb-preview.html

function KbPreview() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const idRef = useRef(0);
  const addToast = (message: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now() + ++idRef.current;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  };
  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden bg-[#F5F4F1]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="px-4 py-1.5 bg-[#1A1A1A] text-white text-[10px] font-semibold tracking-[0.06em] uppercase shrink-0">
        Dev preview — KnowledgeBaseScreen (not yet routed in App)
      </div>
      <KnowledgeBaseScreen
        setScreen={() => addToast("Navigation is stubbed in this preview.", "info")}
        addToast={addToast}
        addLog={(e) => console.log("[activity log]", e)}
      />
      <Toast
        toasts={toasts}
        remove={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<KbPreview />);
