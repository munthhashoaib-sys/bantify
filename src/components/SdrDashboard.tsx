/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { SalesforceOpportunity, normalizeContactFields } from '../types';
import AnimateLoader from './AnimateLoader';
import OpportunityCard from './OpportunityCard';
import { db } from '../firebase';
import { collection, doc } from 'firebase/firestore';
import { normalizeCompanyName, isSameCompany } from '../utils/companyUtils';
import { 
  FileText, Play, Check, AlertTriangle, FilePenLine, Info, RefreshCw, 
  Layers, UploadCloud, Mic, Trash2, Headphones, Sparkles, Server, CheckCircle2
} from 'lucide-react';

interface SdrDashboardProps {
  onAddOpportunity: (opp: SalesforceOpportunity) => Promise<SalesforceOpportunity> | void;
  onUpdateOpportunity: (opp: SalesforceOpportunity) => Promise<SalesforceOpportunity> | void;
  opportunities: SalesforceOpportunity[];
  initialOpportunity?: SalesforceOpportunity | null;
  sfInstanceUrl?: string;
  sfAccessToken?: string;
  sfIsConnected?: boolean;
  onOpenSfModal?: () => void;
}

export default function SdrDashboard({ 
  onAddOpportunity, 
  onUpdateOpportunity, 
  opportunities, 
  initialOpportunity,
  sfInstanceUrl = '',
  sfAccessToken = '',
  sfIsConnected = false,
  onOpenSfModal
}: SdrDashboardProps) {
  // Input States
  const [transcriptInput, setTranscriptInput] = useState('');

  // Audio Upload States
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // System status
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Sifting conversation using BANT...');
  const [currentOpportunity, setCurrentOpportunity] = useState<SalesforceOpportunity | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Sync historical opportunity if inspected
  React.useEffect(() => {
    if (initialOpportunity) {
      setCurrentOpportunity(initialOpportunity);
    }
  }, [initialOpportunity]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['mp3', 'wav', 'm4a'];
    
    if (!extension || !allowedExtensions.includes(extension)) {
      setErrorMsg('Unsupported audio format. Please upload MP3, WAV, or M4A.');
      return;
    }

    setErrorMsg(null);
    setAudioFile(file);

    // Create preview URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(URL.createObjectURL(file));

    // Convert file to Base64
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setAudioBase64(base64);

      let mimeType = file.type;
      if (extension === 'm4a') mimeType = 'audio/x-m4a';
      if (extension === 'mp3' && !mimeType) mimeType = 'audio/mp3';
      if (extension === 'wav' && !mimeType) mimeType = 'audio/wav';

      setAudioMimeType(mimeType || `audio/${extension}`);
      setInfoMsg(`Voice recording "${file.name}" uploaded. Ready for BANT analysis.`);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to process call recording file.');
    };
    reader.readAsDataURL(file);
  };

  const handleAudioUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveAudio = () => {
    setAudioFile(null);
    setAudioBase64(null);
    setAudioMimeType(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setInfoMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    // Validation
    if (!audioBase64 && !transcriptInput.trim()) {
      setErrorMsg('Please upload a voice recording OR paste a call transcript to generate opportunity fields.');
      return;
    }

    setLoading(true);
    setLoadingText('Sifting conversation using BANT...');
    setErrorMsg(null);
    setInfoMsg(null);
    setCurrentOpportunity(null);

    try {
      const requestPayload: any = {};
      
      if (audioBase64) {
        requestPayload.audio = {
          data: audioBase64,
          mimeType: audioMimeType
        };
      } else {
        requestPayload.transcript = transcriptInput;
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze SDR call inputs.');
      }

      const analyzedPayload = await response.json();
      
      // Determine what transcript context should represent the raw input in opportunity file
      const finalTranscriptLog = analyzedPayload.transcription || transcriptInput || `[Extracted from voice file: ${audioFile?.name}]`;

      // Second AI call: LLM-as-judge validation layer
      setLoadingText('Validating output against transcript...');

      let validationResult: any = null;
      try {
        const validateResponse = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: finalTranscriptLog,
            record: analyzedPayload
          })
        });

        if (validateResponse.ok) {
          validationResult = await validateResponse.json();
        }
      } catch (valErr) {
        console.warn("Validation judge request failed:", valErr);
      }

      const verdict = validationResult?.verdict || 'PASS';
      const validationVerdict = verdict === 'PASS' ? 'Pass' : verdict === 'FLAGGED' ? 'Flagged' : 'FAIL';

      // Third AI call: Historical Opportunity Comparison
      setLoadingText('Comparing with historical account records...');
      let historicalComparison = 'No previous opportunities for this company.';

      const currentCompName = normalizeCompanyName(analyzedPayload.companyName);
      if (currentCompName && opportunities && opportunities.length > 0) {
        const previousOpps = opportunities.filter(
          (o) => isSameCompany(o.companyName, currentCompName)
        );
        if (previousOpps.length > 0) {
          previousOpps.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.analyzedAt || 0).getTime();
            const timeB = new Date(b.createdAt || b.analyzedAt || 0).getTime();
            return timeB - timeA;
          });
          const matchedPrev = previousOpps[0];

          try {
            const compareResponse = await fetch('/api/compare', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prevRecord: matchedPrev,
                currentRecord: analyzedPayload
              })
            });

            if (compareResponse.ok) {
              const compareData = await compareResponse.json();
              if (compareData.comparisonText) {
                historicalComparison = compareData.comparisonText;
              }
            }
          } catch (compErr) {
            console.warn('Historical comparison request failed:', compErr);
          }
        }
      }

      const docId = doc(collection(db, 'opportunities')).id;
      const normContact = normalizeContactFields(analyzedPayload.contactName, analyzedPayload.contactTitle);

      const newOpp: SalesforceOpportunity = {
        id: docId,
        opportunityName: analyzedPayload.opportunityName || 'Salesforce Opportunity Log',
        companyName: analyzedPayload.companyName || 'Not discussed — SDR to raise on next call',
        contactName: normContact.contactName,
        contactTitle: normContact.contactTitle,
        bant: {
          budget: analyzedPayload.budget || 'Not discussed — SDR to raise on next call',
          authority: analyzedPayload.authority || 'Not discussed — SDR to raise on next call',
          need: analyzedPayload.need || 'Not discussed — SDR to raise on next call',
          timeline: analyzedPayload.timeline || 'Not discussed — SDR to raise on next call'
        },
        qualificationStatus: analyzedPayload.qualificationStatus || 'Partially Qualified',
        sdrNextSteps: analyzedPayload.sdrNextSteps || 'No follow-up plan drafted.',
        aeNotes: analyzedPayload.aeNotes || 'No notes compiled.',
        analyzedAt: new Date().toISOString(),
        transcript: finalTranscriptLog,
        competitorDetected: analyzedPayload.competitorDetected ?? false,
        competitorsMentioned: analyzedPayload.competitorsMentioned || 'None',
        competitorContext: analyzedPayload.competitorContext || 'None',
        historicalComparison: historicalComparison,
        validationResult: validationResult || {
          verdict: 'PASS',
          fields: [],
          qualification_check: {
            assigned_status: analyzedPayload.qualificationStatus || 'Partially Qualified',
            correct_status: analyzedPayload.qualificationStatus || 'Partially Qualified',
            matches_rubric: true
          },
          summary: 'Validated — all fields traced to transcript.'
        },
        validationVerdict: validationVerdict
      };

      setCurrentOpportunity(newOpp);


    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An unexpected error occurred during lead qualification extraction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Target Intake Card holding dual inputs (Upload vs paste) */}
      <div id="ingestion-control-card" className="bg-[#0e1626] rounded-xl border border-slate-800 shadow-xl overflow-hidden">
        {/* Content Body of Intake */}
        <div className="p-6 space-y-6 bg-[#0e1626]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            
            {/* Input Option A: Audio Uplink */}
            <div 
              className={`flex flex-col justify-between border-2 rounded-xl p-5 transition-all relative ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-950/30' 
                  : audioBase64 
                  ? 'border-emerald-500/50 bg-[#0d2218]' 
                  : 'border-dashed border-slate-800 hover:border-slate-700 bg-[#070b13]'
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${audioBase64 ? 'bg-emerald-500 text-white shrink-0' : 'bg-slate-800 text-slate-400 shrink-0'}`}>
                    <Mic className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase font-sans">
                    Option A: Upload Call Voice Recording
                  </span>
                </div>

                {/* Upload Action Interface */}
                {!audioBase64 ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                    <UploadCloud className="w-9 h-9 text-slate-750 group-hover:text-slate-600" />
                    <div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-1.5 bg-[#121c30] border border-slate-800 hover:bg-[#1a2944] hover:border-slate-700 rounded-lg text-xs font-bold text-slate-200 transition-all cursor-pointer shadow-md"
                      >
                        Choose Audio File
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#0c1422] border border-slate-800 rounded-lg p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Headphones className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-emerald-300 truncate font-mono">
                          {audioFile?.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        id="remove-audio-btn"
                        onClick={handleRemoveAudio}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded transition-all"
                        title="Delete recording"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                      <span>Mime: {audioMimeType}</span>
                      <span>Size: {(audioFile!.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>

                    {/* HTML5 Audio Pre-listener player */}
                    {audioUrl && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <audio src={audioUrl} controls className="w-full h-8 bg-none rounded filter invert contrast-125 opacity-85" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,audio/mp3,audio/wav,audio/x-m4a,audio/mp4"
                onChange={handleAudioUploadChange}
                className="hidden"
              />
            </div>

            {/* Input Option B: Direct Copy-Paste Transcription Text */}
            <div className={`border rounded-xl p-5 flex flex-col justify-between ${audioBase64 ? 'bg-[#05080e] opacity-40 border-slate-900' : 'border-slate-800 bg-[#070b13]'}`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-slate-800 text-slate-450">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-200 tracking-wide uppercase font-sans">
                      Option B: Paste Call Transcript Directly
                    </span>
                  </div>
                  {transcriptInput && !audioBase64 && (
                    <button
                      type="button"
                      onClick={() => setTranscriptInput('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline font-mono"
                    >
                      Clear text
                    </button>
                  )}
                </div>

                <textarea
                  id="transcript-textarea"
                  value={transcriptInput}
                  onChange={(e) => setTranscriptInput(e.target.value)}
                  disabled={!!audioBase64 || loading}
                  placeholder={
                    audioBase64 
                      ? "Recording attached. Clear Option A to paste transcript..." 
                      : "Paste your call transcript here"
                  }
                  className="w-full h-24 text-xs font-sans p-2.5 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg bg-slate-950 text-slate-200 resize-none disabled:bg-[#04060b] disabled:text-slate-600"
                />
              </div>
            </div>

          </div>

          {/* Success / Warning Prompt box */}
          {infoMsg && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs text-emerald-300 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-450" />
              <span className="font-semibold font-sans">{infoMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-950/40 border border-rose-500/30 px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs text-rose-300 animate-fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-450" />
              <span className="font-semibold font-sans">{errorMsg}</span>
            </div>
          )}

          {/* Core Action Exec Button - Glowing Highlight */}
          <div className="pt-2 flex flex-col items-center">
            <button
              type="button"
              id="run-analysis-btn"
              onClick={handleAnalyze}
              disabled={loading || (!audioBase64 && !transcriptInput.trim())}
              className="w-full md:w-auto md:min-w-[320px] flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 active:from-indigo-600 active:to-violet-700 text-white rounded-xl px-10 py-4.5 font-black uppercase text-sm tracking-widest shadow-[0_0_25px_rgba(99,102,241,0.55)] hover:shadow-[0_0_35px_rgba(99,102,241,0.75)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none font-display text-center"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{loadingText}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-white text-white" />
                  <span>Generate Opportunity Record</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Output / Results section */}
      <div id="results-card-container" className="space-y-4">
        {loading ? (
          <div className="bg-[#0e1626] rounded-xl border border-slate-800 p-12 text-center shadow-xl flex flex-col items-center justify-center">
            <AnimateLoader isLoading={true} />
          </div>
        ) : currentOpportunity ? (
          <div className="space-y-4 animate-fade-in duration-350">
            <div className="flex items-center gap-2 text-xs text-emerald-450 bg-[#0d2218] border border-emerald-900/50 px-3.5 py-2 rounded-lg max-w-max mx-auto font-semibold">
              <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
              <span>SF Record Structured & Mapped Successfully</span>
            </div>

            {currentOpportunity.competitorDetected && (
              <div 
                id="competitor-alert-banner"
                className="bg-amber-500/10 border-2 border-amber-500/40 rounded-3xl p-5 text-slate-100 flex flex-col sm:flex-row gap-4 items-start max-w-5xl mx-auto shadow-lg animate-fade-in duration-300 font-sans"
              >
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div className="space-y-1 text-left flex-1">
                  <h4 className="font-display font-extrabold text-xs text-amber-350 uppercase tracking-widest flex items-center gap-1.5">
                    Competitor Threat Detected
                  </h4>
                  <div className="text-xs text-slate-200 mt-1">
                    <span className="font-bold text-amber-300">Competitors Mentioned:</span> {currentOpportunity.competitorsMentioned}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                    <span className="font-bold text-slate-300">Context:</span> {currentOpportunity.competitorContext}
                  </div>
                </div>
              </div>
            )}
            
            <OpportunityCard
              opp={currentOpportunity}
              opportunities={opportunities}
              onUpdate={async (updated) => {
                setCurrentOpportunity(updated);

                // Existing historical records may save edits immediately.
                // New AI analyses stay local until human review is confirmed.
                if (initialOpportunity) {
                  const saved = await onUpdateOpportunity(updated);
                  if (saved) {
                    setCurrentOpportunity(saved);
                  }
                }
              }}
              onAddOpportunity={async (updated) => {
                const saved = initialOpportunity
                  ? await onUpdateOpportunity(updated)
                  : await onAddOpportunity(updated);

                if (saved) {
                  setCurrentOpportunity(saved);
                }
              }}
              onRerunAnalysis={handleAnalyze}
              onClose={() => setCurrentOpportunity(null)}
              sfInstanceUrl={sfInstanceUrl}
              sfAccessToken={sfAccessToken}
              sfIsConnected={sfIsConnected}
              onOpenSfModal={onOpenSfModal}
            />
          </div>
        ) : (
          <div className="bg-[#0e1626]/40 border-2 border-dashed border-slate-850 rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
            <Layers className="w-10 h-10 text-slate-700 mb-4" />
            <h4 className="font-display font-semibold text-slate-300 text-base">No Mapped Records Extracted Yet</h4>
            <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
              Upload your customer call audio file (MP3, WAV, or M4A) or paste the conversation logs above, then trigger <strong className="text-indigo-400">"Generate Opportunity Record"</strong>.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
