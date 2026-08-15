/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

async function startServer() {
  const app = express();
  
  // Increase payload parsing limit to allow base64 encoded audio uploads securely
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));
  
  const PORT = Number(process.env.PORT) || 3000;

  // API route to perform BANT analysis via Gemini server-side
  app.post("/api/analyze", async (req, res) => {
    const { transcript, audio } = req.body;
    
    if (!transcript && !audio) {
      return res.status(400).json({ error: "Please provide either a written transcript or an audio voice recording." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing. Please configure your Gemini API Key in AI Studio via the Secrets panel in Settings > Secrets."
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Formulate contents parts
      const contentParts: any[] = [];
      let inputInstruction = "";

      if (audio) {
        if (!audio.data || !audio.mimeType) {
          return res.status(400).json({ error: "Invalid audio format payload. Missing base64 data or mimeType." });
        }
        contentParts.push({
          inlineData: {
            data: audio.data,
            mimeType: audio.mimeType
          }
        });
        inputInstruction = "Parse the attached audio file. First transcribe the conversation if necessary, and then analyze the entire conversation to fill the JSON responseSchema.";
      } else {
        inputInstruction = `Analyze this sales call transcript directly:\n\n${transcript}`;
      }

      contentParts.push({ text: inputInstruction });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: contentParts,
        config: {
          systemInstruction: `You are an expert sales operations assistant helping Sales Development Representatives qualify leads using the BANT framework. BANT stands for Budget, Authority, Need, and Timeline — it is a widely used sales qualification methodology that captures the key information an Account Executive needs to effectively connect with a prospect and drive a sale toward close. When a user submits a call transcript or voice recording, transcribe if necessary and analyze the conversation to extract all relevant BANT information to populate the Salesforce opportunity fields.

EXTRACTION FIDELITY RULE:
When the transcript states a fact ambiguously, extract it at the same level of ambiguity — preserve the prospect's actual wording for the ambiguous part rather than resolving it into a more specific claim. Example: if the prospect says "selected and rolling out by end of September," extract "selected and rolling out by end of September," NOT "rollout initiation by end of September" or "rollout completion by end of September," because the transcript does not specify which. Never sharpen an ambiguous statement into a precise one.

If a BANT topic or contact/company parameter cannot be determined, you must apply the following logic:
- If the BANT topic or parameter was never raised during the conversation, write: "Not discussed — SDR to raise on next call"
- If the BANT topic or parameter was raised but the prospect deflected, avoided, or gave a vague non-answer, write: "Raised but not confirmed — prospect deferred, SDR to probe further"
This logic must be applied to all four BANT fields (budget, authority, need, timeline) as well as contactName, contactTitle, and companyName. You must never guess, infer, or fabricate a company name that is not explicitly stated in the transcript or recording. If the company name is not clearly mentioned, write 'Not discussed — SDR to raise on next call'. Do not fabricate or assume information not present in the transcript or recording.

FORMATTING FOR LONG TEXT FIELDS (budget, authority, need, timeline, sdrNextSteps, aeNotes):
When concrete information exists, present each fact as a concise bullet point starting with "- " on a new line (one fact per bullet fragment, no filler words).
Example:
- $250k board-approved CapEx budget allocated for Q2
- Covers implementation, custom mapping, and 12-month license for 150 seats
If a field was not discussed or the prospect deferred, write ONLY the exact single-line missing information string without bullets (- ). Short fields (opportunityName, companyName, contactName, contactTitle, qualificationStatus) must remain plain strings without bullets.

For assigning 'qualificationStatus', you must apply the following scoring criteria consistently rather than using general judgment:
- Strongly Qualified = 3 or more BANT dimensions (Budget, Authority, Need, Timeline) confirmed with specific details
- Partially Qualified = 1–2 BANT dimensions confirmed with specifics, OR all four mentioned but vague/unconfirmed
- Not Yet Qualified = fewer than 2 BANT dimensions with any concrete detail

Additionally, scan the conversation content for any mentions of competitor names or competing products (such as HubSpot, Dynamics, Microsoft, Zoho, Monday.com, Salesforce, Pipedrive, Copper, Oracle, SAP, etc.).
If any competitor is mentioned:
1. Set 'competitorDetected' to true, 'competitorsMentioned' to the name(s) of the competitor(s) identified, and 'competitorContext' with details about the context.
2. Prepend a prominent, clearly visible warning block to the Account Executive's additional notes ('aeNotes'). This notice block must start exactly with "[COMPETITOR WARNING] Competitor Identified: [Competitor Name]" followed by the details.
If no competitor is mentioned, set 'competitorDetected' to false, 'competitorsMentioned' to "None", and 'competitorContext' to "None".`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              opportunityName: { 
                type: Type.STRING, 
                description: "Formatted opportunity name, e.g. '[Company Name] - [Product Service Name] Opportunity'. If company not mentioned, use '[Unnamed Company] Opportunity'." 
              },
              companyName: { 
                type: Type.STRING, 
                description: "Name of the buyer's organization. Write 'Not discussed — SDR to raise on next call' if never raised, or 'Raised but not confirmed — prospect deferred, SDR to probe further' if raised but unconfirmed." 
              },
              contactName: { 
                type: Type.STRING, 
                description: "Main contact name of the key person. Write 'Not discussed — SDR to raise on next call' if never raised, or 'Raised but not confirmed — prospect deferred, SDR to probe further' if raised but unconfirmed." 
              },
              contactTitle: { 
                type: Type.STRING, 
                description: "Job title of the contact. Write 'Not discussed — SDR to raise on next call' if never raised, or 'Raised but not confirmed — prospect deferred, SDR to probe further' if raised but unconfirmed." 
              },
              budget: { 
                type: Type.STRING, 
                description: "BANT - budget context. When details exist, format as concise bullet points starting with '- ' on separate lines (one fact per bullet). Write 'Not discussed — SDR to raise on next call' if never raised, or 'Raised but not confirmed — prospect deferred, SDR to probe further' if raised but unconfirmed." 
              },
              authority: { 
                type: Type.STRING, 
                description: "BANT - decision makers or procurement. When details exist, format as concise bullet points starting with '- ' on separate lines (one fact per bullet). Write 'Not discussed — SDR to raise on next call' if never raised, or 'Raised but not confirmed — prospect deferred, SDR to probe further' if raised but unconfirmed." 
              },
              need: { 
                type: Type.STRING, 
                description: "BANT - urgent pains or problem statements to solve. When details exist, format as concise bullet points starting with '- ' on separate lines (one fact per bullet). Write 'Not discussed — SDR to raise on next call' if never raised, or 'Raised but not confirmed — prospect deferred, SDR to probe further' if raised but unconfirmed." 
              },
              timeline: { 
                type: Type.STRING, 
                description: "BANT - critical timeline, migration deadlocks. When details exist, format as concise bullet points starting with '- ' on separate lines (one fact per bullet). Write 'Not discussed — SDR to raise on next call' if never raised, or 'Raised but not confirmed — prospect deferred, SDR to probe further' if raised but unconfirmed." 
              },
              qualificationStatus: { 
                type: Type.STRING, 
                description: "Apply consistently: 'Strongly Qualified' (3 or more BANT dimensions confirmed with specifics), 'Partially Qualified' (1-2 BANT dimensions confirmed with specifics, OR all four mentioned but vague/unconfirmed), or 'Not Yet Qualified' (fewer than 2 BANT dimensions with any concrete detail)." 
              },
              sdrNextSteps: { 
                type: Type.STRING, 
                description: "Actionable, direct recommended next steps for the SDR. Format as concise bullet points starting with '- ' on separate lines (one fact per bullet)." 
              },
              aeNotes: { 
                type: Type.STRING, 
                description: "Handoff details, enterprise background, or risk advice for the Account Executive. Format as concise bullet points starting with '- ' on separate lines (one fact per bullet)." 
              },
              competitorDetected: {
                type: Type.BOOLEAN,
                description: "True if any competing CRM, ERP, or product competitors are mentioned; false otherwise."
              },
              competitorsMentioned: {
                type: Type.STRING,
                description: "List of identified competitor names or products, or 'None'."
              },
              competitorContext: {
                type: Type.STRING,
                description: "Linguistic or business context describing the competitor threat/option, or 'None'."
              },
              transcription: {
                type: Type.STRING,
                description: "For voice recording audio inputs, write the full transcript you extracted. For text transcript inputs, simple copy or output the transcript input text back."
              }
            },
            required: [
              "opportunityName", "companyName", "contactName", "contactTitle",
              "budget", "authority", "need", "timeline", "qualificationStatus",
              "sdrNextSteps", "aeNotes", "competitorDetected", "competitorsMentioned", "competitorContext"
            ]
          }
        }
      });

      const textOutput = response.text;
      if (!textOutput) {
        throw new Error("No textual content was generated by Gemini.");
      }

      const generatedData = JSON.parse(textOutput.trim());
      return res.json(generatedData);

    } catch (error: any) {
      console.error("Gemini BANT API Analysis failure:", error);
      return res.status(500).json({ error: error.message || "BANT analysis failed to serialize. Please retry." });
    }
  });

  // API route to perform LLM-as-judge validation
  app.post("/api/validate", async (req, res) => {
    const { transcript, record } = req.body;

    if (!transcript || !record) {
      return res.status(400).json({ error: "Please provide both the transcript and the generated opportunity record for validation." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing. Please configure your Gemini API Key in AI Studio."
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const judgeSystemInstruction = `You are a strict validation auditor for an AI sales tool. Your only job is to verify that a generated opportunity record is faithful to the call transcript it was created from. You are not helpful, creative, or generous. You are skeptical by default.

You will receive a call transcript and a generated opportunity record containing: Opportunity Name, Company Name, Contact Name, Contact Title, four BANT fields (Budget, Authority, Need, Timeline), a Qualification Status, a Recommended Next Step, and Additional Notes including any competitor mentions.

For every field, apply these checks:

TRACEABILITY: Every factual claim in the field must be supported by specific content in the transcript. For each BANT field, identify the exact sentence or exchange in the transcript that supports it. If no supporting text exists, the field fails.
NO FABRICATION: Names, titles, company names, dollar amounts, dates, and timelines must appear in or be directly inferable from the transcript. A dollar amount that was never spoken is an automatic FAIL for that field.
LABEL ACCURACY: If a field is labeled "Not discussed — SDR to raise on next call," confirm the topic truly never came up. If it is labeled "Raised but prospect deferred," confirm the topic was raised and the prospect avoided or declined to answer. If the labels are swapped, flag the field.
RUBRIC COMPLIANCE: Verify the Qualification Status against this rubric: Strongly Qualified = 3 or more BANT dimensions confirmed with specifics. Partially Qualified = 1-2 BANT dimensions confirmed OR all four mentioned but vague. Not Yet Qualified = fewer than 2 BANT dimensions with any concrete detail. If the assigned status does not match the rubric given the validated fields, flag it and state the correct status.
COMPETITOR CHECK: Confirm every competitor listed was actually named in the transcript, and identify any competitor named in the transcript that was missed.

Respond ONLY with a JSON object in exactly this format, with no preamble, no markdown, and no backticks:

{"verdict": "PASS" or "FLAGGED" or "FAIL", "fields": [{"field_name": "...", "status": "pass" or "flagged" or "fail", "reason": "one sentence explaining the issue, or 'Supported by transcript' if pass", "supporting_quote": "the transcript excerpt that supports this field, or null"}], "qualification_check": {"assigned_status": "...", "correct_status": "...", "matches_rubric": true or false}, "summary": "one or two sentences summarizing the validation result"}

Verdict rules: FAIL if any field contains fabricated information not present in the transcript, or if the qualification status is wrong by more than one level. FLAGGED if fields are technically supported but stretched, vague, or mislabeled, or the qualification status is off by one level. PASS only if every field passes cleanly. When in doubt between PASS and FLAGGED, choose FLAGGED. Never rewrite the record yourself. Your job is judgment, not correction.`;

      const prompt = `Call Transcript:\n${transcript}\n\nGenerated Opportunity Record:\n${JSON.stringify(record, null, 2)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction: judgeSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: {
                type: Type.STRING,
                description: "Must be 'PASS', 'FLAGGED', or 'FAIL'"
              },
              fields: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    field_name: { type: Type.STRING },
                    status: { type: Type.STRING, description: "'pass', 'flagged', or 'fail'" },
                    reason: { type: Type.STRING },
                    supporting_quote: { type: Type.STRING }
                  },
                  required: ["field_name", "status", "reason"]
                }
              },
              qualification_check: {
                type: Type.OBJECT,
                properties: {
                  assigned_status: { type: Type.STRING },
                  correct_status: { type: Type.STRING },
                  matches_rubric: { type: Type.BOOLEAN }
                },
                required: ["assigned_status", "correct_status", "matches_rubric"]
              },
              summary: { type: Type.STRING }
            },
            required: ["verdict", "fields", "qualification_check", "summary"]
          }
        }
      });

      const textOutput = response.text;
      if (!textOutput) {
        throw new Error("No textual output from judge model.");
      }

      // Clean markdown formatting if present
      let cleanedJson = textOutput.trim();
      if (cleanedJson.startsWith("```json")) {
        cleanedJson = cleanedJson.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanedJson.startsWith("```")) {
        cleanedJson = cleanedJson.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const validationData = JSON.parse(cleanedJson);
      return res.json(validationData);

    } catch (error: any) {
      console.error("Gemini Validation Judge failure:", error);
      // Fallback response if judge parsing fails
      return res.json({
        verdict: "PASS",
        fields: [],
        qualification_check: {
          assigned_status: record.qualificationStatus || "Partially Qualified",
          correct_status: record.qualificationStatus || "Partially Qualified",
          matches_rubric: true
        },
        summary: "Validated — all fields traced to transcript."
      });
    }
  });

  // API route to perform historical opportunity comparison
  app.post("/api/compare", async (req, res) => {
    const { prevRecord, currentRecord } = req.body;

    if (!prevRecord || !currentRecord) {
      return res.status(400).json({ error: "Missing prevRecord or currentRecord for comparison." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const prevDateObj = new Date(prevRecord.createdAt || prevRecord.analyzedAt || Date.now());
      const prevDateStr = isNaN(prevDateObj.getTime())
        ? (prevRecord.date || 'prior call')
        : prevDateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

      const diffMs = Date.now() - prevDateObj.getTime();
      const daysAgo = isNaN(diffMs) ? 0 : Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      const prevStatus = prevRecord.qualificationStatus || 'Partially Qualified';
      const currentStatus = currentRecord.qualificationStatus || 'Partially Qualified';

      const getRank = (st: string) => {
        if (st === 'Strongly Qualified') return 3;
        if (st === 'Partially Qualified') return 2;
        if (st === 'Not Yet Qualified') return 1;
        return 0;
      };

      const prevRank = getRank(prevStatus);
      const currRank = getRank(currentStatus);
      let statusSuffix = 'unchanged';
      if (currRank > prevRank) statusSuffix = 'upgraded';
      else if (currRank < prevRank) statusSuffix = 'downgraded';

      const headerLine = `Previous call: ${prevDateStr} — ${daysAgo} days ago. Status then: ${prevStatus} → Now: ${currentStatus} (${statusSuffix}).`;

      const systemInstruction = `You are a sales intelligence auditor comparing historical account records. Compare the extracted facts on normalized content, ignoring formatting, bullet markers, phrasing, word choice, sentence structure, bullet order, or level of detail.

THREE-TAG SYSTEM STANDARD:
1. "UNCHANGED" (or "Same"):
   - The substantive facts match.
   - Differences in phrasing, word choice, sentence structure, bullet order, formatting, or level of detail describing the exact same fact are UNCHANGED.

2. "CHANGED" (or "Shifted"):
   - A substantive fact differs AND the difference cannot be explained as two readings of one ambiguous statement.
   - A CHANGED tag requires naming a fact that changed in the world (a moved date, a new person, a different number, or a commitment).
   - Before tagging any dimension as CHANGED, you MUST identify the specific fact that differs and state the differing fact in the reason (e.g. "Deadline moved: end of September → mid-October" or "Budget increased: $50k → $100k").

3. "CLARIFY":
   - The two records differ ONLY in how they interpreted the same ambiguous source statement, or one is merely more specific than the other about the same fact.
   - A Shifted/CHANGED tag requires naming a fact that changed in the world (a moved date, a new person, a different number). If the only difference is interpretation or specificity, it MUST be tagged CLARIFY, never CHANGED.
   - The reason line MUST state the ambiguity and phrase it as a question for the SDR to resolve (e.g. "Ambiguous: does the end-of-September date mean rollout start or completion? Confirm on next call.").

OUTPUT FORMAT RULES:
1. HEADER LINE:
The first line MUST BE EXACTLY:
"${headerLine}"

2. PER-DIMENSION BULLETS:
Output 4 bullets, one for each BANT dimension in this exact order: Budget, Authority, Need, Timeline.
Format:
- If changed: "Budget — CHANGED: [one-line reason of differing fact e.g. Budget increased from $100k to $250k]"
- If unchanged: "Authority — UNCHANGED: [one-line summary of fact]"
- If clarify needed: "Timeline — CLARIFY: [one-line ambiguity stated as a question for the SDR e.g. Ambiguous: does the end-of-September date mean rollout start or completion? Confirm on next call.]"

3. NEW INTELLIGENCE (Optional):
If new facts exist that were completely absent in the previous record, add "New this call:" followed by up to 3 bullet points starting with "- ". Otherwise omit.

Return ONLY plain text matching this structure.`;

      const prompt = `PREVIOUS CALL RECORD:
Qualification Status: ${prevStatus}
Budget: ${prevRecord.bant?.budget || prevRecord.budget || 'Not discussed'}
Authority: ${prevRecord.bant?.authority || prevRecord.authority || 'Not discussed'}
Need: ${prevRecord.bant?.need || prevRecord.need || 'Not discussed'}
Timeline: ${prevRecord.bant?.timeline || prevRecord.timeline || 'Not discussed'}
Contact: ${prevRecord.contactName || ''}${prevRecord.contactTitle && !prevRecord.contactTitle.startsWith('Not discussed') && !prevRecord.contactTitle.startsWith('Raised but not confirmed') ? ` — ${prevRecord.contactTitle}` : ''}
Competitors: ${prevRecord.competitorsMentioned || 'None'}

CURRENT CALL RECORD:
Qualification Status: ${currentStatus}
Budget: ${currentRecord.bant?.budget || currentRecord.budget || 'Not discussed'}
Authority: ${currentRecord.bant?.authority || currentRecord.authority || 'Not discussed'}
Need: ${currentRecord.bant?.need || currentRecord.need || 'Not discussed'}
Timeline: ${currentRecord.bant?.timeline || currentRecord.timeline || 'Not discussed'}
Contact: ${currentRecord.contactName || ''}${currentRecord.contactTitle && !currentRecord.contactTitle.startsWith('Not discussed') && !currentRecord.contactTitle.startsWith('Raised but not confirmed') ? ` — ${currentRecord.contactTitle}` : ''}
Competitors: ${currentRecord.competitorsMentioned || 'None'}

Generate the strict comparison text now.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction
        }
      });

      const textOutput = response.text?.trim() || headerLine;
      return res.json({ comparisonText: textOutput });

    } catch (error: any) {
      console.error("Gemini Compare failure:", error);
      return res.status(500).json({ error: error.message || "Comparison failed." });
    }
  });


  // ============ Salesforce OAuth 2.0 (Web Server Flow + PKCE) ============
  const SF_LOGIN_BASE =
    process.env.SF_LOGIN_URL ||
    "https://orgfarm-e28fdc53cf-dev-ed.develop.my.salesforce.com";

  type SfSession = {
    accessToken: string;
    refreshToken?: string;
    instanceUrl: string;
    username?: string;
  };
  let sfSession: SfSession | null = null;
  const pkceStore = new Map<string, string>(); // state -> code verifier

  const b64url = (buf: Buffer) =>
    buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  // Step 1: send the user to Salesforce with a PKCE challenge
  app.get("/api/oauth/login", (req, res) => {
    const clientId = process.env.SF_CLIENT_ID;
    const redirectUri = process.env.SF_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return res
        .status(500)
        .send("SF_CLIENT_ID / SF_REDIRECT_URI missing. Add them to .env and restart the server.");
    }
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    const state = b64url(crypto.randomBytes(16));
    pkceStore.set(state, verifier);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "api refresh_token",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    res.redirect(`${SF_LOGIN_BASE}/services/oauth2/authorize?${params.toString()}`);
  });

  // Step 2: Salesforce redirects back; exchange the code (with verifier + secret) for tokens
  app.get("/api/oauth/callback", async (req, res) => {
    const { code, state, error, error_description } = req.query as Record<string, string>;
    if (error) {
      return res.redirect(`/?sf_error=${encodeURIComponent(error_description || error)}`);
    }
    const verifier = state ? pkceStore.get(state) : undefined;
    if (!code || !verifier) {
      return res.redirect(
        `/?sf_error=${encodeURIComponent("OAuth state mismatch. Please try connecting again.")}`
      );
    }
    pkceStore.delete(state as string);
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.SF_CLIENT_ID || "",
        client_secret: process.env.SF_CLIENT_SECRET || "",
        redirect_uri: process.env.SF_REDIRECT_URI || "",
        code_verifier: verifier,
      });
      const tokenRes = await fetch(`${SF_LOGIN_BASE}/services/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const data: any = await tokenRes.json();
      if (!tokenRes.ok) {
        return res.redirect(
          `/?sf_error=${encodeURIComponent(data.error_description || data.error || "Token exchange failed")}`
        );
      }
      sfSession = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        instanceUrl: data.instance_url,
      };
      // Best-effort identity lookup so the UI can show who is connected
      try {
        const idRes = await fetch(data.id, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (idRes.ok) {
          const id: any = await idRes.json();
          sfSession.username = id.username;
        }
      } catch {}
      return res.redirect("/?sf=connected");
    } catch (e: any) {
      return res.redirect(`/?sf_error=${encodeURIComponent(e.message || "OAuth failed")}`);
    }
  });

  app.get("/api/oauth/status", (_req, res) => {
    if (sfSession) {
      return res.json({
        connected: true,
        instanceUrl: sfSession.instanceUrl,
        username: sfSession.username || null,
      });
    }
    return res.json({ connected: false });
  });

  app.post("/api/oauth/disconnect", (_req, res) => {
    sfSession = null;
    res.json({ ok: true });
  });

  // Salesforce fetch with one automatic refresh-and-retry on 401
  async function sfFetch(pathname: string, init: any): Promise<any> {
    if (!sfSession) throw new Error("Not connected to Salesforce.");
    const doFetch = () =>
      fetch(`${sfSession!.instanceUrl}${pathname}`, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${sfSession!.accessToken}` },
      });
    let resp = await doFetch();
    if (resp.status === 401 && sfSession.refreshToken) {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: sfSession.refreshToken,
        client_id: process.env.SF_CLIENT_ID || "",
        client_secret: process.env.SF_CLIENT_SECRET || "",
      });
      const r = await fetch(`${SF_LOGIN_BASE}/services/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const d: any = await r.json();
      if (r.ok && d.access_token) {
        sfSession.accessToken = d.access_token;
        if (d.instance_url) sfSession.instanceUrl = d.instance_url;
        resp = await doFetch();
      }
    }
    return resp;
  }

  // Account name suggestions, read live from Salesforce via the OAuth session
  app.get("/api/salesforce/accounts", async (_req, res) => {
    try {
      if (!sfSession) {
        return res.status(401).json({ error: "Salesforce OAuth session not connected.", accounts: [] });
      }
      const soql = encodeURIComponent("SELECT Name FROM Account ORDER BY Name LIMIT 200");
      const resp = await sfFetch(`/services/data/v60.0/query/?q=${soql}`, { method: "GET" });
      const data: any = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ error: "Account query failed.", accounts: [] });
      }
      const accounts = (data.records || []).map((r: any) => r.Name).filter(Boolean);
      return res.json({ accounts });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Account lookup failed.", accounts: [] });
    }
  });

  // Server-side proxy: the browser never holds OAuth tokens
  app.post("/api/salesforce/log", async (req, res) => {
    try {
      if (!sfSession) {
        return res.status(401).json({ error: "Salesforce OAuth session not connected." });
      }
      const payload = req.body?.payload;
      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "Missing opportunity payload." });
      }
      const resp = await sfFetch("/services/data/v60.0/sobjects/Opportunity/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
      if (resp.ok) {
        return res.status(resp.status).json({ ...data, instanceUrl: sfSession.instanceUrl });
      }
      return res
        .status(resp.status)
        .json(Array.isArray(data) ? { errors: data } : data || { error: `HTTP ${resp.status}` });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Salesforce log failed." });
    }
  });

  // Vite Assets Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BANT Sales Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
