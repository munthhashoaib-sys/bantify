# Product Requirements Document (PRD)

## 1. Product Name
**BANT Sales Opportunity Analyzer** (also referred to as the **BANT Opportunity Log Engine**)

---

## 2. Product Purpose
The custom utility bridges the gap between raw Sales Development Representative (SDR) customer interactions and CRM system registration. By extracting structured sales qualification details directly from verbal or written call transcripts, the application eliminates manual administrative overhead, standardizes pipeline assessments, and guarantees the seamless transmission of accurate context to Account Executives (AEs) for progressive negotiation.

---

## 3. Target Users
* **Sales Development Representatives (SDRs):** Frontline sales professionals who conduct preliminary qualification calls, verify readiness criteria, and register leads.
* **Account Executives (AEs):** Closer sales staff who receive high-context handoffs and require clear, factual briefings to prepare tailored demos.
* **Sales Operations Managers:** Leaders who oversee sales pipeline cleanlines, CRM data integrity, and strict adherence to deal-qualification frameworks.

---

## 4. Core Functionality (What the AI Actually Does)
The BANT Sales Opportunity Analyzer utilizes state-of-the-art **Gemini 3.5-Flash** server-side processing to perform deep linguistic reasoning and classification:
1. **Audio Transcription & Analysis:** Accepts raw voice uploads (MP3, WAV, or M4A) and transcodes human conversations into structured text before executing framework pattern matching.
2. **Framework Pattern Matching (BANT Matrix):** Analyzes the recording or written logs against the four qualification Pillars:
   * **Budget:** Financial capabilities, board approvals, price thresholds, or currency figures mentioned.
   * **Authority:** Internal decision chains, purchasing loops, CFO/CEO involvement, or primary stakeholders.
   * **Need:** Business operational bottlenecks, tools to modernize, manual drag, or software system compatibility issues.
   * **Timeline:** Project kickoff targets, legacy supplier expiration, or urgent calendar deadlines.
3. **Strict Compliance Handling:** Prevents hallucinated or fabricated facts. If any specific BANT criteria is omitted from the raw call, the AI asserts exactly: `"Not mentioned — SDR to follow up"` to secure CRM accuracy.
4. **Opportunity Generation & Status Matrixing:** Assigns a clear qualitative health score rating (`Strongly Qualified`, `Partially Qualified`, or `Not Yet Qualified`), drafts custom SDR recommendations, and writes concise context handover notes for the AE.

---

## 5. User Flow (Step-by-Step Interaction)
1. **Intelligent Ingestion Selection:** The SDR lands on the Salesforce Lightning-inspired dashboard. On the left side panel, they choose to either upload a raw voice file (MP3, WAV, or M4A) or copy-paste a customer transcript. They can also load pre-built demo templates.
2. **Trigger Qualification:** The SDR clicks **"Generate Opportunity Record"**.
3. **Execution State Shimmer:** While the backend server parses binary audio data or raw text and interfaces with Gemini, a progress dashboard displays step-by-step processing checks as deep reasoning happens.
4. **Salesforce Lightning Preview:** The right side panel rendering updates with a fully structured Salesforce Opportunity Card. Key metrics, status tags, clean copy buttons, and highlighted missing fields become instantly reviewable.
5. **Direct Polish (Editing & Retaining):** The SDR can directly edit fields inside the Opportunity preview to refine details before syncing.
6. **Logging & Exporting:** The SDR copy-pastes the entire styled markdown structure or copies the programmatic Salesforce JSON code payload with a single click, ready for logging.
7. **Lead History Registry:** The finalized opportunity is stored in the browser's persistent local storage. SDRs can search, filter, and review historical qualify summaries via the "Qualification Logs" tab.
