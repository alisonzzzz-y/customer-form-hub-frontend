export type Screen =
  | "dashboard"
  | "intake-upload"
  | "intake-check"
  | "clarification-email"
  | "question-extraction"
  | "answer-review"
  | "sme-package"
  | "eta-tracking"
  | "reminder-email"
  | "final-review";

export type ToastMsg = {
  id: number;
  message: string;
  type: "success" | "info" | "warning";
};
