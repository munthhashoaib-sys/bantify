/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Award, CheckCircle2, HelpCircle, AlertCircle, FileCheck, Tag, HelpCircle as QuestionIcon } from 'lucide-react';

export default function QualificationRubric() {
  return (
    <div className="space-y-8 animate-fade-in duration-300 font-sans text-slate-200">
      
      {/* Page Header */}
      <div className="space-y-2 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Award className="w-5 h-5" />
          </div>
          <h2 className="font-display font-black text-xl md:text-2xl text-slate-100 tracking-tight">
            Qualification Rubric
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-400 max-w-3xl leading-relaxed">
          The standard every record is scored against. The AI applies these rules; the judge validates against them; the SDR confirms them.
        </p>
      </div>

      {/* SECTION 1: Qualification ratings */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-slate-300">
            Qualification Ratings
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Strongly Qualified */}
          <div className="bg-[#0e1626] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 transition-colors">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Strongly Qualified</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans pt-1">
                3 or more BANT dimensions confirmed with concrete specifics (named numbers, dates, people, or commitments).
              </p>
            </div>
          </div>

          {/* Partially Qualified */}
          <div className="bg-[#0e1626] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 transition-colors">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Partially Qualified</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans pt-1">
                1 to 2 dimensions confirmed with specifics, OR all four dimensions mentioned but only in vague terms.
              </p>
            </div>
          </div>

          {/* Not Yet Qualified */}
          <div className="bg-[#0e1626] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3 transition-colors">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span>Not Yet Qualified</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans pt-1">
                Fewer than 2 dimensions with any concrete detail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: What counts as confirmed */}
      <section className="space-y-3">
        <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-slate-300">
          What Counts as Confirmed
        </h3>
        <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-sans">
            A dimension is confirmed when the prospect states a specific fact: a number, a date, a named person, or an explicit commitment. Vague interest, generalities, or the SDR's inference do not count as confirmation.
          </p>
        </div>
      </section>

      {/* SECTION 3: Missing information labels */}
      <section className="space-y-3">
        <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-slate-300">
          Missing Information Labels
        </h3>
        <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-5 shadow-sm divide-y divide-slate-800/80">
          <div className="pb-3.5 space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
            <span className="inline-block px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-[#070b12] text-slate-200 border border-slate-700/80 shrink-0">
              Not discussed — SDR to raise on next call
            </span>
            <span className="text-xs text-slate-300 leading-relaxed block sm:inline">
              the topic never came up on the call.
            </span>
          </div>

          <div className="pt-3.5 space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
            <span className="inline-block px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-[#070b12] text-slate-200 border border-slate-700/80 shrink-0">
              Raised but prospect deferred
            </span>
            <span className="text-xs text-slate-300 leading-relaxed block sm:inline">
              the SDR asked; the prospect declined or avoided answering.
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 4: Ambiguity rule */}
      <section className="space-y-3">
        <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-slate-300">
          Ambiguity Rule
        </h3>
        <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-sans">
            When the prospect's statement is ambiguous, it is recorded at the same level of ambiguity — never sharpened into a specific claim. Ambiguous differences between calls are tagged Clarify, with the question the SDR should ask next.
          </p>
        </div>
      </section>

      {/* SECTION 5: Comparison tags */}
      <section className="space-y-3">
        <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-slate-300">
          Comparison Tags
        </h3>
        <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-5 shadow-sm divide-y divide-slate-800/80">
          <div className="pb-3.5 space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
            <span className="inline-block px-3 py-1 rounded-md text-xs font-mono font-bold bg-slate-800/80 text-slate-300 border border-slate-700 shrink-0">
              Same
            </span>
            <span className="text-xs text-slate-300 leading-relaxed block sm:inline">
              (facts match)
            </span>
          </div>

          <div className="py-3.5 space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
            <span className="inline-block px-3 py-1 rounded-md text-xs font-mono font-bold bg-amber-500/15 text-amber-350 border border-amber-500/30 shrink-0">
              Shifted
            </span>
            <span className="text-xs text-slate-300 leading-relaxed block sm:inline">
              (a specific real-world fact changed — always stated)
            </span>
          </div>

          <div className="pt-3.5 space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
            <span className="inline-block px-3 py-1 rounded-md text-xs font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0">
              Clarify
            </span>
            <span className="text-xs text-slate-300 leading-relaxed block sm:inline">
              (same ambiguous statement read differently — resolved by asking, not guessing)
            </span>
          </div>
        </div>
      </section>

    </div>
  );
}
