/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SalesforceOpportunity, QualificationStatus, isKnownTitle, normalizeContactFields } from '../types';
import { normalizeCompanyName } from '../utils/companyUtils';
import { Search, Calendar, Trash2, ArrowRight, Download, Filter, Layers, X, Cloud, CloudOff, RotateCw, Check, ExternalLink } from 'lucide-react';

interface LeadHistoryProps {
  opportunities: SalesforceOpportunity[];
  onSelect: (opp: SalesforceOpportunity) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onRetrySave?: (opp: SalesforceOpportunity) => void;
}

export default function LeadHistory({ opportunities, onSelect, onDelete, onClearAll, onRetrySave }: LeadHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const sorted = [...opportunities].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.analyzedAt || 0).getTime();
    const timeB = new Date(b.createdAt || b.analyzedAt || 0).getTime();
    return timeB - timeA;
  });

  const filtered = sorted.filter((opp) => {
    const matchesSearch =
      !normalizedSearch ||
      (opp.opportunityName && opp.opportunityName.toLowerCase().includes(normalizedSearch)) ||
      (opp.companyName && opp.companyName.toLowerCase().includes(normalizedSearch)) ||
      (opp.contactName && opp.contactName.toLowerCase().includes(normalizedSearch)) ||
      (opp.qualificationStatus && opp.qualificationStatus.toLowerCase().includes(normalizedSearch));
    
    if (statusFilter === 'All') return matchesSearch;
    return opp.qualificationStatus === statusFilter && matchesSearch;
  });

  const isFilterActive = Boolean(searchTerm.trim() !== '' || statusFilter !== 'All');

  // Calculate statistics
  const total = opportunities.length;
  const stronglyQualified = opportunities.filter(o => o.qualificationStatus === 'Strongly Qualified').length;
  const partiallyQualified = opportunities.filter(o => o.qualificationStatus === 'Partially Qualified').length;
  const notQualified = opportunities.filter(o => o.qualificationStatus === 'Not Yet Qualified').length;

  const stronglyPercent = total > 0 ? Math.round((stronglyQualified / total) * 100) : 0;

  const handleExport = () => {
    if (opportunities.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(opportunities, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', 'bant_salesforce_opportunities.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getStatusColor = (status: QualificationStatus) => {
    switch (status) {
      case 'Strongly Qualified':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Partially Qualified':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Not Yet Qualified':
        return 'bg-rose-500/10 text-rose-450 border-rose-500/30';
    }
  };

  const renderRecordItem = (opp: SalesforceOpportunity) => (
    <div
      key={opp.id}
      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white transition-shadow duration-150 hover:shadow-md hover:z-10 relative"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap select-none">
          <span 
            className="font-display font-extrabold text-sm text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors" 
            onClick={() => onSelect(opp)}
          >
            {opp.opportunityName}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
            opp.qualificationStatus === 'Strongly Qualified'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : opp.qualificationStatus === 'Partially Qualified'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {opp.qualificationStatus}
          </span>
          {opp.validationVerdict && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
              opp.validationVerdict === 'Pass' || opp.validationVerdict === 'PASS'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : opp.validationVerdict === 'Flagged' || opp.validationVerdict === 'FLAGGED'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : opp.validationVerdict === 'Fail-Corrected'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              Validation: {opp.validationVerdict}
            </span>
          )}

          {opp.saveStatus === 'not_saved' ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1" title={opp.saveError || 'Write to Firestore failed'}>
              <CloudOff className="w-3 h-3 text-rose-600" />
              <span>Not saved</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <Cloud className="w-3 h-3 text-emerald-600" />
              <span>Saved</span>
            </span>
          )}

          {opp.salesforceId && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1" title={`Salesforce Opportunity ID: ${opp.salesforceId}`}>
              <Cloud className="w-3 h-3 text-indigo-600" />
              <span>Salesforce Logged</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-600 flex-wrap">
          <span>Company: <strong className="text-slate-900 font-bold">{normalizeCompanyName(opp.companyName) || '—'}</strong></span>
          {(() => {
            const norm = normalizeContactFields(opp.contactName, opp.contactTitle);
            const hasKnownTitle = isKnownTitle(norm.contactTitle);
            return (
              <span>
                Contact: <strong className="text-slate-900 font-bold">{norm.contactName}</strong>
                {hasKnownTitle && <span className="text-slate-500 font-normal"> — {norm.contactTitle}</span>}
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono select-none flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>{new Date(opp.createdAt || opp.analyzedAt).toLocaleDateString()} at {new Date(opp.createdAt || opp.analyzedAt).toLocaleTimeString()}</span>
          </span>
          <span className="text-slate-400 font-semibold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
            Firestore Doc ID: <code className="text-indigo-600 font-bold">{opp.id}</code>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end select-none flex-wrap">
        {opp.salesforceId && opp.salesforceUrl && (
          <a
            href={opp.salesforceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all cursor-pointer shadow-sm"
            title={`View Opportunity ${opp.salesforceId} in Salesforce`}
          >
            <Cloud className="w-3.5 h-3.5 text-indigo-600" />
            <span>View in Salesforce</span>
            <ExternalLink className="w-3 h-3 text-indigo-500" />
          </a>
        )}
        {opp.saveStatus === 'not_saved' && onRetrySave && (
          <button
            type="button"
            id={`retry-btn-${opp.id}`}
            onClick={() => onRetrySave(opp)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-all cursor-pointer shadow-sm"
            title="Retry saving record to Firestore"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Retry Save</span>
          </button>
        )}
        <button
          id={`view-btn-${opp.id}`}
          onClick={() => onSelect(opp)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all cursor-pointer shadow-sm"
        >
          <span>Inspect Record</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          id={`delete-btn-${opp.id}`}
          onClick={() => onDelete(opp.id)}
          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          title="Delete record"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div id="lead-history-section" className="space-y-6">
      {/* KPI metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-sans">
        <div id="kpi-total" className="bg-[#0e1626]/95 border border-slate-800 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">Total Analyzed</p>
          <p className="font-display text-2xl font-black text-slate-100 mt-1">{total}</p>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Opportunities recorded</span>
          </div>
        </div>

        <div id="kpi-qualified" className="bg-[#0e1626]/95 border border-slate-800 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-mono text-emerald-400 uppercase tracking-wider">Strongly Qualified</p>
          <p className="font-display text-2xl font-black text-emerald-300 mt-1">{stronglyQualified}</p>
          <p className="text-xs text-slate-400 mt-2">
            <strong className="text-emerald-400">{stronglyPercent}%</strong> of pipelines ready for demo
          </p>
        </div>

        <div id="kpi-partial" className="bg-[#0e1626]/95 border border-slate-800 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-mono text-amber-400 uppercase tracking-wider">Partially Qualified</p>
          <p className="font-display text-2xl font-black text-amber-300 mt-1">{partiallyQualified}</p>
          <p className="text-xs text-slate-400 mt-2">
            Requires target follow-up calls
          </p>
        </div>

        <div id="kpi-failed" className="bg-[#0e1626]/95 border border-slate-800 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-mono text-rose-400 uppercase tracking-wider">Not Yet Qualified</p>
          <p className="font-display text-2xl font-black text-rose-350 mt-1">{notQualified}</p>
          <p className="text-xs text-slate-400 mt-2">
            Disqualified or low alignment
          </p>
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center font-sans">
        
        {/* Left-aligned Search Bar & Result Count */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B929E] pointer-events-none" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[#16191F] text-white text-sm font-sans rounded-lg border-0 outline-none focus:outline-none focus:ring-2 focus:ring-[#4C8DFF] placeholder-[#8B929E] transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#8B929E] hover:text-white rounded-full transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchTerm.trim() !== '' && (
            <span className="text-[#8B929E] text-sm font-sans shrink-0">
              {filtered.length} of {opportunities.length} records
            </span>
          )}
        </div>

        {/* Qualification Filter & Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="relative shrink-0 select-none">
            <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-6 py-2 border border-slate-805 rounded-lg text-sm bg-slate-950 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              <option value="All" className="bg-[#0b101c]">All Qualifications</option>
              <option value="Strongly Qualified" className="bg-[#0b101c]">Strongly Qualified</option>
              <option value="Partially Qualified" className="bg-[#0b101c]">Partially Qualified</option>
              <option value="Not Yet Qualified" className="bg-[#0b101c]">Not Yet Qualified</option>
            </select>
          </div>

          {opportunities.length > 0 && (
            <div className="flex gap-2 font-sans select-none">
              <button
                id="export-btn"
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-sm transition-all cursor-pointer font-semibold"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON</span>
              </button>
              <button
                id="clear-all-btn"
                onClick={() => {
                  if (confirm("Are you sure you want to delete all qualification logs? This cannot be undone.")) {
                    onClearAll();
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 text-rose-400 hover:text-rose-350 bg-[#1a0f12] hover:bg-[#2b161a] border border-rose-950 rounded-lg text-sm transition-all cursor-pointer font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* History table list */}
      {opportunities.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm font-sans p-12 text-center">
          <p className="text-slate-500 font-semibold text-sm">No opportunity logs found.</p>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">
            Sift call transcripts under the "Workspace" tab to build your log history.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm font-sans p-12 text-center space-y-3">
          <p className="text-slate-700 font-semibold text-sm">No records match your search.</p>
          <div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
              }}
              className="px-4 py-2 border border-slate-300 hover:border-slate-400 bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              Clear search
            </button>
          </div>
        </div>
      ) : isFilterActive ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm font-sans animate-fade-rise divide-y divide-slate-100">
          {filtered.map(renderRecordItem)}
        </div>
      ) : (
        <div className="space-y-6 animate-fade-rise">
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 px-1">
              Most recently recorded opportunity
            </h3>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm font-sans">
              {renderRecordItem(filtered[0])}
            </div>
          </div>

          {filtered.length > 1 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 px-1">
                Earlier records
              </h3>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm font-sans divide-y divide-slate-100">
                {filtered.slice(1).map(renderRecordItem)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
