/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BantAnalysis {
  budget: string;
  authority: string;
  need: string;
  timeline: string;
}

export type QualificationStatus = 'Strongly Qualified' | 'Partially Qualified' | 'Not Yet Qualified';

export interface FieldValidation {
  field_name: string;
  status: 'pass' | 'flagged' | 'fail';
  reason: string;
  supporting_quote?: string | null;
}

export interface QualificationCheck {
  assigned_status: string;
  correct_status: string;
  matches_rubric: boolean;
}

export interface ValidationResult {
  verdict: 'PASS' | 'FLAGGED' | 'FAIL';
  fields: FieldValidation[];
  qualification_check: QualificationCheck;
  summary: string;
}

export interface SalesforceOpportunity {
  id: string;
  opportunityName: string;
  companyName: string;
  contactName: string;
  contactTitle: string;
  bant: BantAnalysis;
  qualificationStatus: QualificationStatus;
  sdrNextSteps: string;
  aeNotes: string;
  analyzedAt: string;
  transcript: string;
  competitorDetected?: boolean;
  competitorsMentioned?: string;
  competitorContext?: string;
  historicalComparison?: string;
  validationResult?: ValidationResult;
  validationVerdict?: 'Pass' | 'Flagged' | 'Fail-Corrected' | 'PASS' | 'FLAGGED' | 'FAIL';
  isCorrected?: boolean;
  companySource?: 'extracted' | 'manual' | 'edited';
  createdAt?: string;
  saveStatus?: 'saved' | 'not_saved' | 'saving';
  saveError?: string;
  salesforceId?: string;
  salesforceUrl?: string;
  salesforceLoggedAt?: string;
}

export function isKnownTitle(title?: string): boolean {
  if (!title) return false;
  const t = title.trim().toLowerCase();
  if (
    !t ||
    t === 'title' ||
    t === 'sdr contact' ||
    t.startsWith('not discussed') ||
    t.startsWith('raised but not confirmed') ||
    t.includes('sdr to raise') ||
    t.includes('prospect deferred')
  ) {
    return false;
  }
  return true;
}

export function cleanContactName(name?: string): string {
  if (!name) return 'Not discussed — SDR to raise on next call';
  let str = name.trim();
  if (str.startsWith('Not discussed') || str.startsWith('Raised but not confirmed')) {
    return str;
  }
  if (str.includes('(')) {
    const mainPart = str.split('(')[0].trim();
    if (mainPart) {
      str = mainPart;
    }
  }
  if (str.includes(' — ')) {
    str = str.split(' — ')[0].trim();
  } else if (str.includes(' - ')) {
    str = str.split(' - ')[0].trim();
  }
  return str || name;
}

export function normalizeContactFields(rawName?: string, rawTitle?: string): { contactName: string; contactTitle: string } {
  let name = (rawName || '').trim();
  let title = (rawTitle || '').trim();

  const matchParen = name.match(/^(.*?)\((.*?)\)$/);
  if (matchParen) {
    const mainName = matchParen[1].trim();
    const insideParen = matchParen[2].trim();
    if (mainName) {
      name = mainName;
    }
    if (!isKnownTitle(title) && isKnownTitle(insideParen)) {
      title = insideParen;
    }
  } else if (name.includes(' — ')) {
    const parts = name.split(' — ');
    if (parts[0].trim()) {
      name = parts[0].trim();
    }
    if (!isKnownTitle(title) && isKnownTitle(parts[1])) {
      title = parts[1].trim();
    }
  } else if (name.includes(' - ')) {
    const parts = name.split(' - ');
    if (parts[0].trim()) {
      name = parts[0].trim();
    }
    if (!isKnownTitle(title) && isKnownTitle(parts[1])) {
      title = parts[1].trim();
    }
  }

  if (!name) {
    name = 'Not discussed — SDR to raise on next call';
  }
  if (!title) {
    title = 'Not discussed — SDR to raise on next call';
  }

  return { contactName: cleanContactName(name), contactTitle: title };
}

