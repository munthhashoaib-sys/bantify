/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes a company name.
 * Trims whitespace and treats missing-information labels as empty string "".
 */
export function normalizeCompanyName(name?: string | null): string {
  if (!name) return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  const missingLabels = [
    '',
    'not mentioned',
    'unknown',
    'n/a',
    'na',
    'none',
    'not provided',
    'not discussed',
    'not discussed — sdr to raise on next call',
    'raised but not confirmed — prospect deferred, sdr to probe further',
    'company not identified',
    'unnamed company',
    'unnamed company opportunity',
    'not listed'
  ];

  if (
    missingLabels.includes(lower) ||
    lower.startsWith('not discussed') ||
    lower.startsWith('raised but not confirmed') ||
    lower.startsWith('company not identified')
  ) {
    return '';
  }

  return trimmed;
}

/**
 * Checks if two company names match case-insensitively with exact match after normalization.
 */
export function isSameCompany(nameA?: string | null, nameB?: string | null): boolean {
  const normA = normalizeCompanyName(nameA);
  const normB = normalizeCompanyName(nameB);
  if (!normA || !normB) return false;
  return normA.toLowerCase() === normB.toLowerCase();
}
