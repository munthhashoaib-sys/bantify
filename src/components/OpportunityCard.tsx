/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SalesforceOpportunity, QualificationStatus, isKnownTitle, normalizeContactFields } from '../types';
import { normalizeCompanyName, isSameCompany } from '../utils/companyUtils';
import { 
  Building2, User, Briefcase, DollarSign, ShieldAlert, CheckCircle, 
  Settings, Copy, Check, Save, Edit3, ArrowLeft, RefreshCw, AlertCircle, FileText,
  Clock, Send, MoreVertical, Smartphone, CheckCircle2, ChevronRight, MessageSquare,
  AlertTriangle, Pencil, Cloud, CloudOff, RotateCw, ExternalLink, Code, Loader2, X
} from 'lucide-react';

export function getSalesforceViewUrl(instanceUrl: string, salesforceId: string): string {
  if (!instanceUrl || !salesforceId) return '';
  const cleanUrl = instanceUrl.trim().replace(/\/+$/, '');
  const lightningBase = cleanUrl.includes('my.salesforce.com')
    ? cleanUrl.replace('my.salesforce.com', 'lightning.force.com')
    : cleanUrl;
  return `${lightningBase}/lightning/r/Opportunity/${salesforceId}/view`;
}

export function isMissingInfoLabel(text: string | null | undefined): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  return (
    trimmed.startsWith("Not discussed") ||
    trimmed.startsWith("Raised but") ||
    trimmed.startsWith("Not yet discussed") ||
    trimmed === "No previous opportunities for this company."
  );
}

export function formatTextToDashBullets(text: string | undefined | null): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (isMissingInfoLabel(trimmed)) return trimmed;

  const lines = trimmed
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bullets: string[] = [];
  for (const line of lines) {
    const cleanLine = line.replace(/^[-•*]\s*/, '').trim();
    if (cleanLine) {
      if (cleanLine.includes('— CLARIFY:') || cleanLine.startsWith('CLARIFY:')) {
        const parts = cleanLine.split(/—\s*CLARIFY:\s*|CLARIFY:\s*/i);
        const dim = parts[0]?.trim();
        const msg = parts[1]?.trim() || cleanLine;
        bullets.push(`- CLARIFY: ${dim ? `${dim} — ` : ''}${msg}`);
      } else {
        bullets.push(`- ${cleanLine}`);
      }
    }
  }

  if (bullets.length === 0) return trimmed;
  return bullets.join('\n');
}

export function renderBulletText(
  text: string | null | undefined,
  textColorClass: string = "text-slate-200",
  bulletColorClass: string = "bg-indigo-400"
) {
  if (!text) return null;
  const trimmed = text.trim();

  if (isMissingInfoLabel(trimmed)) {
    return <p className={`${textColorClass} font-medium leading-relaxed font-sans`}>{trimmed}</p>;
  }

  const lines = trimmed
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  return (
    <ul className="space-y-1.5 my-1 font-sans">
      {lines.map((line, idx) => {
        const clean = line.replace(/^[-•*]\s*/, '').trim();
        if (!clean) return null;
        return (
          <li key={idx} className="flex items-start gap-2.5">
            <span className={`w-1.5 h-1.5 rounded-full ${bulletColorClass} shrink-0 mt-2`} />
            <span className={`${textColorClass} font-medium leading-relaxed`}>{clean}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function compareDimensionFacts(
  prevText: string | undefined | null,
  currentText: string | undefined | null,
  dimName: string,
  aiReasonLine?: string
): { isShifted: boolean; tag: 'Same' | 'Shifted' | 'Clarify'; reason: string } {
  // If AI generated comparison text contains an explicit delta line for this dimension
  if (aiReasonLine) {
    const cleanAi = aiReasonLine.replace(/^[-•*]\s*/, '').trim();
    if (cleanAi.includes('— CLARIFY:') || cleanAi.includes('— CLARIFICATION:') || cleanAi.includes('CLARIFY:')) {
      const parts = cleanAi.split(/—\s*(?:CLARIFY|CLARIFICATION):\s*|CLARIFY:\s*/i);
      const reasonPart = parts[1]?.trim() || cleanAi;
      return { isShifted: false, tag: 'Clarify', reason: reasonPart };
    }
    if (cleanAi.includes('— CHANGED:') || cleanAi.includes('— SHIFTED:')) {
      const parts = cleanAi.split(/—\s*(?:CHANGED|SHIFTED):\s*/i);
      const reasonPart = parts[1]?.trim() || cleanAi;
      return { isShifted: true, tag: 'Shifted', reason: reasonPart };
    }
    if (cleanAi.includes('— UNCHANGED:') || cleanAi.includes('— SAME:')) {
      return { isShifted: false, tag: 'Same', reason: '' };
    }
  }

  const p = (prevText || '').trim();
  const c = (currentText || '').trim();

  // If both empty or both 'Not discussed'
  if (!p && !c) return { isShifted: false, tag: 'Same', reason: '' };

  // Normalize content: remove bullet markers, dashes, asterisks, collapse spaces
  const normPrev = p.replace(/^[-•*]\s*/gm, '').replace(/\s+/g, ' ').trim();
  const normCurr = c.replace(/^[-•*]\s*/gm, '').replace(/\s+/g, ' ').trim();

  // Exact normalized equality (case-insensitive) -> Same
  if (normPrev.toLowerCase() === normCurr.toLowerCase()) {
    return { isShifted: false, tag: 'Same', reason: '' };
  }

  // Check "Not discussed" / missing equivalence
  const isPNotDiscussed = !normPrev || /^not discussed/i.test(normPrev);
  const isCNotDiscussed = !normCurr || /^not discussed/i.test(normCurr);

  if (isPNotDiscussed && isCNotDiscussed) {
    return { isShifted: false, tag: 'Same', reason: '' };
  }
  if (isPNotDiscussed && !isCNotDiscussed) {
    return { isShifted: true, tag: 'Shifted', reason: `New detail added in current call` };
  }
  if (!isPNotDiscussed && isCNotDiscussed) {
    return { isShifted: true, tag: 'Shifted', reason: `Detail from prior call omitted in current call` };
  }

  // Extract numbers / monetary amounts / durations (e.g. $25k, $100k, 25,000, 6-9 months)
  const extractNumbers = (str: string) => {
    const matches = str.match(/\$?\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|m|b|thousand|million|months|weeks|days|years)?/gi);
    return matches ? Array.from(new Set(matches.map(m => m.toLowerCase().replace(/,/g, '')))) : [];
  };

  const numP = extractNumbers(normPrev);
  const numC = extractNumbers(normCurr);

  if (numP.length > 0 || numC.length > 0) {
    const pStr = numP.sort().join(', ');
    const cStr = numC.sort().join(', ');
    if (pStr !== cStr) {
      return {
        isShifted: true,
        tag: 'Shifted',
        reason: `${dimName} figure changed: ${pStr || 'unspecified'} → ${cStr || 'unspecified'}`
      };
    }
  }

  // Extract proper nouns / capitalized names / key decision roles (e.g., David Chen, Sarah, CFO, VP, CTO)
  const extractEntities = (str: string) => {
    const words = str.match(/\b[A-Z][a-z]+\b|\b(CFO|CTO|CEO|VP|SDR|AE|CapEx|ERP|CRM)\b/g);
    return words ? Array.from(new Set(words)) : [];
  };

  const entP = extractEntities(p);
  const entC = extractEntities(c);

  if (entP.length > 0 && entC.length > 0) {
    const missingInC = entP.filter(e => !entC.includes(e));
    const addedInC = entC.filter(e => !entP.includes(e));
    if (missingInC.length > 0 && addedInC.length > 0) {
      const pSet = new Set(entP);
      const cSet = new Set(entC);
      const sameEntities = entP.every(e => cSet.has(e)) && entC.every(e => pSet.has(e));
      if (!sameEntities) {
        return {
          isShifted: true,
          tag: 'Shifted',
          reason: `Key entity/role changed: ${missingInC.join(', ')} → ${addedInC.join(', ')}`
        };
      }
    }
  }

  // Check for explicit decision/status keyword shifts
  const lowP = normPrev.toLowerCase();
  const lowC = normCurr.toLowerCase();
  if (lowP.includes('approved') && !lowC.includes('approved')) {
    return { isShifted: true, tag: 'Shifted', reason: 'Status changed: no longer noted as approved' };
  }
  if (!lowP.includes('approved') && lowC.includes('approved')) {
    return { isShifted: true, tag: 'Shifted', reason: 'Status changed: now approved' };
  }

  // Check for ambiguity / specificity differences
  const ambiguityKeywords = ['rollout', 'start', 'completion', 'initiation', 'target', 'deadline', 'implementation', 'phase', 'launch'];
  const hasAmbiguityTerm = ambiguityKeywords.some(k => lowP.includes(k) || lowC.includes(k));
  if (hasAmbiguityTerm && lowP !== lowC) {
    return {
      isShifted: false,
      tag: 'Clarify',
      reason: `Ambiguous: does the ${dimName.toLowerCase()} detail refer to rollout start or completion? Confirm on next call.`
    };
  }

  // Default: If no specific differing fact (number, date, person, decision, presence/absence) can be named,
  // differences in phrasing, word choice, or bullet structure are NOT changes!
  return { isShifted: false, tag: 'Same', reason: '' };
}

export function getAiReasonForDim(dimName: string, text?: string): string | undefined {
  if (!text) return undefined;
  const lines = text.split('\n');
  for (const line of lines) {
    const clean = line.replace(/^[-•*]\s*/, '').trim();
    if (clean.toLowerCase().startsWith(dimName.toLowerCase())) {
      return clean;
    }
  }
  return undefined;
}

export function generateLocalDeltaComparison(
  prev: SalesforceOpportunity,
  curr: SalesforceOpportunity
): string {
  const prevDateObj = new Date(prev.createdAt || prev.analyzedAt || Date.now());
  const prevDateStr = isNaN(prevDateObj.getTime())
    ? 'prior call'
    : prevDateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  const diffMs = Date.now() - prevDateObj.getTime();
  const daysAgo = isNaN(diffMs) ? 0 : Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  const prevStatus = prev.qualificationStatus || 'Partially Qualified';
  const currStatus = curr.qualificationStatus || 'Partially Qualified';

  const getRank = (st: string) => {
    if (st === 'Strongly Qualified') return 3;
    if (st === 'Partially Qualified') return 2;
    if (st === 'Not Yet Qualified') return 1;
    return 0;
  };

  const prevRank = getRank(prevStatus);
  const currRank = getRank(currStatus);
  let statusSuffix = 'unchanged';
  if (currRank > prevRank) statusSuffix = 'upgraded';
  else if (currRank < prevRank) statusSuffix = 'downgraded';

  const headerLine = `Previous call: ${prevDateStr} — ${daysAgo} days ago. Status then: ${prevStatus} → Now: ${currStatus} (${statusSuffix}).`;

  const checkBant = (prevVal: string | undefined, currVal: string | undefined, name: string) => {
    const res = compareDimensionFacts(prevVal, currVal, name);
    if (res.tag === 'Shifted') {
      return `${name} — CHANGED: ${res.reason}`;
    } else if (res.tag === 'Clarify') {
      return `${name} — CLARIFY: ${res.reason}`;
    } else {
      return `${name} — UNCHANGED: ${currVal || prevVal || 'Not discussed'}`;
    }
  };

  const budgetLine = checkBant(prev.bant?.budget, curr.bant?.budget, 'Budget');
  const authorityLine = checkBant(prev.bant?.authority, curr.bant?.authority, 'Authority');
  const needLine = checkBant(prev.bant?.need, curr.bant?.need, 'Need');
  const timelineLine = checkBant(prev.bant?.timeline, curr.bant?.timeline, 'Timeline');

  return [headerLine, budgetLine, authorityLine, needLine, timelineLine].join('\n');
}

export interface HistoricalComparisonViewProps {
  text?: string;
  prevRecord?: SalesforceOpportunity | null;
  currentRecord?: SalesforceOpportunity;
  isSimulated?: boolean;
  prevDate?: string;
}

export function HistoricalComparisonView({
  text,
  prevRecord,
  currentRecord,
  isSimulated,
  prevDate
}: HistoricalComparisonViewProps) {
  if (!prevRecord && (!text || text.trim() === 'No previous opportunities for this company.')) {
    return (
      <div className="bg-[#0b101c] border border-slate-800 rounded-2xl p-4.5 text-center text-xs text-slate-400">
        No previous opportunity records found for <strong className="text-slate-200">{currentRecord?.companyName || 'this company'}</strong>. This appears to be a new account interaction.
      </div>
    );
  }

  // Extract AI reason lines if text is provided
  const getAiReason = (dim: string) => getAiReasonForDim(dim, text);

  // Compute shifts for 5 dimensions
  const dimRating = compareDimensionFacts(
    prevRecord?.qualificationStatus,
    currentRecord?.qualificationStatus,
    'Rating',
    getAiReason('Rating')
  );

  const dimBudget = compareDimensionFacts(
    prevRecord?.bant?.budget,
    currentRecord?.bant?.budget,
    'Budget',
    getAiReason('Budget')
  );

  const dimAuthority = compareDimensionFacts(
    prevRecord?.bant?.authority,
    currentRecord?.bant?.authority,
    'Authority',
    getAiReason('Authority')
  );

  const dimNeed = compareDimensionFacts(
    prevRecord?.bant?.need,
    currentRecord?.bant?.need,
    'Need',
    getAiReason('Need')
  );

  const dimTimeline = compareDimensionFacts(
    prevRecord?.bant?.timeline,
    currentRecord?.bant?.timeline,
    'Timeline',
    getAiReason('Timeline')
  );

  const shifts = [dimRating, dimBudget, dimAuthority, dimNeed, dimTimeline];
  const shiftCount = shifts.filter((s) => s.tag === 'Shifted').length;
  const clarifyCount = shifts.filter((s) => s.tag === 'Clarify').length;

  // Extract "New this call:" intelligence from text if available
  const rawLines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const newCallIdx = rawLines.findIndex((l) => l.toLowerCase().startsWith('new this call:'));
  const newCallBullets =
    newCallIdx !== -1
      ? rawLines.slice(newCallIdx + 1).filter((l) => {
          const clean = l.replace(/^[-•*]\s*/, '');
          return !/^(Budget|Authority|Need|Timeline|Rating)\s*—/i.test(clean);
        })
      : [];

  const getStatusBadgeColorClass = (status?: QualificationStatus) => {
    if (status === 'Strongly Qualified') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (status === 'Partially Qualified') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  };

  const renderStatusCell = (dim: { isShifted: boolean; tag: 'Same' | 'Shifted' | 'Clarify'; reason: string }) => {
    if (dim.tag === 'Shifted') {
      return (
        <div className="flex flex-col items-center gap-1">
          <span className="inline-block px-1.5 py-0.5 bg-amber-500/10 text-amber-400 font-bold rounded text-[9px] font-mono border border-amber-500/30">
            Shifted
          </span>
          {dim.reason && (
            <span className="text-[10px] text-amber-300 font-sans leading-tight">
              {dim.reason}
            </span>
          )}
        </div>
      );
    }
    if (dim.tag === 'Clarify') {
      return (
        <div className="flex flex-col items-center gap-1">
          <span className="inline-block px-1.5 py-0.5 bg-blue-500/10 text-blue-400 font-bold rounded text-[9px] font-mono border border-blue-500/30">
            Clarify
          </span>
          {dim.reason && (
            <span className="text-[10px] text-blue-300 font-sans leading-tight">
              {dim.reason}
            </span>
          )}
        </div>
      );
    }
    return <span className="text-[10px] text-slate-500 font-mono">Same</span>;
  };

  return (
    <div className="bg-[#0b101c] border border-slate-800 rounded-3xl overflow-hidden shadow-xl space-y-4">
      {/* HEADER */}
      <div className="bg-[#0f172a] px-5 py-4 flex items-center justify-between border-b border-slate-800/80 text-white">
        <div className="flex items-center gap-2">
          <div className="p-1 px-1.5 bg-indigo-950 text-indigo-400 border border-indigo-900 rounded font-mono text-[10px] font-black leading-none uppercase">
            BANT COMPARATIVE MATRIX
          </div>
          <h3 className="font-display font-extrabold text-[#f1f5f9] text-sm tracking-wide">
            Historical Account Comparison
          </h3>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-slate-400">
          {isSimulated ? (
            <span className="bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-md text-[9px] font-bold">
              Simulated CRM Logs
            </span>
          ) : (
            <span className="bg-indigo-950/60 text-indigo-400 border border-indigo-900 px-2 py-0.5 rounded-md">
              Verified Local Registry
            </span>
          )}
          {prevDate && <span className="hidden sm:inline">Context: {prevDate}</span>}
        </div>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          Below shows a side-by-side analysis mapping current call outputs versus previous company status.
        </p>

        {/* SIDE-BY-SIDE COMPARISON TABLE */}
        <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-[#070b13]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0e1626] font-mono text-[10px] text-slate-400 uppercase border-b border-slate-800">
                <th className="p-3 w-1/5 font-bold border-r border-slate-800">Dimension</th>
                <th className="p-3 w-1/3 font-bold border-r border-slate-800 text-slate-400">Previous Account Log</th>
                <th className="p-3 w-1/3 font-bold text-indigo-400 border-r border-slate-800">New Map (Current)</th>
                <th className="p-3 w-1/4 text-center font-bold text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-300">
              {/* 1. Rating Row */}
              <tr className={dimRating.tag === 'Shifted' ? 'bg-amber-500/5' : dimRating.tag === 'Clarify' ? 'bg-blue-500/5' : ''}>
                <td className="p-3 font-black text-slate-300 font-mono border-r border-slate-800">Rating</td>
                <td className="p-3 text-slate-400 border-r border-slate-800">
                  <span className={`px-2 py-0.5 border rounded-full text-[10px] font-mono font-bold ${getStatusBadgeColorClass(prevRecord?.qualificationStatus)}`}>
                    {prevRecord?.qualificationStatus || 'Partially Qualified'}
                  </span>
                </td>
                <td className="p-3 text-slate-200 border-r border-slate-800 font-medium">
                  <span className={`px-2 py-0.5 border rounded-full text-[10px] font-mono font-bold ${getStatusBadgeColorClass(currentRecord?.qualificationStatus)}`}>
                    {currentRecord?.qualificationStatus || 'Partially Qualified'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  {renderStatusCell(dimRating)}
                </td>
              </tr>

              {/* 2. Budget Row */}
              <tr className={dimBudget.tag === 'Shifted' ? 'bg-amber-500/5' : dimBudget.tag === 'Clarify' ? 'bg-blue-500/5' : ''}>
                <td className="p-3 font-black text-slate-300 font-mono border-r border-slate-800">Budget (B)</td>
                <td className="p-3 text-slate-400 border-r border-slate-800">
                  {renderBulletText(prevRecord?.bant?.budget, "text-slate-400 italic text-xs", "bg-slate-500")}
                </td>
                <td className="p-3 text-slate-200 border-r border-slate-800">
                  {renderBulletText(currentRecord?.bant?.budget, "text-slate-200 font-semibold text-xs", "bg-indigo-400")}
                </td>
                <td className="p-3 text-center">
                  {renderStatusCell(dimBudget)}
                </td>
              </tr>

              {/* 3. Authority Row */}
              <tr className={dimAuthority.tag === 'Shifted' ? 'bg-amber-500/5' : dimAuthority.tag === 'Clarify' ? 'bg-blue-500/5' : ''}>
                <td className="p-3 font-black text-slate-300 font-mono border-r border-slate-800">Authority (A)</td>
                <td className="p-3 text-slate-400 border-r border-slate-800">
                  {renderBulletText(prevRecord?.bant?.authority, "text-slate-400 italic text-xs", "bg-slate-500")}
                </td>
                <td className="p-3 text-slate-200 border-r border-slate-800">
                  {renderBulletText(currentRecord?.bant?.authority, "text-slate-200 font-semibold text-xs", "bg-indigo-400")}
                </td>
                <td className="p-3 text-center">
                  {renderStatusCell(dimAuthority)}
                </td>
              </tr>

              {/* 4. Need Row */}
              <tr className={dimNeed.tag === 'Shifted' ? 'bg-amber-500/5' : dimNeed.tag === 'Clarify' ? 'bg-blue-500/5' : ''}>
                <td className="p-3 font-black text-slate-300 font-mono border-r border-slate-800">Need (N)</td>
                <td className="p-3 text-slate-400 border-r border-slate-800">
                  {renderBulletText(prevRecord?.bant?.need, "text-slate-400 italic text-xs", "bg-slate-500")}
                </td>
                <td className="p-3 text-slate-200 border-r border-slate-800">
                  {renderBulletText(currentRecord?.bant?.need, "text-slate-200 font-semibold text-xs", "bg-indigo-400")}
                </td>
                <td className="p-3 text-center">
                  {renderStatusCell(dimNeed)}
                </td>
              </tr>

              {/* 5. Timeline Row */}
              <tr className={dimTimeline.tag === 'Shifted' ? 'bg-amber-500/5' : dimTimeline.tag === 'Clarify' ? 'bg-blue-500/5' : ''}>
                <td className="p-3 font-black text-slate-300 font-mono border-r border-slate-800">Timeline (T)</td>
                <td className="p-3 text-slate-400 border-r border-slate-800">
                  {renderBulletText(prevRecord?.bant?.timeline, "text-slate-400 italic text-xs", "bg-slate-500")}
                </td>
                <td className="p-3 text-slate-200 border-r border-slate-800">
                  {renderBulletText(currentRecord?.bant?.timeline, "text-slate-200 font-semibold text-xs", "bg-indigo-400")}
                </td>
                <td className="p-3 text-center">
                  {renderStatusCell(dimTimeline)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SHIFT LOG ANALYTICS */}
        <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-950/40 border border-indigo-900/60 p-3.5 rounded-xl leading-relaxed font-semibold">
          <span className="font-mono uppercase text-[9px] bg-slate-900 text-indigo-400 px-1 py-0.5 rounded shrink-0 border border-slate-800">
            SHIFT LOG ANALYTICS:
          </span>
          <span>
            {shiftCount === 0 && clarifyCount === 0
              ? 'Account parameters remain stable. Context matches previous records. Safe to log.'
              : `${shiftCount > 0 ? `Lead context shifted across ${shiftCount} distinct qualification layer${shiftCount > 1 ? 's' : ''}. ` : ''}${clarifyCount > 0 ? `${clarifyCount} dimension${clarifyCount > 1 ? 's require' : ' requires'} clarification on ambiguous details.` : ''} Update Salesforce opportunistically.`}
          </span>
        </div>

        {/* NEW INTELLIGENCE BULLETS */}
        {newCallBullets.length > 0 && (
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <div className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <span>New this call:</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {newCallBullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-[#070b13] p-2.5 rounded-xl border border-slate-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                  <span>{bullet.replace(/^[-•*]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function buildSalesforcePayload(
  opp: SalesforceOpportunity,
  opportunities: SalesforceOpportunity[] = [],
  instanceUrl: string = ''
) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 90);
  const closeDate = futureDate.toISOString().split('T')[0];

  // Map qualification status to exact required strings: "Strongly Qualified", "Partially Qualified", or "Not Yet Qualified"
  let qualStatus: 'Strongly Qualified' | 'Partially Qualified' | 'Not Yet Qualified' = 'Not Yet Qualified';
  if (opp.qualificationStatus === 'Strongly Qualified') {
    qualStatus = 'Strongly Qualified';
  } else if (opp.qualificationStatus === 'Partially Qualified') {
    qualStatus = 'Partially Qualified';
  } else {
    qualStatus = 'Not Yet Qualified';
  }

  // Competitor mentions: omit property entirely if no competitors were detected
  let competitorMentions: string | undefined = undefined;
  if (opp.competitorDetected && opp.competitorsMentioned && opp.competitorsMentioned !== 'None') {
    competitorMentions = opp.competitorsMentioned.slice(0, 255);
  }

  // Historical opportunity comparison
  let historicalComparison = opp.historicalComparison || 'No previous opportunities for this company.';
  if (!opp.historicalComparison || opp.historicalComparison === 'No previous opportunities for this company.') {
    const currentCompName = normalizeCompanyName(opp.companyName);
    if (currentCompName && opportunities && opportunities.length > 0) {
      const previousOpps = opportunities.filter(
        (o) => o.id !== opp.id && isSameCompany(o.companyName, currentCompName)
      );
      if (previousOpps.length > 0) {
        previousOpps.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.analyzedAt || 0).getTime();
          const timeB = new Date(b.createdAt || b.analyzedAt || 0).getTime();
          return timeB - timeA;
        });
        historicalComparison = generateLocalDeltaComparison(previousOpps[0], opp);
      } else {
        historicalComparison = 'No previous opportunities for this company.';
      }
    } else {
      historicalComparison = 'No previous opportunities for this company.';
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const payload: Record<string, any> = {
    Name: opp.opportunityName || `${opp.companyName || 'Salesforce'} Opportunity`,
    StageName: 'Qualification',
    CloseDate: closeDate,
    BANT_Budget__c: formatTextToDashBullets(opp.bant?.budget) || 'Not discussed — SDR to raise on next call',
    BANT_Authority__c: formatTextToDashBullets(opp.bant?.authority) || 'Not discussed — SDR to raise on next call',
    BANT_Need__c: formatTextToDashBullets(opp.bant?.need) || 'Not discussed — SDR to raise on next call',
    BANT_Timeline__c: formatTextToDashBullets(opp.bant?.timeline) || 'Not discussed — SDR to raise on next call',
    Qualification_Status__c: qualStatus,
    Recommended_Next_Step__c: formatTextToDashBullets(opp.sdrNextSteps) || 'Follow up with prospect',
    AE_Handover_Notes__c: formatTextToDashBullets(opp.aeNotes) || 'None',
    Historical_Opportunity_Comparison__c: formatTextToDashBullets(historicalComparison),
    Description: `Record generated by BANTify from call analysis on ${todayStr}.`
  };

  if (competitorMentions) {
    payload.Competitor_Mentions__c = competitorMentions;
  }

  return payload;
}

interface OpportunityCardProps {
  opp: SalesforceOpportunity;
  opportunities?: SalesforceOpportunity[];
  onUpdate: (opp: SalesforceOpportunity) => void;
  onClose: () => void;
  onRerunAnalysis?: () => void;
  onAddOpportunity?: (opp: SalesforceOpportunity) => void;
  sfInstanceUrl?: string;
  sfAccessToken?: string;
  sfIsConnected?: boolean;
  onOpenSfModal?: () => void;
}

export default function OpportunityCard({ 
  opp, 
  opportunities = [], 
  onUpdate, 
  onClose,
  onRerunAnalysis,
  onAddOpportunity,
  sfInstanceUrl = '',
  sfAccessToken = '',
  sfIsConnected = false,
  onOpenSfModal
}: OpportunityCardProps) {
  const [editedOpp, setEditedOpp] = useState<SalesforceOpportunity>(() => {
    const norm = normalizeContactFields(opp.contactName, opp.contactTitle);
    return {
      ...opp,
      contactName: norm.contactName,
      contactTitle: norm.contactTitle
    };
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Salesforce Logging States
  const [isLoggingToSf, setIsLoggingToSf] = useState(false);
  const [sfToastSuccess, setSfToastSuccess] = useState<string | null>(null);
  const [sfToastError, setSfToastError] = useState<string | null>(null);
  const [showApiPayloadToggle, setShowApiPayloadToggle] = useState(false);
  const [copiedPayloadJson, setCopiedPayloadJson] = useState(false);

  // Inline header editing state for company name
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyInputText, setCompanyInputText] = useState(opp.companyName || '');

  // Keep track of active inline-edit field bubble
  const [activeEditField, setActiveEditField] = useState<'budget' | 'authority' | 'need' | 'timeline' | 'actionPlan' | 'aeNotes' | 'general' | null>(null);
  const [editText, setEditText] = useState('');
  const [editConfidence, setEditConfidence] = useState<'confirmed' | 'implied' | 'missing'>('confirmed');

  // Manual & auto-detected bubble confidence states
  const [bubbleConfidence, setBubbleConfidence] = useState<{
    budget: 'confirmed' | 'implied' | 'missing';
    authority: 'confirmed' | 'implied' | 'missing';
    need: 'confirmed' | 'implied' | 'missing';
    timeline: 'confirmed' | 'implied' | 'missing';
  }>({
    budget: 'confirmed',
    authority: 'confirmed',
    need: 'confirmed',
    timeline: 'confirmed',
  });

  // Simple auto-detector logic for incoming records
  const detectConfidence = (val: string) => {
    if (!val) return 'missing';
    const lower = val.toLowerCase();
    if (
      lower.includes('not mentioned') || 
      lower.includes('to follow up') || 
      lower.includes('not discussed') || 
      lower.includes('prospect deferred') || 
      lower.includes('raised but not confirmed') || 
      lower.trim() === ''
    ) {
      return 'missing';
    }
    if (
      lower.includes('implied') || 
      lower.includes('vague') || 
      lower.includes('unclear') || 
      lower.includes('uncertain') || 
      lower.includes('checking') || 
      lower.includes('potential') || 
      lower.includes('casual') || 
      lower.includes('pending') || 
      lower.includes('allocated yet') || 
      lower.includes('depending')
    ) {
      return 'implied';
    }
    return 'confirmed';
  };

  // SDR Review Checklist States
  const [checklist, setChecklist] = useState({
    companyNameConfirmed: false,
    verifiedClaims: false,
    checkedFlaggedFields: false,
    confirmStatus: false
  });
  const [savedToTrackerMsg, setSavedToTrackerMsg] = useState(false);

  const allChecklistChecked = 
    checklist.companyNameConfirmed &&
    checklist.verifiedClaims && 
    checklist.checkedFlaggedFields && 
    checklist.confirmStatus;

  const getLogToSfTooltip = () => {
    if (editedOpp.salesforceId) {
      return `Logged to Salesforce (ID: ${editedOpp.salesforceId})`;
    }
    if (!sfIsConnected && !allChecklistChecked) {
      return "Salesforce connection status is disconnected and SDR Review Checklist is incomplete.";
    }
    if (!sfIsConnected) {
      return "Salesforce connection status is disconnected. Click the gear icon in the top header to connect.";
    }
    if (!allChecklistChecked) {
      return "Every item on the SDR Review Checklist must be checked before logging to Salesforce.";
    }
    return "Log opportunity record to Salesforce API";
  };

  const handleLogToSalesforce = async () => {
    if (!sfIsConnected || !sfInstanceUrl || !sfAccessToken) {
      setSfToastError("Salesforce connection is not established. Click the gear icon in the header to connect.");
      return;
    }

    if (!allChecklistChecked) {
      setSfToastError("Every item on the SDR Review Checklist must be checked before logging to Salesforce.");
      return;
    }

    setIsLoggingToSf(true);
    setSfToastError(null);
    setSfToastSuccess(null);

    const payload = buildSalesforcePayload(editedOpp, opportunities, sfInstanceUrl);
    const cleanUrl = sfInstanceUrl.trim().replace(/\/+$/, '');
    const isOAuth = sfAccessToken === 'OAUTH';
    const endpoint = isOAuth
      ? '/api/salesforce/log'
      : `${cleanUrl}/services/data/v60.0/sobjects/Opportunity/`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: isOAuth
          ? { 'Content-Type': 'application/json' }
          : {
              'Authorization': `Bearer ${sfAccessToken.trim()}`,
              'Content-Type': 'application/json'
            },
        body: JSON.stringify(isOAuth ? { payload } : payload)
      });

      if (response.ok || response.status === 201 || response.status === 200) {
        const resData = await response.json();
        const sfId = resData.id;
        const sfViewUrl = getSalesforceViewUrl(cleanUrl, sfId);

        const updated: SalesforceOpportunity = {
          ...editedOpp,
          salesforceId: sfId,
          salesforceUrl: sfViewUrl,
          salesforceLoggedAt: new Date().toISOString()
        };

        setEditedOpp(updated);
        onUpdate(updated);

        setSfToastSuccess(`Logged to Salesforce! Opportunity ID: ${sfId}`);
      } else {
        let errDetails = '';
        try {
          const errJson = await response.json();
          if (Array.isArray(errJson)) {
            errDetails = errJson.map((e: any) => `${e.errorCode ? `[${e.errorCode}] ` : ''}${e.message || JSON.stringify(e)}`).join('; ');
          } else if (errJson?.message) {
            errDetails = `${errJson.errorCode ? `[${errJson.errorCode}] ` : ''}${errJson.message}`;
          } else {
            errDetails = JSON.stringify(errJson);
          }
        } catch (e) {
          errDetails = await response.text();
        }

        let fullMsg = `HTTP ${response.status} ${response.statusText || ''}: ${errDetails}`;
        if (response.status === 401) {
          fullMsg += ' — Your access token may have expired — get a fresh one and update the connection panel.';
        }
        setSfToastError(fullMsg);
      }
    } catch (err: any) {
      setSfToastError(`Network Error: ${err.message || String(err)}`);
    } finally {
      setIsLoggingToSf(false);
    }
  };

  const getFieldValidation = (fieldKey: string) => {
    const fields = editedOpp.validationResult?.fields;
    if (!fields || fields.length === 0) return null;
    const canonical = fieldKey.toLowerCase().replace(/[^a-z]/g, '');
    return fields.find(f => {
      const fName = f.field_name.toLowerCase().replace(/[^a-z]/g, '');
      return fName === canonical || fName.includes(canonical) || canonical.includes(fName);
    });
  };

  // Sync state if prop changes
  useEffect(() => {
    const norm = normalizeContactFields(opp.contactName, opp.contactTitle);
    setEditedOpp({
      ...opp,
      contactName: norm.contactName,
      contactTitle: norm.contactTitle
    });
    setCompanyInputText(opp.companyName || '');
    setIsEditingCompany(false);
    setBubbleConfidence({
      budget: detectConfidence(opp.bant.budget),
      authority: detectConfidence(opp.bant.authority),
      need: detectConfidence(opp.bant.need),
      timeline: detectConfidence(opp.bant.timeline),
    });
  }, [opp]);

  const normCurrent = normalizeCompanyName(editedOpp.companyName);

  const handleSaveCompanyName = (newName: string) => {
    const trimmed = newName.trim();
    const norm = normalizeCompanyName(trimmed);

    // Determine whether company was extracted from AI transcript analysis or previously edited/manual
    const wasExtracted = (opp.companyName && normalizeCompanyName(opp.companyName) !== '') || editedOpp.companySource === 'extracted';

    let source: 'extracted' | 'manual' | 'edited' = 'manual';
    if (wasExtracted && norm !== '') {
      source = 'edited';
    } else if (norm !== '') {
      source = 'manual';
    }

    const updated: SalesforceOpportunity = {
      ...editedOpp,
      companyName: trimmed,
      companySource: source
    };

    setEditedOpp(updated);
    setIsEditingCompany(false);
    onUpdate(updated);
  };

  const hasFieldChanged = (prevText: string, currentText: string) => {
    if (!prevText || !currentText) return false;
    const cleanPrev = prevText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanCurrent = currentText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanPrev !== cleanCurrent;
  };

  // Generate or retrieve previous record for side-by-side representation
  const getPreviousRecordAndShifts = () => {
    if (!normCurrent) {
      return {
        record: null,
        isSimulated: false,
        date: '',
        reason: 'no_company'
      };
    }

    const matched = opportunities.find(
      (o) => o.id !== editedOpp.id && isSameCompany(o.companyName, editedOpp.companyName)
    );

    if (matched) {
      return {
        record: matched,
        isSimulated: false,
        date: new Date(matched.analyzedAt).toLocaleDateString(),
        reason: 'found'
      };
    }

    let simulated: Omit<SalesforceOpportunity, 'id' | 'analyzedAt' | 'opportunityName' | 'contactName' | 'contactTitle' | 'transcript'> | null = null;

    if (normCurrent.toLowerCase().includes('acme')) {
      simulated = {
        companyName: "Acme Corp",
        bant: {
          budget: "Pending FY26 CapEx review. Estimated at $100k maximum with rigid procurement restrictions.",
          authority: "Sarah Jenkins (VP of Finance) researching alone; Dave (CTO) has not vetted integration limits.",
          need: "Suffering from slow legacy ERP and manual spreadsheet transfers. Seeking a modern cloud transition.",
          timeline: "Flexible target. Vague kickoff target in 6-9 months depending on contract rollover."
        },
        qualificationStatus: "Partially Qualified",
        sdrNextSteps: "Check technical dependencies with Dave and book Deep Dive demo.",
        aeNotes: "Acme representative researching pricing sheets."
      };
    } else if (normCurrent.toLowerCase().includes('zenith')) {
      simulated = {
        companyName: "Zenith Tech",
        bant: {
          budget: "No dedicated budget set aside yet. Checking modular costs of starting small with basic packages.",
          authority: "David Cho (Product Analyst) playing with sandbox. CTO has not been briefed.",
          need: "SDRs complain about copying data manually into client files, but management thinks it handles well.",
          timeline: "Casual exploration. Vague target inside 6 to 12 months."
        },
        qualificationStatus: "Not Yet Qualified",
        sdrNextSteps: "Send customer case studies to David Cho to build business justification.",
        aeNotes: "A Product Analyst exploring sync setups."
      };
    }

    if (simulated) {
      return {
        record: simulated as SalesforceOpportunity,
        isSimulated: true,
        date: '3 months ago',
        reason: 'simulated'
      };
    }

    return {
      record: null,
      isSimulated: false,
      date: '',
      reason: 'none'
    };
  };

  const prevData = getPreviousRecordAndShifts();

  const handleCopyText = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAllMarkdown = () => {
    const normContact = normalizeContactFields(editedOpp.contactName, editedOpp.contactTitle);
    const markdown = `
# SALESFORCE OPPORTUNITY RECORD
---
**Opportunity Name:** ${editedOpp.opportunityName}
**Company Name:** ${editedOpp.companyName}
**Contact Name:** ${normContact.contactName}
**Contact Title:** ${normContact.contactTitle}
**Qualification Status:** ${editedOpp.qualificationStatus}

## BANT ANALYSIS MATRIX
* **Budget (B):** ${editedOpp.bant.budget} (Confidence: ${bubbleConfidence.budget})
* **Authority (A):** ${editedOpp.bant.authority} (Confidence: ${bubbleConfidence.authority})
* **Need (N):** ${editedOpp.bant.need} (Confidence: ${bubbleConfidence.need})
* **Timeline (T):** ${editedOpp.bant.timeline} (Confidence: ${bubbleConfidence.timeline})

## HAND-OFF & RETENTION
* **Recommended Next Step for SDR:** ${editedOpp.sdrNextSteps}
* **Additional Notes for Account Executive (AE):** ${editedOpp.aeNotes}

*Generated via BANTify Conversational Engine on ${new Date(editedOpp.analyzedAt).toLocaleString()}*
    `.trim();

    handleCopyText(markdown, 'markdown');
  };

  const handleCopyJSON = () => {
    const normContact = normalizeContactFields(editedOpp.contactName, editedOpp.contactTitle);
    const cleanJson = JSON.stringify({
      OpportunityName: editedOpp.opportunityName,
      CompanyName: editedOpp.companyName,
      ContactName: normContact.contactName,
      ContactTitle: normContact.contactTitle,
      QualificationStatus: editedOpp.qualificationStatus,
      BantCriteria: {
        Budget: { text: editedOpp.bant.budget, level: bubbleConfidence.budget },
        Authority: { text: editedOpp.bant.authority, level: bubbleConfidence.authority },
        Need: { text: editedOpp.bant.need, level: bubbleConfidence.need },
        Timeline: { text: editedOpp.bant.timeline, level: bubbleConfidence.timeline }
      },
      SdrNextStep: editedOpp.sdrNextSteps,
      AeHandoverNotes: editedOpp.aeNotes,
      CompetitorDetails: {
        Detected: editedOpp.competitorDetected,
        Name: editedOpp.competitorsMentioned,
        Context: editedOpp.competitorContext
      },
      AnalyzedAt: editedOpp.analyzedAt
    }, null, 2);

    handleCopyText(cleanJson, 'json');
  };

  const getStatusColorClass = (status: QualificationStatus) => {
    switch (status) {
      case 'Strongly Qualified':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Partially Qualified':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Not Yet Qualified':
        return 'bg-rose-100 text-rose-800 border-rose-300';
    }
  };

  // Turn edit mode on for a bubble
  const handleStartBubbleEdit = (field: 'budget' | 'authority' | 'need' | 'timeline' | 'actionPlan' | 'aeNotes' | 'general') => {
    setActiveEditField(field);
    if (field === 'budget') {
      setEditText(editedOpp.bant.budget);
      setEditConfidence(bubbleConfidence.budget);
    } else if (field === 'authority') {
      setEditText(editedOpp.bant.authority);
      setEditConfidence(bubbleConfidence.authority);
    } else if (field === 'need') {
      setEditText(editedOpp.bant.need);
      setEditConfidence(bubbleConfidence.need);
    } else if (field === 'timeline') {
      setEditText(editedOpp.bant.timeline);
      setEditConfidence(bubbleConfidence.timeline);
    } else if (field === 'actionPlan') {
      setEditText(editedOpp.sdrNextSteps);
    } else if (field === 'aeNotes') {
      setEditText(editedOpp.aeNotes);
    }
  };

  // Save the inline edited field bubble
  const handleSaveFieldLabel = () => {
    if (!activeEditField) return;

    const updated = { ...editedOpp };
    let finalVal = editText;

    if (activeEditField === 'budget' || activeEditField === 'authority' || activeEditField === 'need' || activeEditField === 'timeline') {
      if (editConfidence === 'missing') {
        finalVal = "Not discussed — SDR to raise on next call";
      }
      
      updated.bant[activeEditField] = finalVal;
      bubbleConfidence[activeEditField] = editConfidence;
    } else if (activeEditField === 'actionPlan') {
      updated.sdrNextSteps = finalVal;
    } else if (activeEditField === 'aeNotes') {
      updated.aeNotes = finalVal;
    }

    setEditedOpp(updated);
    setBubbleConfidence({ ...bubbleConfidence });
    onUpdate(updated);
    setActiveEditField(null);
  };

  // Returns bubble colors corresponding to confidence
  const getBubbleTheme = (confidence: 'confirmed' | 'implied' | 'missing') => {
    switch (confidence) {
      case 'confirmed':
        return {
          bg: 'bg-[#0f192b] hover:bg-[#15233c] border-slate-850 text-slate-100',
          badgeText: 'Confirmed',
          badgeBg: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400',
          accent: 'border-l-[6px] border-l-emerald-500'
        };
      case 'implied':
        return {
          bg: 'bg-[#0f192b] hover:bg-[#15233c] border-slate-850 text-slate-100',
          badgeText: 'Implied / Uncertain',
          badgeBg: 'bg-amber-500/10 border border-amber-500/30 text-amber-400',
          accent: 'border-l-[6px] border-l-amber-500'
        };
      case 'missing':
        return {
          bg: 'bg-[#0f192b] hover:bg-[#15233c] border-slate-850 text-slate-100',
          badgeText: 'Missing (SDR to Probe)',
          badgeBg: 'bg-rose-500/10 border border-rose-500/30 text-rose-450',
          accent: 'border-l-[6px] border-l-rose-500'
        };
    }
  };

  const getBantLabel = (id: string) => {
    switch (id) {
      case 'budget': return 'Budget (B)';
      case 'authority': return 'Authority (A)';
      case 'need': return 'Need (N)';
      case 'timeline': return 'Timeline (T)';
      default: return id;
    }
  };

  const getBadgeSubtitle = (confidence: 'confirmed' | 'implied' | 'missing') => {
    switch (confidence) {
      case 'confirmed':
        return 'AI extracted with high confidence';
      case 'implied':
        return 'Mentioned but not explicitly stated';
      case 'missing':
        return 'Not raised or deferred by prospect';
    }
  };

  const getBantIcon = (id: string, colorClass: string) => {
    switch (id) {
      case 'budget': return <DollarSign className={`w-5 h-5 ${colorClass}`} />;
      case 'authority': return <User className={`w-5 h-5 ${colorClass}`} />;
      case 'need': return <Briefcase className={`w-5 h-5 ${colorClass}`} />;
      case 'timeline': return <Clock className={`w-5 h-5 ${colorClass}`} />;
      default: return <MessageSquare className={`w-5 h-5 ${colorClass}`} />;
    }
  };

  return (
    <div className="bg-[#0e1626]/95 border border-slate-800 overflow-hidden shadow-2xl max-w-4xl mx-auto flex flex-col rounded-3xl text-slate-100">
      
      {/* 1. Conversational Chat Header */}
      <div className="bg-[#0b101c] text-white px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 shrink-0">
        <div>
          <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-base md:text-lg leading-tight tracking-tight text-white">
                {editedOpp.opportunityName}
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping inline-block shrink-0" />
            </div>
            
            <div className="text-xs text-slate-400 font-mono flex items-center gap-2 flex-wrap mt-1">
              {!normCurrent && !isEditingCompany ? (
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 rounded-lg p-1 px-2">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Company not identified — enter manually"
                    value={companyInputText}
                    onChange={(e) => setCompanyInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && companyInputText.trim()) {
                        handleSaveCompanyName(companyInputText);
                      }
                    }}
                    onBlur={() => {
                      if (companyInputText.trim()) {
                        handleSaveCompanyName(companyInputText);
                      }
                    }}
                    className="bg-transparent text-slate-100 placeholder:text-slate-500 font-sans text-xs outline-none w-64 md:w-80"
                  />
                  {companyInputText.trim() && (
                    <button
                      type="button"
                      onClick={() => handleSaveCompanyName(companyInputText)}
                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded cursor-pointer shrink-0"
                    >
                      Save
                    </button>
                  )}
                </div>
              ) : isEditingCompany ? (
                <div className="flex items-center gap-1.5 bg-slate-950 border border-indigo-500 rounded-lg p-1 px-2">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={companyInputText}
                    onChange={(e) => setCompanyInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveCompanyName(companyInputText);
                      } else if (e.key === 'Escape') {
                        setIsEditingCompany(false);
                      }
                    }}
                    className="bg-transparent text-slate-100 font-sans text-xs outline-none w-56 md:w-72"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveCompanyName(companyInputText)}
                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded cursor-pointer shrink-0"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingCompany(false);
                      setCompanyInputText(editedOpp.companyName || '');
                    }}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="font-semibold text-slate-100 font-sans">{editedOpp.companyName}</span>
                  {editedOpp.companySource === 'manual' && (
                    <span className="text-[10px] text-slate-400 font-sans italic font-normal ml-0.5">(Added manually)</span>
                  )}
                  {editedOpp.companySource === 'edited' && (
                    <span className="text-[10px] text-slate-400 font-sans italic font-normal ml-0.5">(Edited by SDR)</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCompanyInputText(editedOpp.companyName);
                      setIsEditingCompany(true);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Edit company name"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}

              <span className="text-slate-650">•</span>
              {(() => {
                const norm = normalizeContactFields(editedOpp.contactName, editedOpp.contactTitle);
                const hasKnownTitle = isKnownTitle(norm.contactTitle);
                return (
                  <span>
                    Contact: <span className="font-semibold text-slate-200">{norm.contactName}</span>
                    {hasKnownTitle && <span className="text-slate-400"> — {norm.contactTitle}</span>}
                  </span>
                );
              })()}
            </div>
          </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {editedOpp.saveStatus === 'not_saved' ? (
            <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-700/80 text-rose-300 text-xs px-2.5 py-1 rounded-lg font-mono font-bold">
              <CloudOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Not saved</span>
              <button
                type="button"
                onClick={() => {
                  onUpdate(editedOpp);
                }}
                className="ml-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded flex items-center gap-1 cursor-pointer"
                title="Retry saving to Firestore"
              >
                <RotateCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-mono font-semibold" title={`Firestore Doc ID: ${editedOpp.id}`}>
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved</span>
              <span className="text-slate-400 font-mono text-[10px] font-normal hidden md:inline">({editedOpp.id})</span>
            </div>
          )}

          {activeEditField === 'general' ? (
            <button
              onClick={() => {
                setActiveEditField(null);
              }}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-white rounded-lg transition-all"
            >
              Cancel Edit
            </button>
          ) : (
            <button
              onClick={() => {
                setActiveEditField('general');
                setEditText(''); // Just general marker
              }}
              className="flex items-center gap-1 px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-600 border border-indigo-500/30 text-xs font-bold text-white rounded-lg transition-all shadow-md cursor-pointer"
              title="Edit Name, Company Name, Contact details"
            >
              <Edit3 className="w-3.5 h-3.5 text-white" />
              <span>Edit Lead Intel</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Metadata Editor (for general params) */}
      {activeEditField === 'general' && (
        <div id="general-params-editor" className="bg-[#0b101c] border-b border-slate-800 p-5 space-y-4 animate-fade-in text-slate-200">
          <h4 className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
            Edit Lead Metadata parameters
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Opportunity Name</label>
              <input
                type="text"
                value={editedOpp.opportunityName}
                onChange={(e) => {
                  setEditedOpp({ ...editedOpp, opportunityName: e.target.value });
                }}
                onBlur={() => {
                  onUpdate(editedOpp);
                }}
                className="w-full text-xs border border-slate-800 rounded-lg p-2 bg-slate-950 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Company Name</label>
              <input
                type="text"
                value={editedOpp.companyName}
                onChange={(e) => {
                  setEditedOpp({ ...editedOpp, companyName: e.target.value });
                }}
                onBlur={() => {
                  onUpdate(editedOpp);
                }}
                className="w-full text-xs border border-slate-800 rounded-lg p-2 bg-slate-950 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Contact Name</label>
              <input
                type="text"
                value={editedOpp.contactName}
                onChange={(e) => {
                  setEditedOpp({ ...editedOpp, contactName: e.target.value });
                }}
                onBlur={() => {
                  onUpdate(editedOpp);
                }}
                className="w-full text-xs border border-slate-800 rounded-lg p-2 bg-slate-950 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Contact Title</label>
              <input
                type="text"
                value={editedOpp.contactTitle}
                onChange={(e) => {
                  setEditedOpp({ ...editedOpp, contactTitle: e.target.value });
                }}
                onBlur={() => {
                  onUpdate(editedOpp);
                }}
                className="w-full text-xs border border-slate-800 rounded-lg p-2 bg-slate-950 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-between items-center bg-[#070b13] border border-slate-850 p-3 rounded-lg text-xs">
            <span className="text-slate-500 font-sans italic">Changes auto-save locally to qualifying records.</span>
            <button
              onClick={() => setActiveEditField(null)}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              Done Editing
            </button>
          </div>
        </div>
      )}

      {/* 2. Conversational Message Workspace (Vertically scrolling thread) */}
      <div 
        id="chat-scroller-viewport" 
        className="p-4 sm:p-6 overflow-y-auto max-h-[750px] min-h-[440px] bg-[#090d16] relative border-b border-slate-800"
        style={{ backgroundImage: 'radial-gradient(#1e293b 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}
      >
        <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-6 items-start">

          {/* LEFT COLUMN BLOCK 1: Record Header, Competitor Alert, Validation Banner */}
          <div className="order-1 min-[900px]:col-span-7 space-y-4">
            {/* LLM-as-Judge Validation Banner */}
            {(() => {
              const vResult = editedOpp.validationResult;
              const verdict = vResult?.verdict || 'PASS';

              if (verdict === 'PASS') {
                return (
                  <div id="validation-pass-badge" className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-emerald-300 flex items-center justify-between gap-3 font-sans shadow-md">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-display font-extrabold text-xs text-emerald-400 uppercase tracking-wider">
                        Validated — all fields traced to transcript
                      </span>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold rounded-lg uppercase tracking-wider shrink-0">
                      Audit passed
                    </span>
                  </div>
                );
              }

              if (verdict === 'FLAGGED') {
                return (
                  <div id="validation-flagged-banner" className="w-full bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4.5 text-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between font-sans shadow-lg animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="font-display font-black text-xs text-amber-300 uppercase tracking-wide">
                          Validation warning — review flagged fields before logging.
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                          {vResult?.summary || "Some extracted fields need SDR review before saving."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('sdr-review-checklist-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer"
                    >
                      Review Flagged Fields
                    </button>
                  </div>
                );
              }

              if (verdict === 'FAIL') {
                const failedFieldsList = vResult?.fields?.filter(f => f.status === 'fail' || f.status === 'flagged') || [];

                return (
                  <div id="validation-fail-banner" className="w-full bg-rose-950/80 border-2 border-rose-500/60 rounded-2xl p-5 text-slate-100 space-y-4 font-sans shadow-xl animate-fade-in">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl shrink-0 mt-0.5">
                        <ShieldAlert className="w-6 h-6 text-rose-400" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-display font-black text-sm text-rose-300 uppercase tracking-wide leading-tight">
                          Validation failed — this record contains unsupported information and cannot be logged until corrected
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {vResult?.summary || "The independent LLM validator identified unverified claims or unsupported amounts not present in the transcript."}
                        </p>
                      </div>
                    </div>

                    {failedFieldsList.length > 0 && (
                      <div className="bg-[#0b101c] border border-rose-500/40 rounded-xl p-4 space-y-2.5 text-xs">
                        <span className="font-mono text-[10px] text-rose-400 font-bold uppercase tracking-wider block">
                          Failed / Flagged Audit Breakdown:
                        </span>
                        <ul className="space-y-2">
                          {failedFieldsList.map((f, idx) => (
                            <li key={idx} className="flex flex-col gap-0.5 border-l-2 border-rose-500 pl-3 py-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-rose-300 uppercase font-mono text-[11px]">{f.field_name}:</span>
                                <span className={`px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase rounded ${
                                  f.status === 'fail' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}>
                                  {f.status}
                                </span>
                              </div>
                              <p className="text-slate-300 text-xs">{f.reason}</p>
                              {f.supporting_quote && (
                                <p className="text-[10px] text-slate-400 italic font-mono">"{f.supporting_quote}"</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {onRerunAnalysis && (
                        <button
                          type="button"
                          onClick={onRerunAnalysis}
                          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Re-run Analysis</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('sdr-review-checklist-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Edit Fields Manually</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return null;
            })()}
          </div>

          {/* RIGHT COLUMN BLOCK 2: BANT CARDS COLUMN (Budget, Authority, Need, Timeline) */}
          <div className="order-2 min-[900px]:col-span-5 min-[900px]:col-start-8 min-[900px]:row-start-1 min-[900px]:row-span-6 space-y-4">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 uppercase tracking-wider select-none border-b border-slate-800/80 pb-2">
              <span>— Structured BANT Findings —</span>
              <span className="text-indigo-400 font-bold">4 Parameters</span>
            </div>

            {[
              { id: 'budget' as const, label: 'Budget (B)', bulletColor: 'bg-emerald-400' },
              { id: 'authority' as const, label: 'Authority (A)', bulletColor: 'bg-indigo-400' },
              { id: 'need' as const, label: 'Need (N)', bulletColor: 'bg-amber-400' },
              { id: 'timeline' as const, label: 'Timeline (T)', bulletColor: 'bg-teal-400' }
            ].map((field) => {
              const conf = bubbleConfidence[field.id];
              const theme = getBubbleTheme(conf);
              const rawVal = editedOpp.bant[field.id];
              const isEditingThis = activeEditField === field.id;

              const fieldVal = getFieldValidation(field.id);
              const isFieldFlagged = fieldVal?.status === 'flagged';
              const isFieldFailed = fieldVal?.status === 'fail';

              let cardOutline = theme.accent;
              let cardBg = theme.bg;

              if (isFieldFailed) {
                cardOutline = 'border-2 border-rose-500/80 ring-2 ring-rose-500/30';
                cardBg = 'bg-[#1a0f12] text-slate-100';
              } else if (isFieldFlagged) {
                cardOutline = 'border border-amber-500/40';
                cardBg = 'bg-amber-500/[0.06] text-slate-100';
              }

              return (
                <div 
                  key={field.id}
                  id={`bant-bubble-${field.id}`}
                  className="flex items-start gap-3 w-full select-none"
                >
                  <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 text-indigo-400 flex items-center justify-center shrink-0 shadow-md">
                    {getBantIcon(field.id, 'text-indigo-400')}
                  </div>

                  <div 
                    className={`w-full text-slate-100 rounded-3xl rounded-tl-none p-4.5 pb-4 shadow-lg border cursor-pointer group transition-all duration-200 relative ${cardBg} ${cardOutline} ${
                      isEditingThis ? 'ring-2 ring-indigo-500 scale-[1.01]' : 'hover:scale-[1.005]'
                    }`}
                    onClick={() => {
                      if (!isEditingThis) handleStartBubbleEdit(field.id);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-black text-xs uppercase tracking-wider text-slate-400">
                          {getBantLabel(field.id)}
                        </span>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyText(rawVal, field.id);
                          }}
                          className="p-1 text-slate-500 hover:text-indigo-400 rounded hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1"
                          title={`Copy ${getBantLabel(field.id)} text`}
                        >
                          {copiedField === field.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[10px] text-emerald-400 font-sans font-bold">Copied!</span>
                            </>
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex flex-col items-end gap-0.5 select-none">
                        <div className="flex items-center gap-1.5">
                          <span 
                            className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase ${theme.badgeBg}`}
                            title={getBadgeSubtitle(conf)}
                          >
                            {theme.badgeText}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isEditingThis ? (
                      <div 
                        className="space-y-4 mt-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 pb-3 text-slate-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-1">
                          <label className="font-mono text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                            Qualifying Detail Text:
                          </label>
                          <textarea
                            id={`input-edit-${field.id}`}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full h-24 text-sm font-sans p-3 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl bg-[#090d16] text-white"
                            placeholder="Provide details..."
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="font-mono text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                            State Confidence Level Indicator:
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditConfidence('confirmed');
                              }}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                                editConfidence === 'confirmed'
                                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-md'
                                  : 'bg-[#121c30] hover:bg-[#1a2944] text-slate-300 border-slate-800'
                              }`}
                            >
                              Confirmed
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditConfidence('implied');
                              }}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                                editConfidence === 'implied'
                                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md'
                                  : 'bg-[#121c30] hover:bg-[#1a2944] text-slate-300 border-slate-800'
                              }`}
                            >
                              Implied
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditConfidence('missing');
                                setEditText("Not discussed — SDR to raise on next call");
                              }}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                                editConfidence === 'missing'
                                  ? 'bg-rose-500 text-white border-rose-600 shadow-md'
                                  : 'bg-[#121c30] hover:bg-[#1a2944] text-slate-300 border-slate-800'
                              }`}
                            >
                              Missing
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setActiveEditField(null)}
                            className="px-3 py-1.5 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold rounded-lg text-xs transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveFieldLabel}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors shadow-md"
                          >
                            Confirm & Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="font-sans text-xs sm:text-sm leading-relaxed break-words space-y-2">
                        {renderBulletText(rawVal, "text-slate-200 font-medium", field.bulletColor)}

                        {isFieldFailed && fieldVal && (
                          <div className="mt-3 p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs text-rose-200 space-y-1">
                            <div className="font-bold font-mono text-[10px] uppercase text-rose-400 flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4 text-rose-400" />
                              <span>Judge Failure Reason</span>
                            </div>
                            <p className="leading-relaxed">{fieldVal.reason}</p>
                          </div>
                        )}

                        {isFieldFlagged && fieldVal && (
                          <div className="mt-2.5 px-3 py-2 bg-amber-500/[0.06] border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center gap-2 max-w-full overflow-hidden">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <p className="truncate text-xs text-amber-200 font-sans" title={fieldVal.reason}>
                              <span className="font-bold uppercase text-[10px] text-amber-400 mr-1.5 font-mono">Flagged:</span>
                              {fieldVal.reason}
                            </p>
                          </div>
                        )}
                        
                        {conf === 'missing' && !isFieldFailed && !isFieldFlagged && (
                          <div className="text-[11px] italic font-medium font-sans text-rose-400 flex items-center gap-1 pt-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>Needs vetting by SDR.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* LEFT COLUMN BLOCK 3: RECOMMENDED NEXT STEP FOR SDR */}
          <div className="order-3 min-[900px]:col-span-7 space-y-4">
            <div 
              id="playbook-sdr-bubble" 
              className="flex items-start gap-3 w-full cursor-pointer group select-none"
              onClick={() => {
                if (activeEditField !== 'actionPlan') handleStartBubbleEdit('actionPlan');
              }}
            >
              <div className="w-9 h-9 rounded-full bg-slate-900 text-teal-400 flex items-center justify-center shrink-0 border border-slate-800 shadow-md">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>

              <div className={`w-full bg-[#0e1626] border border-slate-800 text-slate-100 rounded-3xl rounded-tl-none p-5 pb-4 shadow-lg relative group hover:bg-[#121c30] transition-all ${
                activeEditField === 'actionPlan' ? 'ring-2 ring-indigo-500' : ''
              }`}>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <span className="font-display font-black text-xs uppercase tracking-wider text-emerald-400">
                    Action Plan & Recommended Next Step for SDR
                  </span>
                  <span className="text-[9px] opacity-0 group-hover:opacity-100 select-none bg-[#090d16] border border-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono">
                    Tap to Edit
                  </span>
                </div>

                {activeEditField === 'actionPlan' ? (
                  <div onClick={(e) => e.stopPropagation()} className="space-y-3 mt-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full h-24 text-xs font-sans p-2 border border-slate-800 rounded-lg text-white bg-[#090d16]"
                    />
                    <div className="flex justify-end gap-1.5 text-xs">
                      <button
                        onClick={() => setActiveEditField(null)}
                        className="px-3 py-1 border border-slate-800 rounded-lg text-slate-400"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveFieldLabel}
                        className="px-3.5 py-1 bg-emerald-600 text-white font-bold rounded-lg shadow-md"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  renderBulletText(editedOpp.sdrNextSteps, "text-[#34d399] text-sm font-semibold", "bg-emerald-400")
                )}
              </div>
            </div>
          </div>

          {/* LEFT COLUMN BLOCK 4: AE NOTES */}
          <div className="order-4 min-[900px]:col-span-7 space-y-4">
            <div 
              id="ae-briefing-bubble" 
              className="flex items-start gap-3 w-full cursor-pointer group select-none"
              onClick={() => {
                if (activeEditField !== 'aeNotes') handleStartBubbleEdit('aeNotes');
              }}
            >
              <div className="w-9 h-9 rounded-full bg-slate-900 text-indigo-400 flex items-center justify-center shrink-0 border border-slate-800 shadow-md">
                <FileText className="w-4 h-4 text-indigo-400" />
              </div>

              <div className={`w-full bg-[#0e1626] border border-slate-800 text-slate-100 rounded-3xl rounded-tl-none p-5 pb-4 shadow-lg relative hover:bg-[#121c30] transition-all ${
                activeEditField === 'aeNotes' ? 'ring-2 ring-indigo-500' : ''
              }`}>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <span className="font-display font-black text-xs uppercase tracking-wider text-indigo-400">
                    Account Executive (AE) Handover Notes
                  </span>
                  <span className="text-[9px] opacity-0 group-hover:opacity-100 select-none bg-[#090d16] border border-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono">
                    Tap to Edit
                  </span>
                </div>

                {activeEditField === 'aeNotes' ? (
                  <div onClick={(e) => e.stopPropagation()} className="space-y-3 mt-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full h-28 text-xs font-sans p-2 border border-slate-800 rounded-lg text-white bg-[#090d16]"
                    />
                    <div className="flex justify-end gap-1.5 text-xs">
                      <button
                        onClick={() => setActiveEditField(null)}
                        className="px-3 py-1 border border-slate-800 rounded-lg text-slate-400"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveFieldLabel}
                        className="px-3.5 py-1 bg-emerald-600 text-white font-bold rounded-lg shadow-md"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  renderBulletText(editedOpp.aeNotes, "text-slate-300 text-xs sm:text-sm font-medium", "bg-indigo-400")
                )}
              </div>
            </div>
          </div>

          {/* LEFT COLUMN BLOCK 5: HISTORICAL COMPARISON */}
          <div id="previous-opp-comparison-card-wrapper" className="order-5 min-[900px]:col-span-7 space-y-4">
            {(() => {
              let displayComp = editedOpp.historicalComparison;
              if (!displayComp || displayComp === 'No previous opportunities for this company.') {
                const matchedPrev = prevData.record;
                if (matchedPrev && normCurrent) {
                  displayComp = generateLocalDeltaComparison(matchedPrev, editedOpp);
                } else {
                  displayComp = 'No previous opportunities for this company.';
                }
              }
              return (
                <HistoricalComparisonView
                  text={displayComp}
                  prevRecord={prevData.record}
                  currentRecord={editedOpp}
                  isSimulated={prevData.isSimulated}
                  prevDate={prevData.date}
                />
              );
            })()}
          </div>

          {/* LEFT COLUMN BLOCK 6: RAW TRANSCRIPT LOG */}
          {editedOpp.transcript && (
            <div className="order-6 min-[900px]:col-span-7 space-y-4">
              <div className="border border-slate-800 bg-[#070b13]/50 rounded-3xl p-5 shadow-sm">
                <details className="cursor-pointer focus:outline-none group">
                  <summary className="text-xs font-mono font-bold text-slate-400 select-none flex items-center justify-between">
                    <span>View Raw Ingested Call Transcript Log</span>
                    <span className="text-[10px] text-indigo-400 hover:underline font-normal group-open:hidden">Show Transcript</span>
                    <span className="text-[10px] text-indigo-400 hover:underline font-normal hidden group-open:inline">Hide Transcript</span>
                  </summary>
                  <div className="mt-4 p-4 bg-slate-950 text-slate-300 font-mono text-[11px] leading-relaxed rounded-2xl max-h-60 overflow-y-auto whitespace-pre-line border border-slate-850 pointer-events-auto">
                    {editedOpp.transcript}
                  </div>
                </details>
              </div>
            </div>
          )}

        </div>

        {/* 6.5 SDR Review Checklist & Manual Sign-off */}
        <div id="sdr-review-checklist-section" className="mx-auto max-w-4xl bg-[#0b101c] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 font-sans">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-950 text-indigo-400 border border-indigo-900 rounded-lg">
                <CheckCircle className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-sm text-slate-100 uppercase tracking-wide">
                  SDR Review Checklist & Manual Audit Sign-Off
                </h3>
                <p className="text-xs text-slate-400">
                  Verify and sign off on field accuracy before logging or saving this opportunity record.
                </p>
              </div>
            </div>
            {editedOpp.validationVerdict && (
              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                editedOpp.validationVerdict === 'Pass' || editedOpp.validationVerdict === 'PASS'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : editedOpp.validationVerdict === 'Flagged' || editedOpp.validationVerdict === 'FLAGGED'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : editedOpp.validationVerdict === 'Fail-Corrected'
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                Verdict: {editedOpp.validationVerdict === 'FAIL' ? 'FAIL (Requires Manual Correction)' : editedOpp.validationVerdict}
              </span>
            )}
          </div>

          <div className="space-y-3 pt-1">
            {/* Item 1: Company Name Confirmed */}
            <div 
              onClick={() => setChecklist({ ...checklist, companyNameConfirmed: !checklist.companyNameConfirmed })}
              className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900/80 transition-colors"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={checklist.companyNameConfirmed}
                onClick={(e) => {
                  e.stopPropagation();
                  setChecklist({ ...checklist, companyNameConfirmed: !checklist.companyNameConfirmed });
                }}
                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer ${
                  checklist.companyNameConfirmed 
                    ? 'bg-[#007AFF] text-white border border-[#007AFF] shadow-sm' 
                    : 'bg-slate-900 border border-slate-700 hover:border-slate-500'
                }`}
              >
                {checklist.companyNameConfirmed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
              <span className="text-xs text-slate-200 leading-relaxed font-sans select-none">
                <strong className="text-white">1. Company Name Confirmed:</strong> I confirm the company name (<span className="text-indigo-400 font-bold">{normCurrent || 'Not identified'}</span>) is accurate or has been manually supplied.
              </span>
            </div>

            {/* Item 2: Transcript Traceability */}
            <div 
              onClick={() => setChecklist({ ...checklist, verifiedClaims: !checklist.verifiedClaims })}
              className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900/80 transition-colors"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={checklist.verifiedClaims}
                onClick={(e) => {
                  e.stopPropagation();
                  setChecklist({ ...checklist, verifiedClaims: !checklist.verifiedClaims });
                }}
                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer ${
                  checklist.verifiedClaims 
                    ? 'bg-[#007AFF] text-white border border-[#007AFF] shadow-sm' 
                    : 'bg-slate-900 border border-slate-700 hover:border-slate-500'
                }`}
              >
                {checklist.verifiedClaims && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
              <span className="text-xs text-slate-200 leading-relaxed font-sans select-none">
                <strong className="text-white">2. Transcript Traceability:</strong> I have reviewed all BANT criteria against the original transcript and confirmed there are no fabricated details.
              </span>
            </div>

            {/* Item 3: Audit Correction */}
            <div 
              onClick={() => setChecklist({ ...checklist, checkedFlaggedFields: !checklist.checkedFlaggedFields })}
              className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900/80 transition-colors"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={checklist.checkedFlaggedFields}
                onClick={(e) => {
                  e.stopPropagation();
                  setChecklist({ ...checklist, checkedFlaggedFields: !checklist.checkedFlaggedFields });
                }}
                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer ${
                  checklist.checkedFlaggedFields 
                    ? 'bg-[#007AFF] text-white border border-[#007AFF] shadow-sm' 
                    : 'bg-slate-900 border border-slate-700 hover:border-slate-500'
                }`}
              >
                {checklist.checkedFlaggedFields && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
              <span className="text-xs text-slate-200 leading-relaxed font-sans select-none">
                <strong className="text-white">3. Audit Correction:</strong> I have reviewed and resolved any judge-flagged warnings or failed fields above.
              </span>
            </div>

            {/* Item 4: Rubric Alignment */}
            <div 
              onClick={() => setChecklist({ ...checklist, confirmStatus: !checklist.confirmStatus })}
              className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900/80 transition-colors"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={checklist.confirmStatus}
                onClick={(e) => {
                  e.stopPropagation();
                  setChecklist({ ...checklist, confirmStatus: !checklist.confirmStatus });
                }}
                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer ${
                  checklist.confirmStatus 
                    ? 'bg-[#007AFF] text-white border border-[#007AFF] shadow-sm' 
                    : 'bg-slate-900 border border-slate-700 hover:border-slate-500'
                }`}
              >
                {checklist.confirmStatus && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
              <span className="text-xs text-slate-200 leading-relaxed font-sans select-none">
                <strong className="text-white">4. Rubric Alignment:</strong> I confirm the Qualification Status (<span className="text-indigo-400 font-bold">{editedOpp.qualificationStatus}</span>) strictly adheres to the SDR qualification rubric.
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-slate-500 italic">
              {allChecklistChecked 
                ? "Checklist complete. You can now save or log this record." 
                : "Complete all 4 review items above to confirm manual audit."}
            </p>

            <button
              type="button"
              disabled={!allChecklistChecked}
              onClick={() => {
                const updated: SalesforceOpportunity = {
                  ...editedOpp,
                  validationVerdict: editedOpp.validationVerdict === 'FAIL' ? 'Fail-Corrected' : (editedOpp.validationVerdict || 'Pass'),
                  isCorrected: true
                };
                setEditedOpp(updated);

                // Final human-review confirmation is the explicit save gate.
                if (onAddOpportunity) {
                  onAddOpportunity(updated);
                } else {
                  onUpdate(updated);
                }

                setSavedToTrackerMsg(true);
                setTimeout(() => setSavedToTrackerMsg(false), 4000);
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Confirm Manual Edits & Save Record</span>
            </button>
          </div>

          {savedToTrackerMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center justify-between gap-2 font-semibold animate-fade-in flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Saved to Firestore Opportunity Record Tracker as "{editedOpp.validationVerdict}"!</span>
              </div>
              <span className="font-mono text-[10px] text-emerald-400/90 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 shrink-0">
                Doc ID: {editedOpp.id}
              </span>
            </div>
          )}
        </div>

      </div>

      {/* Salesforce Toasts */}
      {sfToastSuccess && (
        <div className="mx-6 mt-4 p-3.5 bg-emerald-950/90 border border-emerald-600/80 text-emerald-200 text-xs rounded-xl flex items-center justify-between gap-3 font-sans animate-fade-in flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{sfToastSuccess}</span>
          </div>
          <div className="flex items-center gap-2">
            {editedOpp.salesforceUrl && (
              <a
                href={editedOpp.salesforceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>View in Salesforce</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setSfToastSuccess(null)}
              className="p-1 hover:bg-emerald-900/60 rounded text-emerald-300 hover:text-white cursor-pointer"
              title="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {sfToastError && (
        <div className="mx-6 mt-4 p-3.5 bg-rose-950/90 border border-rose-600/80 text-rose-200 text-xs rounded-xl flex items-start justify-between gap-3 font-sans animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-rose-100 block mb-0.5">Salesforce API Error</strong>
              <span className="text-[11px] leading-relaxed font-mono">{sfToastError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSfToastError(null)}
            className="p-1 hover:bg-rose-900/60 rounded text-rose-300 hover:text-white cursor-pointer shrink-0"
            title="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View API Payload Code Block Toggle */}
      {showApiPayloadToggle && (
        <div className="mx-6 mt-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 font-mono animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Salesforce API POST Payload</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const payload = buildSalesforcePayload(editedOpp, opportunities, sfInstanceUrl);
                  navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                  setCopiedPayloadJson(true);
                  setTimeout(() => setCopiedPayloadJson(false), 2000);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-sans font-bold rounded flex items-center gap-1 cursor-pointer"
              >
                {copiedPayloadJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedPayloadJson ? 'Copied Payload!' : 'Copy JSON'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowApiPayloadToggle(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-900 cursor-pointer"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <pre className="text-[11px] text-indigo-300 bg-[#070b13] p-3.5 rounded-xl border border-slate-850 overflow-x-auto max-h-72 leading-relaxed selection:bg-indigo-900 selection:text-white">
            <code>{JSON.stringify(buildSalesforcePayload(editedOpp, opportunities, sfInstanceUrl), null, 2)}</code>
          </pre>
        </div>
      )}

      {/* 7. Bottom Sync Actions dashboard bar */}
      <div className="p-6 bg-[#0b101c] border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        <div className="space-y-1">
          <div id="qualification-rating-display" className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase text-slate-400">Pipeline Rating:</span>
            <select
              value={editedOpp.qualificationStatus}
              onChange={(e) => {
                const updated = { ...editedOpp, qualificationStatus: e.target.value as QualificationStatus };
                setEditedOpp(updated);
                onUpdate(updated);
              }}
              className="border border-slate-800 rounded px-2.5 py-1 text-xs font-mono font-bold bg-[#070b13] text-slate-200 capitalize focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Strongly Qualified" className="bg-[#0b101c]">Strongly Qualified</option>
              <option value="Partially Qualified" className="bg-[#0b101c]">Partially Qualified</option>
              <option value="Not Yet Qualified" className="bg-[#0b101c]">Not Yet Qualified</option>
            </select>
          </div>
          <p className="text-[10px] text-slate-500 font-sans italic">Determines lightning routing priorities on opportunity sync.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 font-sans">
          <button
            type="button"
            onClick={() => setShowApiPayloadToggle(!showApiPayloadToggle)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 border rounded-xl transition-all font-bold text-xs cursor-pointer ${
              showApiPayloadToggle 
                ? 'bg-indigo-950/80 border-indigo-600 text-indigo-300' 
                : 'bg-slate-800/80 hover:bg-slate-750 text-slate-200 border-slate-700/80'
            }`}
            title="Toggle viewing exact Salesforce API payload JSON"
          >
            <Code className="w-4 h-4 text-indigo-400" />
            <span>View API payload</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAllMarkdown}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl transition-all font-bold text-xs cursor-pointer"
            title="Copies ready structured copy log"
          >
            {copiedField === 'markdown' ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied Log Layout</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copy Copy-Ready Log</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyJSON}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-750 text-slate-200 border border-slate-700/80 rounded-xl transition-all font-sans font-bold text-xs cursor-pointer"
            title="Copy structured json package"
          >
            {copiedField === 'json' ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied JSON Payload</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copy Payload JSON</span>
              </>
            )}
          </button>

          {editedOpp.salesforceId ? (
            <a
              href={editedOpp.salesforceUrl || getSalesforceViewUrl(sfInstanceUrl, editedOpp.salesforceId)}
              target="_blank"
              rel="noopener noreferrer"
              id="view-sf-link-btn"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600/90 text-emerald-300 rounded-xl font-bold text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer"
              title={`View Opportunity ${editedOpp.salesforceId} in Salesforce UI`}
            >
              <Cloud className="w-4 h-4 text-emerald-400" />
              <span>View in Salesforce</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            </a>
          ) : (
            <div title={getLogToSfTooltip()} className="inline-block">
              <button
                type="button"
                id="log-to-sf-btn"
                disabled={!sfIsConnected || !allChecklistChecked || isLoggingToSf}
                onClick={handleLogToSalesforce}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs transition-all tracking-wide shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.55)] cursor-pointer"
              >
                {isLoggingToSf ? (
                  <>
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                    <span>Logging to Salesforce...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-white/95" />
                    <span>Log to Salesforce</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
