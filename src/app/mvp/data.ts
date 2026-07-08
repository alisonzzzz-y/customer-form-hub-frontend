// Seeded demo data for the PRD-aligned MVP shell (PRD §16, NFR-07).
// All dates are UTC. Overdue logic is anchored to a fixed demo "now" so the
// story stays deterministic.

export const MOCK_NOW = new Date("2026-07-07T09:00:00Z");

export type Role = "Analyst" | "SME" | "Manager";

export type ModuleId =
  | "dashboard"
  | "tickets"
  | "ticket-detail"
  | "ai-search"
  | "knowledge-base"
  | "reports"
  | "notifications"
  | "settings";

// PRD §5.1 Global Status Tags
export type TicketStatus =
  | "New"
  | "AI Processing"
  | "Intake Review"
  | "In Progress"
  | "Waiting SME"
  | "Ready for Review"
  | "Approved"
  | "Sent"
  | "Closed"
  | "Archived";

export type QuestionStatus =
  | "New"
  | "AI Analysed"
  | "Suggested"
  | "Needs Review"
  | "SME Queued" // marked "route to SME" during review; not yet sent
  | "Waiting SME"
  | "SME Complete"
  | "Ready"
  | "Approved"
  | "Rejected";

// Guided workflow stage inside a ticket (mirrors the original prototype flow:
// intake → grouping → answer review → SME package → ETA tracking → final)
export type TicketStage =
  | "intake"
  | "grouping"
  | "review"
  | "sme"
  | "eta"
  | "final"
  | "done";

export type KnowledgeStatus =
  | "Draft"
  | "Pending Review"
  | "Approved"
  | "Deprecated"
  | "Archived";

export type SmeStatus =
  | "Requested"
  | "ETA Set"
  | "In Progress"
  | "Returned"
  | "Overdue"
  | "Escalated"
  | "Closed";

export type SharingStatus = "Public" | "Internal" | "NDA Required";
export type NdaStatus = "In Place" | "Missing" | "Unknown";
export type Urgency = "High" | "Medium" | "Low";

// PRD §4: department collections
export const DEPARTMENTS = [
  "Legal",
  "Finance",
  "Security",
  "HR",
  "ESG",
  "Product",
  "General",
];

export type MvpFile = {
  name: string;
  size: string;
  kind: string;
  uploaded: string;
  status: "Uploaded" | "Processing" | "Processed" | "Failed";
  supporting?: boolean;
};

export type MvpTicket = {
  id: string;
  backendId?: number; // id in Alison's backend once synced
  customer: string;
  sorId: string;
  owner: string;
  status: TicketStatus;
  stage: TicketStage;
  aeEmail?: string;
  due: string; // ISO date
  created: string;
  closed?: string;
  urgency: Urgency;
  nda: NdaStatus;
  region: string;
  source: string;
  businessImpact?: string;
  ae?: string;
  notes?: string;
  files: MvpFile[];
};

export type MvpQuestion = {
  id: number;
  backendId?: number;
  ticketId: string;
  row: number;
  original: string;
  normalised: string;
  department: string;
  risk: "Low" | "Medium" | "High";
  status: QuestionStatus;
  confidence: number | null; // null = no knowledge match
  suggested?: { text: string; knowledgeId: number; reasoning: string };
  // further KB matches above the backend's 0.35 threshold (top 3 total)
  alternatives?: {
    text: string;
    knowledgeId: number;
    confidence: number;
    reasoning: string;
    sharingStatus?: SharingStatus;
  }[];
  sharingStatus?: SharingStatus;
  finalAnswer?: {
    text: string;
    sourceType: "AI" | "AI Edited" | "Manual" | "SME";
  };
  smeRequestId?: number;
  duplicateOf?: number;
  rejectedReason?: string;
};

export type MvpSmeRequest = {
  id: number;
  backendId?: number;
  sentEmail?: { subject: string; body: string }; // backend-composed content
  srqIds?: Record<number, number>; // local question id -> SmeRequestQuestion id
  ticketId: string;
  department: string;
  assignee: string;
  eta: string | null; // ISO datetime
  status: SmeStatus;
  questionIds: number[];
  sentAt: string;
  returnedAt?: string;
};

export type MvpKnowledgeEntry = {
  id: number;
  title: string;
  content: string;
  department: string;
  source: string;
  lastUpdated: string; // ISO date
  sharingStatus: SharingStatus;
  status: KnowledgeStatus;
  tags: string[];
  owner: string;
};

export type MvpNotification = {
  id: number;
  type: "SME Reply" | "Overdue" | "AI Complete" | "Knowledge Review" | "Status Change";
  title: string;
  content: string;
  createdAt: string;
  read: boolean;
  ticketId?: string;
  knowledgeId?: number;
};

export type MvpActivity = {
  id: number;
  ticketId?: string;
  actor: string; // "AI" or a user name
  action: string;
  at: string;
};

export type MvpReport = {
  id: number;
  title: string;
  type: string;
  createdBy: string;
  createdAt: string;
  filters: string;
  summary: string;
  status: "Ready" | "Archived";
};

// ─── Seed data ────────────────────────────────────────────────────────────────

export const SEED_TICKETS: MvpTicket[] = [
  {
    id: "TK-1027",
    customer: "Microsoft",
    sorId: "SOR-88213",
    owner: "Sarah Chen",
    status: "In Progress",
    stage: "review",
    aeEmail: "jane.smith@cloudera.com",
    due: "2026-07-23",
    created: "2026-07-01",
    urgency: "High",
    nda: "In Place",
    region: "EMEA",
    source: "Email",
    businessImpact: "Renewal, high value",
    ae: "Jane Smith",
    files: [
      {
        name: "Microsoft_Security_Questionnaire.xlsx",
        size: "182 KB",
        kind: "Customer form",
        uploaded: "2026-07-01",
        status: "Processed",
      },
    ],
  },
  {
    id: "TK-1024",
    customer: "Globex Inc",
    sorId: "SOR-88102",
    owner: "Sarah Chen",
    status: "In Progress",
    stage: "review",
    aeEmail: "tom.ryan@cloudera.com",
    due: "2026-07-10",
    created: "2026-06-26",
    urgency: "High",
    nda: "Missing",
    region: "AMER",
    source: "Salesforce",
    businessImpact: "New deal, medium value",
    ae: "Tom Ryan",
    files: [
      {
        name: "Globex_DueDiligence_Form.xlsx",
        size: "96 KB",
        kind: "Customer form",
        uploaded: "2026-06-26",
        status: "Processed",
      },
    ],
  },
  {
    id: "TK-1022",
    customer: "Acme Corp",
    sorId: "SOR-88044",
    owner: "Sarah Chen",
    status: "Ready for Review",
    stage: "final",
    due: "2026-07-07",
    created: "2026-06-24",
    urgency: "Medium",
    nda: "In Place",
    region: "EMEA",
    source: "Email",
    files: [
      {
        name: "Acme_Vendor_Assessment.xlsx",
        size: "141 KB",
        kind: "Customer form",
        uploaded: "2026-06-24",
        status: "Processed",
      },
    ],
  },
  {
    id: "TK-1019",
    customer: "Initech",
    sorId: "SOR-87891",
    owner: "Liam O'Brien",
    status: "Waiting SME",
    stage: "eta",
    due: "2026-07-03",
    created: "2026-06-18",
    urgency: "High",
    nda: "In Place",
    region: "AMER",
    source: "Salesforce",
    files: [
      {
        name: "Initech_Compliance_Q.xlsx",
        size: "77 KB",
        kind: "Customer form",
        uploaded: "2026-06-18",
        status: "Processed",
      },
    ],
  },
  {
    id: "TK-1015",
    customer: "Umbrella Health",
    sorId: "SOR-87720",
    owner: "Priya Patel",
    status: "Approved",
    stage: "done",
    due: "2026-07-15",
    created: "2026-06-15",
    urgency: "Medium",
    nda: "In Place",
    region: "APAC",
    source: "Email",
    files: [
      {
        name: "Umbrella_Security_Review.xlsx",
        size: "128 KB",
        kind: "Customer form",
        uploaded: "2026-06-15",
        status: "Processed",
      },
    ],
  },
  {
    id: "TK-1012",
    customer: "Stark Industries",
    sorId: "SOR-87544",
    owner: "Sarah Chen",
    status: "Closed",
    stage: "done",
    due: "2026-06-30",
    created: "2026-06-20",
    closed: "2026-07-02",
    urgency: "Low",
    nda: "In Place",
    region: "AMER",
    source: "Salesforce",
    files: [
      {
        name: "Stark_InfoSec_Form.xlsx",
        size: "88 KB",
        kind: "Customer form",
        uploaded: "2026-06-20",
        status: "Processed",
      },
    ],
  },
  {
    id: "TK-1029",
    customer: "Hooli",
    sorId: "SOR-88301",
    owner: "Sarah Chen",
    status: "Intake Review",
    stage: "intake",
    due: "2026-07-20",
    created: "2026-07-06",
    urgency: "Medium",
    nda: "Unknown",
    region: "AMER",
    source: "Email",
    notes: "NDA status unconfirmed — intake incomplete until resolved.",
    files: [
      {
        name: "Hooli_Procurement_Q.xlsx",
        size: "104 KB",
        kind: "Customer form",
        uploaded: "2026-07-06",
        status: "Uploaded",
      },
    ],
  },
  {
    id: "TK-1008",
    customer: "Wayne Enterprises",
    sorId: "SOR-87102",
    owner: "Liam O'Brien",
    status: "Archived",
    stage: "done",
    due: "2026-05-30",
    created: "2026-05-12",
    closed: "2026-06-02",
    urgency: "Low",
    nda: "In Place",
    region: "EMEA",
    source: "Email",
    files: [
      {
        name: "Wayne_Annual_DD.xlsx",
        size: "203 KB",
        kind: "Customer form",
        uploaded: "2026-05-12",
        status: "Processed",
      },
    ],
  },
];

export const SEED_QUESTIONS: MvpQuestion[] = [
  {
    id: 1,
    ticketId: "TK-1027",
    row: 1,
    original: "Do you hold ISO27001?",
    normalised: "Does Cloudera hold ISO 27001 certification?",
    department: "Security",
    risk: "Medium",
    status: "Suggested",
    confidence: 0.96,
    suggested: {
      text: "Yes. Cloudera maintains an information security management system aligned with ISO 27001, with certification renewed annually.",
      knowledgeId: 88,
      reasoning: "Matched one approved Security knowledge entry last reviewed in June 2026 (96% similarity).",
    },
    sharingStatus: "Public",
  },
  {
    id: 2,
    ticketId: "TK-1027",
    row: 2,
    original: "Describe how data is encrypted in transit.",
    normalised: "How is customer data encrypted in transit?",
    department: "Security",
    risk: "Medium",
    status: "Suggested",
    confidence: 0.93,
    suggested: {
      text: "All data in transit is encrypted using TLS 1.2 or higher. Internal service-to-service traffic is encrypted using mutual TLS.",
      knowledgeId: 89,
      reasoning: "Matched approved Security encryption entry (93% similarity).",
    },
    sharingStatus: "Internal",
  },
  {
    id: 3,
    ticketId: "TK-1027",
    row: 3,
    original: "What is your employee turnover rate?",
    normalised: "What is the annual employee turnover rate?",
    department: "HR",
    risk: "Low",
    status: "SME Queued",
    confidence: 0.42,
    sharingStatus: "NDA Required",
  },
  {
    id: 4,
    ticketId: "TK-1027",
    row: 4,
    original: "Do you maintain cyber insurance and at what coverage?",
    normalised: "Does Cloudera maintain cyber liability insurance, and what is the coverage level?",
    department: "Finance",
    risk: "High",
    status: "Needs Review",
    confidence: 0.78,
    suggested: {
      text: "Cloudera maintains cyber liability insurance. Coverage levels are reviewed annually; details can be shared under NDA.",
      knowledgeId: 91,
      reasoning: "Matched Finance insurance entry (78% similarity) — medium confidence, review required.",
    },
    sharingStatus: "NDA Required",
  },
  {
    id: 5,
    ticketId: "TK-1027",
    row: 5,
    original: "Is a data processing agreement available?",
    normalised: "Is a standard data processing agreement (DPA) available?",
    department: "Legal",
    risk: "Medium",
    status: "Suggested",
    confidence: 0.91,
    suggested: {
      text: "Yes. A standard DPA incorporating the EU Standard Contractual Clauses is available and managed by the Legal team.",
      knowledgeId: 92,
      reasoning: "Matched approved Legal DPA entry (91% similarity).",
    },
    sharingStatus: "Public",
  },
  {
    id: 6,
    ticketId: "TK-1027",
    row: 6,
    original: "What is your carbon neutrality target date?",
    normalised: "What is Cloudera's carbon neutrality target?",
    department: "ESG",
    risk: "Low",
    status: "Needs Review",
    confidence: 0.88,
    suggested: {
      text: "Cloudera has published a sustainability roadmap targeting carbon neutrality for owned operations; see the annual sustainability report.",
      knowledgeId: 93,
      reasoning: "Matched ESG sustainability entry (88% similarity) — medium confidence, review required.",
    },
    sharingStatus: "Public",
  },
  {
    id: 7,
    ticketId: "TK-1027",
    row: 7,
    original: "Provide your full list of sub-processors.",
    normalised: "Which sub-processors does Cloudera use?",
    department: "Legal",
    risk: "High",
    status: "New",
    confidence: null,
  },
  {
    id: 8,
    ticketId: "TK-1027",
    row: 8,
    original: "Does the product support SSO?",
    normalised: "Does the product support single sign-on (SSO)?",
    department: "Product",
    risk: "Low",
    status: "Needs Review",
    confidence: 0.74,
    suggested: {
      text: "Yes, SAML 2.0 and OIDC based single sign-on is supported across the platform.",
      knowledgeId: 94,
      reasoning: "Matched Product capability entry (74% similarity) — medium confidence, review required.",
    },
    sharingStatus: "Public",
  },
  {
    id: 9,
    ticketId: "TK-1027",
    row: 9,
    original: "Is data encrypted during transmission?",
    normalised: "How is customer data encrypted in transit?",
    department: "Security",
    risk: "Medium",
    status: "AI Analysed",
    confidence: 0.93,
    duplicateOf: 2,
    sharingStatus: "Internal",
  },
  // TK-1024 — Globex has NO NDA in place: demonstrates the NDA block (AI-08)
  {
    id: 10,
    ticketId: "TK-1024",
    row: 1,
    original: "Share your latest SOC 2 Type II report.",
    normalised: "Can Cloudera share its SOC 2 Type II report?",
    department: "Security",
    risk: "High",
    status: "Suggested",
    confidence: 0.95,
    suggested: {
      text: "A SOC 2 Type II report is available and can be shared with customers under NDA.",
      knowledgeId: 88,
      reasoning: "Matched approved Security entry (95% similarity). Sharing requires NDA.",
    },
    sharingStatus: "NDA Required",
  },
  {
    id: 11,
    ticketId: "TK-1024",
    row: 2,
    original: "Where is customer data hosted?",
    normalised: "In which regions is customer data hosted?",
    department: "Security",
    risk: "Medium",
    status: "Suggested",
    confidence: 0.92,
    suggested: {
      text: "Customer data is hosted in the region selected at provisioning. Available regions include US, EU and APAC.",
      knowledgeId: 89,
      reasoning: "Matched approved hosting entry (92% similarity).",
    },
    sharingStatus: "Public",
  },
  {
    id: 12,
    ticketId: "TK-1024",
    row: 3,
    original: "Describe your incident response SLAs.",
    normalised: "What are the incident response SLAs?",
    department: "Legal",
    risk: "High",
    status: "SME Queued",
    confidence: 0.55,
    sharingStatus: "Internal",
  },
  // TK-1019 — Initech: SME packages already sent, tracking ETAs
  {
    id: 20,
    ticketId: "TK-1019",
    row: 1,
    original: "Describe your incident response SLAs.",
    normalised: "What are the incident response SLAs?",
    department: "Security",
    risk: "High",
    status: "Waiting SME",
    confidence: 0.51,
    smeRequestId: 2,
    sharingStatus: "Internal",
  },
  {
    id: 21,
    ticketId: "TK-1019",
    row: 2,
    original: "Do you carry cyber liability insurance?",
    normalised: "Does Cloudera maintain cyber liability insurance?",
    department: "Finance",
    risk: "Medium",
    status: "Waiting SME",
    confidence: 0.62,
    smeRequestId: 4,
    sharingStatus: "NDA Required",
  },
  {
    id: 22,
    ticketId: "TK-1019",
    row: 3,
    original: "Do you hold ISO27001?",
    normalised: "Does Cloudera hold ISO 27001 certification?",
    department: "Security",
    risk: "Medium",
    status: "Approved",
    confidence: 0.96,
    finalAnswer: {
      text: "Yes. Cloudera maintains an ISMS aligned with ISO 27001, certified annually.",
      sourceType: "AI",
    },
    sharingStatus: "Public",
  },
  // TK-1022 — Acme: everything answered from knowledge, ready for final review
  {
    id: 30,
    ticketId: "TK-1022",
    row: 1,
    original: "Is a data processing agreement available?",
    normalised: "Is a standard data processing agreement (DPA) available?",
    department: "Legal",
    risk: "Medium",
    status: "Approved",
    confidence: 0.91,
    finalAnswer: {
      text: "Yes. A standard DPA incorporating the EU Standard Contractual Clauses is available.",
      sourceType: "AI",
    },
    sharingStatus: "Public",
  },
  {
    id: 31,
    ticketId: "TK-1022",
    row: 2,
    original: "Does the product support SSO?",
    normalised: "Does the product support single sign-on (SSO)?",
    department: "Product",
    risk: "Low",
    status: "Approved",
    confidence: 0.9,
    finalAnswer: {
      text: "Yes, SAML 2.0 and OIDC based single sign-on is supported across the platform.",
      sourceType: "AI Edited",
    },
    sharingStatus: "Public",
  },
  {
    id: 32,
    ticketId: "TK-1022",
    row: 3,
    original: "Do you publish a sustainability report?",
    normalised: "Does Cloudera publish an annual sustainability report?",
    department: "ESG",
    risk: "Low",
    status: "Approved",
    confidence: 0.88,
    finalAnswer: {
      text: "Yes. Cloudera publishes an annual sustainability report covering emissions, diversity and governance targets.",
      sourceType: "AI",
    },
    sharingStatus: "Public",
  },
];

export const SEED_SME_REQUESTS: MvpSmeRequest[] = [
  {
    id: 2,
    ticketId: "TK-1019",
    department: "Security",
    assignee: "InfoSec Team",
    eta: "2026-07-05T17:00:00Z",
    status: "ETA Set",
    questionIds: [20],
    sentAt: "2026-06-25T09:00:00Z",
  },
  {
    id: 4,
    ticketId: "TK-1019",
    department: "Finance",
    assignee: "Finance Team",
    eta: "2026-07-10T14:00:00Z",
    status: "ETA Set",
    questionIds: [21],
    sentAt: "2026-06-25T09:05:00Z",
  },
];

export const SEED_KNOWLEDGE: MvpKnowledgeEntry[] = [
  {
    id: 88,
    title: "ISO 27001 & SOC 2 Certifications",
    content:
      "Cloudera maintains an ISMS aligned with ISO 27001, certified annually. A SOC 2 Type II report is produced yearly and can be shared with customers under NDA.",
    department: "Security",
    source: "Ticket #TK-0912 / InfoSec response",
    lastUpdated: "2026-06-10",
    sharingStatus: "NDA Required",
    status: "Approved",
    tags: ["ISO 27001", "SOC 2", "Certification"],
    owner: "InfoSec Team",
  },
  {
    id: 89,
    title: "Encryption in Transit and at Rest",
    content:
      "All data in transit is encrypted with TLS 1.2+; data at rest uses AES-256. Internal service traffic uses mutual TLS.",
    department: "Security",
    source: "Security whitepaper 2026",
    lastUpdated: "2026-05-22",
    sharingStatus: "Internal",
    status: "Approved",
    tags: ["Encryption", "TLS"],
    owner: "InfoSec Team",
  },
  {
    id: 91,
    title: "Cyber Liability Insurance",
    content:
      "Cloudera maintains cyber liability insurance reviewed annually. Coverage details are shareable under NDA.",
    department: "Finance",
    source: "Finance response pack",
    lastUpdated: "2026-04-15",
    sharingStatus: "NDA Required",
    status: "Approved",
    tags: ["Insurance"],
    owner: "Finance Team",
  },
  {
    id: 92,
    title: "Data Processing Agreement (DPA)",
    content:
      "A standard DPA incorporating EU Standard Contractual Clauses is available. Executed DPAs are managed by Legal.",
    department: "Legal",
    source: "Legal KB export 2026",
    lastUpdated: "2026-06-01",
    sharingStatus: "Public",
    status: "Approved",
    tags: ["DPA", "GDPR"],
    owner: "Legal Team",
  },
  {
    id: 93,
    title: "Sustainability & Carbon Neutrality Roadmap",
    content:
      "Cloudera publishes an annual sustainability report covering emissions, diversity and governance targets, including a carbon neutrality roadmap for owned operations.",
    department: "ESG",
    source: "ESG site",
    lastUpdated: "2026-03-30",
    sharingStatus: "Public",
    status: "Approved",
    tags: ["Sustainability"],
    owner: "ESG Team",
  },
  {
    id: 94,
    title: "Single Sign-On Support",
    content:
      "SAML 2.0 and OIDC single sign-on is supported across the platform, including SCIM-based user provisioning.",
    department: "Product",
    source: "Product docs",
    lastUpdated: "2026-06-20",
    sharingStatus: "Public",
    status: "Approved",
    tags: ["SSO", "Authentication"],
    owner: "Product Team",
  },
  {
    id: 95,
    title: "Employee Background Checks",
    content:
      "All employees undergo background checks where legally permitted; contractor screening is handled through the vendor program.",
    department: "HR",
    source: "Ticket #TK-0998 / HR response",
    lastUpdated: "2026-07-01",
    sharingStatus: "Internal",
    status: "Pending Review",
    tags: ["HR", "Screening"],
    owner: "Sarah Chen",
  },
  {
    id: 96,
    title: "Data Retention Defaults",
    content:
      "Customer data is retained for the duration of the subscription plus 30 days, after which it is securely deleted unless otherwise agreed.",
    department: "Legal",
    source: "Ticket #TK-1005 / Legal response",
    lastUpdated: "2026-07-03",
    sharingStatus: "Public",
    status: "Pending Review",
    tags: ["Retention"],
    owner: "Sarah Chen",
  },
  {
    id: 97,
    title: "Legacy Hosting Options (2023)",
    content: "Superseded description of hosting options prior to region expansion.",
    department: "Security",
    source: "Legacy docs",
    lastUpdated: "2023-11-02",
    sharingStatus: "Internal",
    status: "Deprecated",
    tags: ["Hosting"],
    owner: "InfoSec Team",
  },
];

export const SEED_NOTIFICATIONS: MvpNotification[] = [
  {
    id: 1,
    type: "Overdue",
    title: "SME request overdue — Security",
    content: "InfoSec Team ETA for TK-1019 Initech passed on 5 Jul, 17:00 UTC.",
    createdAt: "2026-07-06T08:00:00Z",
    read: false,
    ticketId: "TK-1019",
  },
  {
    id: 2,
    type: "AI Complete",
    title: "AI processing complete — TK-1027 Microsoft",
    content: "9 questions extracted, 1 possible duplicate flagged, 6 suggestions generated.",
    createdAt: "2026-07-01T11:30:00Z",
    read: false,
    ticketId: "TK-1027",
  },
  {
    id: 3,
    type: "Knowledge Review",
    title: "Knowledge entry pending review",
    content: "“Employee Background Checks” was submitted for review by Sarah Chen.",
    createdAt: "2026-07-01T09:15:00Z",
    read: false,
    knowledgeId: 95,
  },
  {
    id: 4,
    type: "SME Reply",
    title: "SME reply received — Legal",
    content: "Legal Team returned 1 answer on TK-1024 Globex Inc.",
    createdAt: "2026-06-30T16:40:00Z",
    read: true,
    ticketId: "TK-1024",
  },
  {
    id: 5,
    type: "Status Change",
    title: "Ticket approved — TK-1015 Umbrella Health",
    content: "Priya Patel approved the final response.",
    createdAt: "2026-06-29T10:05:00Z",
    read: true,
    ticketId: "TK-1015",
  },
];

export const SEED_ACTIVITY: MvpActivity[] = [
  { id: 1, ticketId: "TK-1027", actor: "AI", action: "Extracted 9 questions from Microsoft_Security_Questionnaire.xlsx (confidence 0.42–0.96, 1 duplicate flagged)", at: "2026-07-01T11:30:00Z" },
  { id: 2, ticketId: "TK-1027", actor: "Sarah Chen", action: "Requested HR SME input for question #3 with ETA 9 Jul, 15:00 UTC", at: "2026-07-02T10:00:00Z" },
  { id: 3, ticketId: "TK-1024", actor: "Legal Team", action: "SME reply received for incident response SLAs", at: "2026-06-30T16:40:00Z" },
  { id: 4, ticketId: "TK-1015", actor: "Priya Patel", action: "Approved final response", at: "2026-06-29T10:05:00Z" },
  { id: 5, ticketId: "TK-1012", actor: "Sarah Chen", action: "Ticket closed and archived to history", at: "2026-07-02T09:00:00Z" },
  { id: 6, actor: "Sarah Chen", action: "Submitted “Data Retention Defaults” to Knowledge Pending Review", at: "2026-07-03T14:20:00Z" },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

export function isOverdueTicket(t: MvpTicket): boolean {
  return (
    !["Approved", "Sent", "Closed", "Archived"].includes(t.status) &&
    new Date(t.due + "T23:59:59Z") < MOCK_NOW
  );
}

export function isDueToday(t: MvpTicket): boolean {
  return t.due === MOCK_NOW.toISOString().slice(0, 10) && !["Closed", "Archived"].includes(t.status);
}

// PRD §9.1 confidence bands
export function confidenceBand(c: number | null): "high" | "medium" | "low" | "none" {
  if (c === null) return "none";
  if (c >= 0.9) return "high";
  if (c >= 0.7) return "medium";
  return "low";
}
