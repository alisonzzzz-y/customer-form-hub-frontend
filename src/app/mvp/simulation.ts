// Simulated AI layer for the MVP (PRD §9). Heuristic stand-ins with the same
// contracts as the real /ai/* endpoints, so they can be swapped later without
// touching the UI (05_API_Specification §2).

import { MvpQuestion, NdaStatus, Urgency } from "./data";

// ─── Intake extraction from a pasted AE email ────────────────────────────────

export type IntakeExtraction = {
  customer: string;
  ae: string;
  aeEmail: string;
  urgency: Urgency | "";
  nda: NdaStatus | "";
  due: string; // ISO date or ""
  businessImpact: string;
  requestType: string;
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function parseDeadline(text: string): string {
  // "by 21 July", "by July 21st", "due 2026-07-21"
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const m1 = text.match(/\b(?:by|before|due(?:\s+by)?|deadline[^.\n]*?)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)/i);
  const m2 = text.match(/\b(?:by|before|due(?:\s+by)?)\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  let day = 0;
  let monthName = "";
  if (m1) {
    day = parseInt(m1[1], 10);
    monthName = m1[2].toLowerCase();
  } else if (m2) {
    day = parseInt(m2[2], 10);
    monthName = m2[1].toLowerCase();
  }
  const month = MONTHS.findIndex((m) => m.startsWith(monthName.slice(0, 3)));
  if (day >= 1 && day <= 31 && month >= 0 && monthName.length >= 3) {
    return `2026-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return "";
}

export function parseIntakeEmail(text: string): IntakeExtraction {
  const from = text.match(/From:\s*([^<\n]+?)\s*<([^>\s]+@[^>\s]+)>/i);
  let ae = from ? from[1].trim() : "";
  let aeEmail = from ? from[2].trim() : "";
  if (!ae) {
    const sig = text.match(/(?:thanks|best|regards|cheers)[,!]?\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (sig) ae = sig[1].trim();
  }
  if (!aeEmail) {
    const anyMail = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (anyMail) aeEmail = anyMail[0];
  }

  let customer = "";
  const suffix = text.match(
    /\b([A-Z][\w&-]*(?:\s+[A-Z][\w&-]*)*\s+(?:Inc|Corp|Corporation|Ltd|LLC|GmbH|Industries|Enterprises|Health|Group|Co))\b/,
  );
  if (suffix) customer = suffix[1];
  if (!customer) {
    const forMatch = text.match(/\bfor\s+([A-Z][\w-]+(?:\s+[A-Z][\w-]+){0,3})\b/);
    if (forMatch) customer = forMatch[1];
  }

  let urgency: Urgency | "" = "";
  if (/\burgent|asap|critical|immediately|blocking\b/i.test(text)) urgency = "High";
  else if (/\bno rush|low priority|whenever|no hurry\b/i.test(text)) urgency = "Low";
  else if (/\bsoon|priority|quickly\b/i.test(text)) urgency = "Medium";

  let nda: NdaStatus | "" = "";
  if (/\bno nda|without (an )?nda|nda (is )?(missing|not in place)\b/i.test(text)) nda = "Missing";
  else if (/\bnda (is )?in place|have (an|a signed) nda|under nda|signed (an )?nda\b/i.test(text)) nda = "In Place";
  else if (/\bnda\b/i.test(text)) nda = "Unknown";

  const impactParts: string[] = [];
  const dealType = text.match(/\b(renewal|expansion|new (?:deal|business|logo))\b/i);
  if (dealType) impactParts.push(dealType[1].charAt(0).toUpperCase() + dealType[1].slice(1).toLowerCase());
  const value = text.match(/[~$€£]\s?[\d,.]+\s?[kKmM]?(?:\s?ARR)?/);
  if (value) impactParts.push(value[0].replace(/^~/, "~").trim());

  const typeMatch = text.match(/\b(security questionnaire|due diligence(?:\s+form)?|vendor assessment|compliance (?:form|questionnaire)|procurement (?:form|questionnaire))\b/i);

  return {
    customer,
    ae,
    aeEmail,
    urgency,
    nda,
    due: parseDeadline(text),
    businessImpact: impactParts.join(", "),
    requestType: typeMatch ? typeMatch[1].replace(/\b\w/g, (c) => c.toUpperCase()) : "",
  };
}

export const SAMPLE_AE_EMAIL = `From: Jane Smith <jane.smith@cloudera.com>
To: gom-team@cloudera.com
Subject: Security questionnaire for Vandelay Industries — urgent

Hi GOM team,

Vandelay Industries sent over the attached security questionnaire as part of their renewal (~$450k ARR). They need the completed answers back by 21 July. We have an NDA in place with them.

This one is urgent — their legal review is blocking the renewal.

Thanks,
Jane Smith
Account Executive, EMEA`;

// ─── Question extraction + department classification ────────────────────────

type Template = {
  original: string;
  normalised: string;
  department: string;
  risk: "Low" | "Medium" | "High";
  confidence: number | null;
  suggestion?: { text: string; knowledgeId: number; reasoning: string };
  sharingStatus?: "Public" | "Internal" | "NDA Required";
  duplicateOfIndex?: number;
};

const TEMPLATES: Template[] = [
  {
    original: "Do you hold ISO27001?",
    normalised: "Does Cloudera hold ISO 27001 certification?",
    department: "Security", risk: "Medium", confidence: 0.96, sharingStatus: "Public",
    suggestion: {
      text: "Yes. Cloudera maintains an information security management system aligned with ISO 27001, with certification renewed annually.",
      knowledgeId: 88,
      reasoning: "Matched one approved Security knowledge entry (96% similarity).",
    },
  },
  {
    original: "Describe how data is encrypted in transit and at rest.",
    normalised: "How is customer data encrypted in transit and at rest?",
    department: "Security", risk: "Medium", confidence: 0.93, sharingStatus: "Internal",
    suggestion: {
      text: "All data in transit is encrypted using TLS 1.2 or higher; data at rest uses AES-256.",
      knowledgeId: 89,
      reasoning: "Matched approved Security encryption entry (93% similarity).",
    },
  },
  {
    original: "What is your employee turnover rate?",
    normalised: "What is the annual employee turnover rate?",
    department: "HR", risk: "Low", confidence: 0.42, sharingStatus: "NDA Required",
  },
  {
    original: "Do you maintain cyber insurance and at what coverage?",
    normalised: "Does Cloudera maintain cyber liability insurance, and at what coverage level?",
    department: "Finance", risk: "High", confidence: 0.78, sharingStatus: "NDA Required",
    suggestion: {
      text: "Cloudera maintains cyber liability insurance. Coverage levels are reviewed annually; details can be shared under NDA.",
      knowledgeId: 91,
      reasoning: "Matched Finance insurance entry (78% similarity) — medium confidence, review required.",
    },
  },
  {
    original: "Is a data processing agreement available?",
    normalised: "Is a standard data processing agreement (DPA) available?",
    department: "Legal", risk: "Medium", confidence: 0.91, sharingStatus: "Public",
    suggestion: {
      text: "Yes. A standard DPA incorporating the EU Standard Contractual Clauses is available and managed by the Legal team.",
      knowledgeId: 92,
      reasoning: "Matched approved Legal DPA entry (91% similarity).",
    },
  },
  {
    original: "What is your carbon neutrality target date?",
    normalised: "What is Cloudera's carbon neutrality target?",
    department: "ESG", risk: "Low", confidence: 0.88, sharingStatus: "Public",
    suggestion: {
      text: "Cloudera has published a sustainability roadmap targeting carbon neutrality for owned operations.",
      knowledgeId: 93,
      reasoning: "Matched ESG sustainability entry (88% similarity) — medium confidence, review required.",
    },
  },
  {
    original: "Provide your full list of sub-processors.",
    normalised: "Which sub-processors does Cloudera use?",
    department: "Legal", risk: "High", confidence: null,
  },
  {
    original: "Is data encrypted during transmission?",
    normalised: "How is customer data encrypted in transit?",
    department: "Security", risk: "Medium", confidence: 0.93, sharingStatus: "Internal",
    duplicateOfIndex: 1,
  },
];

// AI-01/AI-02: extraction + classification only. Suggestions come later, after
// the analyst confirms department grouping.
export function extractQuestionsFor(ticketId: string, baseId: number): MvpQuestion[] {
  return TEMPLATES.map((t, i) => ({
    id: baseId + i + 1,
    ticketId,
    row: i + 1,
    original: t.original,
    normalised: t.normalised,
    department: t.department,
    risk: t.risk,
    status: "AI Analysed",
    confidence: t.confidence,
    sharingStatus: t.sharingStatus,
    duplicateOf: t.duplicateOfIndex !== undefined ? baseId + t.duplicateOfIndex + 1 : undefined,
  }));
}

// AI-03/AI-04/AI-05: retrieval + suggestion per confidence band, applied once
// grouping is confirmed.
export function attachSuggestions(q: MvpQuestion): MvpQuestion {
  const template = TEMPLATES.find((t) => t.normalised === q.normalised);
  if (q.confidence !== null && q.confidence >= 0.7 && template?.suggestion) {
    return {
      ...q,
      suggested: template.suggestion,
      status: q.confidence >= 0.9 ? "Suggested" : "Needs Review",
    };
  }
  return { ...q, status: "New" }; // low/no confidence: research or SME required
}

// Simulated SME answer for a returned request
export function smeAnswerFor(q: MvpQuestion, assignee: string): string {
  return `[Returned by ${assignee}] ${q.normalised.replace(/\?$/, "")} — response provided in the returned Excel tab; reviewed and confirmed by the ${q.department} team.`;
}
