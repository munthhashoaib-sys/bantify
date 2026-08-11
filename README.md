# BANTify

**AI sales qualification engine: call transcripts in, verified Salesforce records out.**

BANTify turns SDR call transcripts into validated, structured Salesforce Opportunity records in under three minutes, replacing 10+ minutes of manual typing per call. Every record is audited by a second AI against the transcript and approved by a human before it touches the CRM.

> 🎥 **Demo video:** _coming soon_ · 📋 **Full PRD:** [Notion](https://eager-umbra-acc.notion.site/BANTify-Product-Requirements-Document-v2-1-3ad3fe05d4b08190a98eff349aa52ede) · 🔴 **Live demo:** _coming soon_

## Results

- **Under 3 minutes** per record, vs 10+ manual. Observed across 3-user testing with zero training
- **Under 1¢** per analysis (two AI passes: extraction + judge). Break-even at $4.47/user vs $80–150/seat competitors
- **100% of fields traced** to a transcript quote. Validated by a second AI on every run, zero fabricated data reaching the CRM

_Figures from prototype testing; time baseline pending a measured pilot._

## The problem

After every discovery call, SDRs spend 10+ minutes manually typing notes into Salesforce. Every rep does it differently, details get lost, and Account Executives walk into meetings missing the facts that win or lose deals: the deferred budget question, the skeptical IT lead, the competitor already in the room. Conversation intelligence tools record everything at $80–150 a seat and still leave qualification unstructured and CRM fields empty.

## How it works

1. A sales call transcript flows through three AI stages: extraction against a written rubric, a judge that validates every field against a transcript quote, and a comparison against past calls with the same company.
2. Everything then stops at a single human gate: the SDR review checklist, which must be fully confirmed before the record can go anywhere.
3. Once approved, the record lands in two places at once: Firestore as a full audit-trail document, and Salesforce as a structured 13-field Opportunity ready for the Account Executive.

```
Transcript in
   → AI extraction (Gemini, rubric + guardrails)
   → Judge validation (every field traced to a quote)
   → Historical comparison (Same / Shifted / Clarify)
   → SDR review checklist  ← the human approval gate
   → Firestore (one document per call, full audit trail)
   → Salesforce (13 structured fields via REST API)
   → Account Executive, briefed and ready
```

Two feedback loops close the system: Firestore feeds prior call records into the comparison ("product memory"), and the Salesforce record ID is written back into the Firestore document ("cross-reference").

## What makes it different

**A second AI audits the first.** The extraction model's output is never trusted directly. A judge pass re-reads the transcript, verifies every field, and attaches the supporting quote. Records that fail cannot be logged until corrected.

**Rules where the AI wanted opinions.** Qualification follows a written rubric (published inside the app on its own tab), so identical calls get identical ratings. Missing information gets honest labels ("Raised but prospect deferred") instead of invented answers. Ambiguous statements stay ambiguous and generate the clarifying question for the next call.

**A mandatory human checkpoint.** Nothing syncs to the CRM without the SDR confirming a four-item checklist. Stress testing showed the biggest failure mode was reps blindly trusting AI output; the checklist is the product's answer to its own most dangerous habit.

**One call, one document.** Each analysis creates a single Firestore document updated in place through every stage. This design came from a real bug: early builds silently wrote five documents per analysis, caught by counting writes across controlled test cycles and fixed by making all writes idempotent on a client-generated ID.

## Salesforce field mapping

Verified character-for-character against both the code and the live org.

| Salesforce field | Content |
| --- | --- |
| Name | Opportunity name |
| StageName | "Qualification" |
| CloseDate | Today + 90 days |
| BANT_Budget__c / BANT_Authority__c / BANT_Need__c / BANT_Timeline__c | Extracted bullets, or the missing-information label |
| Qualification_Status__c | Strongly / Partially / Not Yet Qualified |
| Recommended_Next_Step__c | Next-step bullets |
| AE_Handover_Notes__c | Full AE briefing, including competitor context |
| Historical_Opportunity_Comparison__c | Delta summary vs. the previous call, or "No previous opportunities for this company." |
| Competitor_Mentions__c | Competitor names (only when detected) |
| Description | Generation stamp with date |

## Tech stack

- **Frontend:** React 18, TypeScript, Tailwind CSS (Vite)
- **AI:** Google Gemini (gemini-3.6-flash), called server-side via Express routes; sequential two-pass pipeline (extract, then judge)
- **Database:** Google Cloud Firestore, one rich document per call
- **CRM:** Salesforce REST API with custom fields on the Opportunity object

## Running locally

```bash
npm install
export GEMINI_API_KEY=your_key_here
npm run dev
```

Requirements:

1. A Google Gemini API key (set as `GEMINI_API_KEY`, never committed)
2. A Firebase project with Firestore enabled (config in `src/firebase.ts`)
3. A Salesforce org with the custom fields above created on the Opportunity object, and your app origin added to the org's CORS allowlist
4. A Salesforce access token, entered at runtime in the app's connection panel (held in memory only, never stored)

## Deploying (Vercel)

1. Import the repo into Vercel
2. Set `GEMINI_API_KEY` as an environment variable in the Vercel project settings. Never hardcode it
3. Add the deployed domain to your Salesforce org's CORS allowlist (Setup → CORS)
4. Set usage caps on your Gemini key in Google Cloud before making the deployment public, since a public URL means public API spend

## Known limitations

- Salesforce auth is a manually refreshed access token held in browser memory; production would use OAuth through middleware
- Firestore rules are open for development; production gates access behind user login (designed, not yet built)
- CloseDate is a fixed 90-day offset, not extracted from the prospect's stated timeline
- English-only analysis
- Extraction can read ambiguous sentences differently across runs; the comparison surfaces this as a "Clarify" question rather than a false alarm
- The time-savings baseline is experience-based, pending a measured pilot

## Documentation

- [Product Requirements Document (v2.1, canonical)](https://eager-umbra-acc.notion.site/BANTify-Product-Requirements-Document-v2-1-3ad3fe05d4b08190a98eff349aa52ede)
- A documentation note worth its own line: an earlier AI-generated PRD for this project misnamed two Salesforce fields, claimed a calculation that did not exist, and omitted two fields that do. It was caught by making the AI audit its own document against the code with quoted evidence. Every layer of this product, including its documentation, is verified rather than trusted.

## Authorship

Built with AI-assisted development (Google AI Studio / Gemini, with Claude as engineering partner). Architecture, guardrail design, Salesforce schema, integration, debugging, testing methodology, and all product decisions are my own.

Munthha Shoaib · 2026
