import { useState } from "react";
import { ChevronRight } from "lucide-react";

// ─── Screen: Login (lightweight demo auth, not real authentication) ────────────

export function LoginScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState("");

  function handleSubmit() {
    const trimmed = name.trim();
    if (trimmed) onLogin(trimmed);
  }

  return (
    <div
      className="h-screen w-screen flex items-center justify-center bg-[#F5F4F1]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-10 w-[380px] flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#F96702] flex items-center justify-center shadow-[0_2px_12px_rgba(249,103,2,0.4)]">
            <span className="text-white text-lg font-black">C</span>
          </div>
          <div className="text-center">
            <p className="text-[#0A0A0A] text-base font-bold tracking-tight">
              Cloudera GOM
            </p>
            <p className="text-[#9CA3AF] text-[10px] tracking-[0.14em] uppercase font-bold mt-0.5">
              Customer Form Workflow Hub
            </p>
          </div>
        </div>

        {/* Name input */}
        <div className="w-full flex flex-col gap-2">
          <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-[0.12em]">
            Analyst Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Enter your name to continue"
            autoFocus
            className="w-full px-4 py-3 text-sm border border-[rgba(0,0,0,0.12)] rounded-xl bg-[#FAFAF9] placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F96702]/30 focus:border-[#F96702]/50 focus:bg-white transition-all"
          />
        </div>

        {/* Enter button */}
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.07em] uppercase rounded-xl transition-all ${name.trim() ? "bg-[#F96702] text-white hover:bg-[#D95400] shadow-[0_2px_8px_rgba(249,103,2,0.3)]" : "bg-[#E8E6E3] text-[#ABABAB] cursor-not-allowed"}`}
        >
          Enter Workspace <ChevronRight size={13} />
        </button>

        <p className="text-[10px] text-[#9CA3AF] text-center leading-relaxed">
          Internal GOM tool · Demo sign-in for prototype
        </p>
      </div>
    </div>
  );
}
