// In-memory backend used for local frontend tests.
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 8080);

let kbNextId = 100;
let entries = [
  { id: 88, documentTitle: "Security FAQ", sectionTitle: "ISO 27001 & SOC 2", content: "Cloudera maintains an ISMS aligned with ISO 27001, certified annually. A SOC 2 Type II report can be shared under NDA. (LIVE BACKEND DATA)", source: "InfoSec Master Doc v3", lastUpdated: "2026-06-10T00:00:00", sharingStatus: "NDA-required", department: "InfoSec", approved: true },
  { id: 89, documentTitle: "Security FAQ", sectionTitle: "Encryption", content: "All data in transit uses TLS 1.2+; data at rest uses AES-256. (LIVE BACKEND DATA)", source: "Security whitepaper", lastUpdated: "2026-05-22T00:00:00", sharingStatus: "Customer-shareable", department: "InfoSec", approved: true },
  { id: 92, documentTitle: "Legal Standards", sectionTitle: "DPA", content: "A standard DPA incorporating the EU SCCs is available; executed copies are managed by Legal. (LIVE BACKEND DATA)", source: "Legal KB 2026", lastUpdated: "2026-06-01T00:00:00", sharingStatus: "Public", department: "Legal", approved: true },
  { id: 93, documentTitle: "ESG Disclosures", sectionTitle: "Sustainability", content: "Cloudera publishes an annual sustainability report with a carbon neutrality roadmap. (LIVE BACKEND DATA)", source: "ESG site", lastUpdated: "2026-03-30T00:00:00", sharingStatus: "Public", department: "ESG", approved: true },
  { id: 94, documentTitle: "Product Capabilities", sectionTitle: "SSO", content: "SAML 2.0 and OIDC single sign-on is supported platform-wide. (LIVE BACKEND DATA)", source: "Product docs", lastUpdated: "2026-06-20T00:00:00", sharingStatus: "Public", department: "Product", approved: true },
  { id: 91, documentTitle: "Finance Answers", sectionTitle: "Cyber Insurance", content: "Cyber liability insurance is maintained and reviewed annually; details shareable under NDA. (LIVE BACKEND DATA)", source: "Finance pack", lastUpdated: "2026-04-15T00:00:00", sharingStatus: "NDA-required", department: "Finance", approved: true },
];

const QUESTION_TEMPLATES = [
  { section: "Security!B2", questionText: "Do you hold ISO27001?", department: "InfoSec" },
  { section: "Security!B3", questionText: "Describe how data is encrypted in transit and at rest.", department: "InfoSec" },
  { section: "HR!B2", questionText: "What is your employee turnover rate?", department: "HR" },
  { section: "Finance!B2", questionText: "Do you maintain cyber insurance and at what coverage?", department: "Finance" },
  { section: "Legal!B2", questionText: "Is a data processing agreement available?", department: "Legal" },
  { section: "ESG!B2", questionText: "What is your carbon neutrality target date?", department: "ESG" },
  { section: "Legal!B3", questionText: "Provide your full list of sub-processors.", department: "Legal" },
  { section: "Product!B2", questionText: "Does the product support SSO?", department: "Product" },
];

const PENDING_ENTRY = {
  id: 95,
  documentTitle: "HR Answers",
  sectionTitle: "Employee Background Checks",
  content: "All employees undergo background checks where legally permitted; contractor screening runs through the vendor program. (LIVE BACKEND DATA)",
  source: "Ticket #TK-0998 / HR response",
  lastUpdated: "2026-07-01T00:00:00",
  sharingStatus: "Customer-shareable",
  department: "HR",
  approved: false, // pending review
};

const INITIAL_ENTRIES = JSON.stringify([...entries, PENDING_ENTRY]);
let tickets, ticketSeq, questions, questionSeq, finalAnswers, faSeq, smeRequests, smeSeq, srqs, srqSeq, calls;
function reset() {
  entries = JSON.parse(INITIAL_ENTRIES);
  kbNextId = 100;
  tickets = []; ticketSeq = 1;
  questions = []; questionSeq = 500;
  finalAnswers = []; faSeq = 900;
  smeRequests = []; smeSeq = 300;
  srqs = []; srqSeq = 700;
  calls = {};
}
reset();

function score(question, entry) {
  // split alphanumeric compounds too: "iso27001" -> iso + 27001
  const words = question
    .toLowerCase()
    .split(/\W+/)
    .flatMap((w) => {
      const parts = w.match(/[a-z]+|\d+/g) ?? [];
      return parts.length > 1 ? parts : [w];
    })
    .filter((w) => w.length > 2 && !["you","your","the","and","for","how","what","does","are"].includes(w));
  if (!words.length) return 0;
  const hay = `${entry.documentTitle} ${entry.sectionTitle} ${entry.content}`.toLowerCase();
  const hits = words.filter((w) => hay.includes(w)).length;
  return Math.min(0.97, (hits / words.length) * 0.95 + 0.02);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json", ...CORS });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") return json(res, 204);
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    calls[`${req.method} ${path.replace(/\/\d+/g, "/{id}")}`] =
      (calls[`${req.method} ${path.replace(/\/\d+/g, "/{id}")}`] ?? 0) + 1;

    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parse = () => { try { return JSON.parse(body); } catch { return {}; } };
      let m;

      if (path === "/api/_debug/calls") return json(res, 200, calls);
      if (path === "/api/_debug/reset") {
        reset();
        return json(res, 200, { ok: true });
      }

      // ── tickets ──
      if (path === "/api/tickets" && req.method === "GET") return json(res, 200, tickets);
      if (path === "/api/tickets" && req.method === "POST") {
        const t = { id: ticketSeq++, ...parse() };
        tickets.push(t);
        return json(res, 200, t);
      }
      if ((m = path.match(/^\/api\/tickets\/(\d+)$/)) && req.method === "PUT") {
        const t = tickets.find((x) => x.id === +m[1]);
        if (!t) return json(res, 404, {});
        const changes = parse();
        for (const [k, v] of Object.entries(changes)) if (v !== null && v !== undefined) t[k] = v;
        return json(res, 200, t);
      }
      if ((m = path.match(/^\/api\/questions\/(\d+)$/)) && req.method === "PUT") {
        const q = questions.find((x) => x.id === +m[1]);
        if (!q) return json(res, 404, {});
        const changes = parse();
        for (const [k, v] of Object.entries(changes)) if (v !== null && v !== undefined) q[k] = v;
        return json(res, 200, q);
      }
      if ((m = path.match(/^\/api\/tickets\/(\d+)\/status$/)) && req.method === "PATCH") {
        const t = tickets.find((x) => x.id === +m[1]);
        if (t) t.status = parse().status;
        return json(res, 200, t ?? {});
      }

      // ── questionnaire ──
      if (path === "/api/questionnaire/classify" && req.method === "POST")
        return json(res, 200, QUESTION_TEMPLATES.map((q) => ({ ...q })));
      if (path === "/api/questionnaire/import" && req.method === "POST") {
        const ticketId = +(url.searchParams.get("ticketId") ?? 0);
        const saved = QUESTION_TEMPLATES.map((q) => ({
          id: questionSeq++,
          ticketId,
          questionText: q.questionText,
          department: q.department,
          status: "Needs Review",
          riskLevel: null,
          rowReference: q.section,
          createdAt: new Date().toISOString(),
        }));
        questions.push(...saved);
        return json(res, 200, saved);
      }

      // ── read endpoints used by the app's startup load ──
      if ((m = path.match(/^\/api\/questions\/ticket\/(\d+)$/)) && req.method === "GET")
        return json(res, 200, questions.filter((q) => q.ticketId === +m[1]));
      if ((m = path.match(/^\/api\/sme-requests\/ticket\/(\d+)$/)) && req.method === "GET")
        return json(res, 200, smeRequests.filter((r) => r.ticketId === +m[1]));
      if ((m = path.match(/^\/api\/sme-request-questions\/request\/(\d+)$/)) && req.method === "GET")
        return json(res, 200, srqs.filter((x) => x.smeRequestId === +m[1]));
      if ((m = path.match(/^\/api\/final-review\/ticket\/(\d+)$/)) && req.method === "GET") {
        const tid = +m[1];
        return json(res, 200, questions
          .filter((q) => q.ticketId === tid)
          .map((q) => {
            const fa = finalAnswers.filter((f) => f.questionId === q.id).pop();
            return {
              questionId: q.id,
              questionText: q.questionText,
              department: q.department,
              questionStatus: q.status,
              riskLevel: q.riskLevel,
              answerId: fa?.id ?? null,
              answerText: fa?.answerText ?? null,
              isEdited: fa?.isEdited ?? null,
              sourceType: fa?.sourceType ?? null,
              approvedBy: fa?.approvedBy ?? null,
              approvalStatus: fa?.approvalStatus ?? null,
              answered: !!fa,
            };
          }));
      }

      // ── questions ──
      if ((m = path.match(/^\/api\/questions\/(\d+)\/status$/)) && req.method === "PATCH") {
        const q = questions.find((x) => x.id === +m[1]);
        if (q) q.status = parse().status;
        return json(res, 200, q ?? {});
      }

      // ── knowledge base ──
      if (path === "/api/knowledge-base" && req.method === "GET") return json(res, 200, entries);
      if (path === "/api/knowledge-base/search" && req.method === "POST") {
        const { question } = parse();
        const ranked = entries
          .filter((e) => e.approved)
          .map((e) => ({ ...e, similarityScore: score(question ?? "", e) }))
          .filter((e) => e.similarityScore >= 0.35)
          .sort((a, b) => b.similarityScore - a.similarityScore)
          .slice(0, 5);
        return json(res, 200, ranked);
      }
      if (path === "/api/knowledge-base" && req.method === "POST") {
        const e = { id: kbNextId++, ...parse() };
        entries.push(e);
        return json(res, 201, e);
      }
      if ((m = path.match(/^\/api\/knowledge-base\/(\d+)$/))) {
        const id = +m[1];
        if (req.method === "GET") return json(res, 200, entries.find((e) => e.id === id) ?? {});
        if (req.method === "PUT") {
          const i = entries.findIndex((e) => e.id === id);
          if (i >= 0) entries[i] = { id, ...parse() };
          return json(res, 200, entries[i] ?? {});
        }
        if (req.method === "DELETE") {
          entries = entries.filter((e) => e.id !== id);
          return json(res, 204);
        }
      }

      // ── final answers ──
      if (path === "/api/final-answers" && req.method === "POST") {
        const changes = parse();
        let fa = finalAnswers.find((f) => f.questionId === changes.questionId);
        if (fa) {
          for (const [k, v] of Object.entries(changes)) if (v !== null && v !== undefined) fa[k] = v;
        } else {
          fa = { id: faSeq++, ...changes, createdAt: new Date().toISOString() };
          finalAnswers.push(fa);
        }
        if (fa.approvalStatus === "Confirmed") {
          const q = questions.find((x) => x.id === fa.questionId);
          if (q) q.status = "Answered";
        }
        return json(res, 200, fa);
      }

      // ── sme requests ──
      if (path === "/api/sme-requests" && req.method === "POST") {
        const r = { id: smeSeq++, ...parse() };
        smeRequests.push(r);
        return json(res, 200, r);
      }
      if ((m = path.match(/^\/api\/sme-requests\/(\d+)\/email$/)) && req.method === "GET") {
        const r = smeRequests.find((x) => x.id === +m[1]);
        if (!r) return json(res, 404, {});
        const linked = srqs.filter((s) => s.smeRequestId === r.id);
        const texts = linked.map(
          (s) => questions.find((q) => q.id === s.questionId)?.questionText ?? "…",
        );
        const t = tickets.find((x) => x.id === r.ticketId);
        const customer = t?.customerName ?? `ticket ${r.ticketId}`;
        const bodyLines = [
          `Hi ${r.teamName ?? r.department + " Team"},`,
          "",
          `The GOM team is completing a customer questionnaire for ${customer} and needs your department's input on the questions below.`,
          "",
          ...(t?.deadline ? [`Customer deadline: ${String(t.deadline).slice(0, 10)} (UTC)`, ""] : []),
          ...texts.map((q, i) => `${i + 1}. ${q}`),
          "",
          "Please reply with a realistic ETA for returning answers so we can track this request.",
          "",
          "Thanks,",
          "Global Order Management",
        ];
        return json(res, 200, {
          to: "",
          subject: `[Action needed] SME input for ${customer} questionnaire – ${r.department} (${texts.length} questions)`,
          body: bodyLines.join("\n"),
        });
      }
      if ((m = path.match(/^\/api\/sme-requests\/(\d+)$/)) && req.method === "PUT") {
        const i = smeRequests.findIndex((x) => x.id === +m[1]);
        if (i >= 0) smeRequests[i] = { ...smeRequests[i], ...parse() };
        return json(res, 200, smeRequests[i] ?? {});
      }
      if ((m = path.match(/^\/api\/sme-requests\/(\d+)\/unreturn$/)) && req.method === "POST") {
        const r = smeRequests.find((x) => x.id === +m[1]);
        if (!r) return json(res, 404, {});
        r.returnedAt = null;
        r.status = r.eta ? "ETA Confirmed" : "Waiting for ETA";
        return json(res, 200, r);
      }

      // ── sme request questions ──
      if (path === "/api/sme-request-questions/package" && req.method === "POST") {
        const { smeRequestId, ticketId, department } = parse();
        const linked = questions
          .filter((q) => q.ticketId === ticketId && q.department === department && q.status === "SME Needed")
          .map((q) => ({
            id: srqSeq++,
            smeRequestId,
            questionId: q.id,
            status: "Pending",
            includedReason: null,
            returnedAnswer: null,
            updatedAt: null,
          }));
        srqs.push(...linked);
        return json(res, 200, linked);
      }
      if ((m = path.match(/^\/api\/sme-request-questions\/(\d+)\/answer$/)) && req.method === "PATCH") {
        const s = srqs.find((x) => x.id === +m[1]);
        if (s) {
          s.returnedAnswer = parse().returnedAnswer;
          s.status = "Returned";
        }
        return json(res, 200, s ?? {});
      }

      // ── export ──
      if ((m = path.match(/^\/api\/export\/ticket\/(\d+)$/)) && req.method === "GET") {
        const tid = +m[1];
        const rows = questions
          .filter((q) => q.ticketId === tid)
          .map((q) => {
            const fa = finalAnswers.filter((f) => f.questionId === q.id).pop();
            const text = !fa ? "" : fa.approvalStatus !== "Confirmed" ? "(Draft – not confirmed)" : fa.answerText;
            return `${q.department}\t${q.questionText}\t${text}`;
          });
        const content = "Department\tQuestion\tFinal Answer\n" + rows.join("\n");
        res.writeHead(200, {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="ticket-${tid}-answers.xlsx"`,
          ...CORS,
        });
        return res.end(content);
      }

      return json(res, 404, { error: "not mocked: " + req.method + " " + path });
    });
  })
  .listen(PORT, () => console.log(`Full backend mock on http://localhost:${PORT}`));
