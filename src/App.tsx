/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import SdrDashboard from './components/SdrDashboard';
import LeadHistory from './components/LeadHistory';
import QualificationRubric from './components/QualificationRubric';
import SalesforceModal from './components/SalesforceModal';
import { SalesforceOpportunity, normalizeContactFields } from './types';
import { db, auth, signInWithGoogle, signOutUser } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  Briefcase, History, FilePenLine, BarChart3, Database, Shield, BookOpen, ExternalLink,
  AlertCircle, CheckCircle2, X, RefreshCw, Settings, Award
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'analyzer' | 'history' | 'rubric'>('analyzer');
  const [opportunities, setOpportunities] = useState<SalesforceOpportunity[]>([]);
  const [selectedHistoricalOpp, setSelectedHistoricalOpp] = useState<SalesforceOpportunity | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [loadingTracker, setLoadingTracker] = useState(true);
const [user, setUser] = useState<User | null>(null);
const [authLoading, setAuthLoading] = useState(true);

  // Watch Firebase authentication state
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser);
    setAuthLoading(false);
  });

  return () => unsubscribe();
}, []);

// Salesforce connection session state (held in memory only)
  const [sfInstanceUrl, setSfInstanceUrl] = useState('');
  const [sfAccessToken, setSfAccessToken] = useState('');
  const [sfIsConnected, setSfIsConnected] = useState(false);
  const [isSfModalOpen, setIsSfModalOpen] = useState(false);

  // Read from Firestore "opportunities" collection on load, ordered by created timestamp descending
  useEffect(() => {
    setLoadingTracker(true);
    const q = query(collection(db, 'opportunities'));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: SalesforceOpportunity[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const normContact = normalizeContactFields(data.contactName, data.contactTitle);
          return {
            id: docSnap.id,
            opportunityName: data.opportunityName || '',
            companyName: data.companyName || '',
            companySource: data.companySource || 'extracted',
            contactName: normContact.contactName,
            contactTitle: normContact.contactTitle,
            bant: {
              budget: data.bant?.budget || '',
              authority: data.bant?.authority || '',
              need: data.bant?.need || '',
              timeline: data.bant?.timeline || ''
            },
            qualificationStatus: data.qualificationStatus || 'Partially Qualified',
            sdrNextSteps: data.sdrNextSteps || '',
            aeNotes: data.aeNotes || '',
            analyzedAt: data.analyzedAt || new Date().toISOString(),
            createdAt: data.createdAt || data.analyzedAt || new Date().toISOString(),
            transcript: data.transcript || '',
            competitorDetected: data.competitorDetected ?? false,
            competitorsMentioned: data.competitorsMentioned || 'None',
            competitorContext: data.competitorContext || 'None',
            historicalComparison: data.historicalComparison || '',
            validationVerdict: data.validationVerdict || 'Pass',
            validationResult: data.validationResult || null,
            isCorrected: data.isCorrected ?? false,
            salesforceId: data.salesforceId || undefined,
            salesforceUrl: data.salesforceUrl || undefined,
            salesforceLoggedAt: data.salesforceLoggedAt || undefined,
            saveStatus: 'saved'
          } as SalesforceOpportunity;
        });

        // Order by created timestamp descending
        docs.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.analyzedAt || 0).getTime();
          const timeB = new Date(b.createdAt || b.analyzedAt || 0).getTime();
          return timeB - timeA;
        });

        setOpportunities(docs);
        setFirestoreError(null);
        setLoadingTracker(false);
      },
      (err: any) => {
        console.error('Firestore snapshot subscription error:', err);
        // Error visibility: show red toast with exact error message returned by Firestore
        setFirestoreError(`Firestore Read Error: ${err.message || String(err)}`);
        setLoadingTracker(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Save or update an opportunity in Firestore "opportunities" collection
  const handleSaveOpportunityToFirestore = async (opp: SalesforceOpportunity): Promise<SalesforceOpportunity> => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('You must be signed in to save an opportunity.');
    }

    // Maintain exact document ID for the lifetime of the analysis
    const docId = opp.id ? opp.id : doc(collection(db, 'opportunities')).id;
    const createdAt = opp.createdAt || opp.analyzedAt || new Date().toISOString();
    const normContact = normalizeContactFields(opp.contactName, opp.contactTitle);

    const recordToSave = {
      opportunityName: opp.opportunityName || 'Salesforce Opportunity Log',
      companyName: opp.companyName || '',
      companySource: opp.companySource || 'extracted',
      contactName: normContact.contactName,
      contactTitle: normContact.contactTitle,
      bant: {
        budget: opp.bant?.budget || '',
        authority: opp.bant?.authority || '',
        need: opp.bant?.need || '',
        timeline: opp.bant?.timeline || ''
      },
      qualificationStatus: opp.qualificationStatus || 'Partially Qualified',
      sdrNextSteps: opp.sdrNextSteps || '',
      aeNotes: opp.aeNotes || '',
      competitorDetected: opp.competitorDetected ?? false,
      competitorsMentioned: opp.competitorsMentioned || 'None',
      competitorContext: opp.competitorContext || 'None',
      historicalComparison: opp.historicalComparison || '',
      validationVerdict: opp.validationVerdict || 'Pass',
      validationResult: opp.validationResult || null,
      transcript: opp.transcript || '',
      analyzedAt: opp.analyzedAt || new Date().toISOString(),
      createdAt: createdAt,
      isCorrected: opp.isCorrected ?? false,
      salesforceId: opp.salesforceId || null,
      salesforceUrl: opp.salesforceUrl || null,
      salesforceLoggedAt: opp.salesforceLoggedAt || null,
      workspaceId: 'bantify-demo',
      lastUpdatedByUid: currentUser.uid,
      lastUpdatedByEmail: currentUser.email || '',
      ...(!opp.id ? {
        createdByUid: currentUser.uid,
        createdByEmail: currentUser.email || ''
      } : {})
    };

    try {
      await setDoc(doc(db, 'opportunities', docId), recordToSave);

      const savedOpp: SalesforceOpportunity = {
        ...opp,
        id: docId,
        createdAt,
        saveStatus: 'saved',
        saveError: undefined
      };

      setToastSuccess(`Saved record "${opp.opportunityName}" to Firestore (ID: ${docId})`);
      setTimeout(() => setToastSuccess(null), 4000);
      setFirestoreError(null);

      setOpportunities((prev) => {
        const exists = prev.some((o) => o.id === docId);
        if (exists) {
          return prev.map((o) => (o.id === docId ? savedOpp : o));
        } else {
          return [savedOpp, ...prev];
        }
      });

      return savedOpp;
    } catch (err: any) {
      console.error('Firestore write error:', err);
      const exactErrorMsg = err.message || String(err);

      // Error visibility: show red toast with exact error message returned by Firestore
      setFirestoreError(`Firestore Write Error: ${exactErrorMsg}`);

      const failedOpp: SalesforceOpportunity = {
        ...opp,
        id: docId,
        createdAt,
        saveStatus: 'not_saved',
        saveError: exactErrorMsg
      };

      // Keep failed write visible in UI with 'Not saved' badge and retry button
      setOpportunities((prev) => {
        const exists = prev.some((o) => o.id === docId);
        if (exists) {
          return prev.map((o) => (o.id === docId ? failedOpp : o));
        } else {
          return [failedOpp, ...prev];
        }
      });

      return failedOpp;
    }
  };

  const handleAddOpportunity = async (opp: SalesforceOpportunity): Promise<SalesforceOpportunity> => {
    return await handleSaveOpportunityToFirestore(opp);
  };

  const handleUpdateOpportunity = async (updatedOpp: SalesforceOpportunity): Promise<SalesforceOpportunity> => {
    return await handleSaveOpportunityToFirestore(updatedOpp);
  };

  const handleDeleteOpportunity = async (id: string) => {
    if (confirm('Are you sure you want to delete this qualification log from Firestore?')) {
      try {
        await deleteDoc(doc(db, 'opportunities', id));
        setToastSuccess(`Deleted record ${id} from Firestore.`);
        setTimeout(() => setToastSuccess(null), 3000);
        setOpportunities((prev) => prev.filter((o) => o.id !== id));
      } catch (err: any) {
        console.error('Firestore delete error:', err);
        setFirestoreError(`Firestore Delete Error: ${err.message || String(err)}`);
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete all historical logs from Firestore?')) {
      try {
        await Promise.all(opportunities.map((o) => deleteDoc(doc(db, 'opportunities', o.id))));
        setOpportunities([]);
        setToastSuccess('All records cleared from Firestore.');
        setTimeout(() => setToastSuccess(null), 3000);
      } catch (err: any) {
        console.error('Firestore clear error:', err);
        setFirestoreError(`Firestore Clear Error: ${err.message || String(err)}`);
      }
    }
  };

  const handleSelectHistorical = (opp: SalesforceOpportunity) => {
    setSelectedHistoricalOpp(opp);
    setActiveTab('analyzer');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-[#eaeef6] flex flex-col font-sans select-none antialiased">
      
      {/* Main SaaS bar - Dark Mode Header */}
      <header className="bg-[#0e1626] border-b border-slate-800 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          
          {/* Logo & Headline */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl text-white shadow-sm">
              <Briefcase className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <h1 className="font-display font-black text-xl tracking-tight text-white">
                BANTify
              </h1>
            </div>
          </div>

          {/* Tab Navigation Switches & Salesforce Connection Settings */}
          <div className="flex items-center gap-3">
            <div className="flex flex-wrap sm:flex-nowrap gap-1 bg-[#070b12] p-1.5 rounded-xl border border-slate-850">
              <button
                id="tab-analyzer"
                onClick={() => {
                  setActiveTab('analyzer');
                  setSelectedHistoricalOpp(null);
                }}
                className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-lg text-xs font-bold font-display tracking-wide transition-all uppercase ${
                  activeTab === 'analyzer'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-150'
                }`}
              >
                <FilePenLine className="w-3.5 h-3.5" />
                <span>Workspace</span>
              </button>
              
              <button
                id="tab-history"
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-lg text-xs font-bold font-display tracking-wide transition-all uppercase relative ${
                  activeTab === 'history'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-150'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Opportunity Record Tracker</span>
                {opportunities.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-indigo-500 text-white font-mono text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {opportunities.length}
                  </span>
                )}
              </button>

              {user ? (
                <div
                  className="flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-lg text-xs font-bold font-display tracking-wide uppercase text-emerald-400 whitespace-nowrap"
                  title={user.email || 'Authenticated user'}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Signed In
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-lg text-xs font-bold font-display tracking-wide transition-all uppercase text-slate-400 hover:text-white whitespace-nowrap"
                >
                  Sign In
                </button>
              )}

              <button
                id="tab-rubric"
                onClick={() => setActiveTab('rubric')}
                className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-lg text-xs font-bold font-display tracking-wide transition-all uppercase ${
                  activeTab === 'rubric'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-150'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Qualification Rubric</span>
              </button>
            </div>

            {/* Salesforce Settings Gear Button */}
            <button
              id="sf-connection-btn"
              type="button"
              onClick={() => setIsSfModalOpen(true)}
              className="p-2.5 bg-[#070b12] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-850 rounded-xl transition-all relative cursor-pointer flex items-center justify-center shadow-sm"
              title="Salesforce connection"
            >
              <Settings className="w-4 h-4" />
              {sfIsConnected && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0e1626]" />
              )}
            </button>
          </div>

        </div>
      </header>

      {/* Main body canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">

        {/* Global Firestore Error Banner */}
        {firestoreError && (
          <div id="firestore-error-banner" className="bg-rose-950/90 border border-rose-600/80 text-rose-200 px-6 py-3.5 rounded-xl shadow-xl flex items-center justify-between gap-4 mb-6 animate-fade-in font-sans">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="text-xs">
                <strong className="font-bold text-rose-100 block">Firestore Error</strong>
                <span>{firestoreError}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFirestoreError(null)}
              className="p-1 hover:bg-rose-900/60 rounded text-rose-300 hover:text-white cursor-pointer shrink-0"
              title="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Firestore Success Toast */}
        {toastSuccess && (
          <div id="firestore-success-toast" className="bg-emerald-950/90 border border-emerald-600/80 text-emerald-200 px-6 py-3.5 rounded-xl shadow-xl flex items-center justify-between gap-4 mb-6 animate-fade-in font-sans">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold">{toastSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastSuccess(null)}
              className="p-1 hover:bg-emerald-900/60 rounded text-emerald-300 hover:text-white cursor-pointer shrink-0"
              title="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {activeTab === 'analyzer' ? (
          <div className="space-y-8 animate-fade-in duration-300">
            {selectedHistoricalOpp ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    id="back-to-dashboard-btn"
                    onClick={() => setSelectedHistoricalOpp(null)}
                    className="flex items-center gap-1 text-xs font-semibold text-salesforce-blue hover:underline"
                  >
                    <span>← Create New Analysis</span>
                  </button>
                  <span className="text-xs text-slate-400 font-mono">Viewing Historical Log Id: {selectedHistoricalOpp.id}</span>
                </div>
                <SdrDashboard
                  onAddOpportunity={handleAddOpportunity}
                  onUpdateOpportunity={handleUpdateOpportunity}
                  opportunities={opportunities}
                  initialOpportunity={selectedHistoricalOpp}
                  sfInstanceUrl={sfInstanceUrl}
                  sfAccessToken={sfAccessToken}
                  sfIsConnected={sfIsConnected}
                  onOpenSfModal={() => setIsSfModalOpen(true)}
                />
                
                {/* Seed initial record directly for quick load preview */}
                <div className="mt-4">
                  <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl text-center text-xs text-emerald-800 font-semibold">
                    Loaded previous historical entry. You can review of edit below. This record is marked under ID: {selectedHistoricalOpp.id}
                  </div>
                </div>
              </div>
            ) : (
              <SdrDashboard
                onAddOpportunity={handleAddOpportunity}
                onUpdateOpportunity={handleUpdateOpportunity}
                opportunities={opportunities}
                initialOpportunity={null}
                sfInstanceUrl={sfInstanceUrl}
                sfAccessToken={sfAccessToken}
                sfIsConnected={sfIsConnected}
                onOpenSfModal={() => setIsSfModalOpen(true)}
              />
            )}
          </div>
        ) : activeTab === 'history' ? (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="font-display font-extrabold text-slate-100 text-lg">Historical Log Registry</h2>
              <p className="text-xs text-slate-500 max-w-2xl">
                Search, analyze, and manage previously saved Salesforce Opportunity profiles ready to sync into your CRM organization database.
              </p>
            </div>
            <LeadHistory
              opportunities={opportunities}
              onSelect={handleSelectHistorical}
              onDelete={handleDeleteOpportunity}
              onClearAll={handleClearAll}
              onRetrySave={handleSaveOpportunityToFirestore}
            />
          </div>
        ) : (
          <QualificationRubric />
        )}

      </main>

      {/* Salesforce Connection Modal */}
      <SalesforceModal
        isOpen={isSfModalOpen}
        onClose={() => setIsSfModalOpen(false)}
        instanceUrl={sfInstanceUrl}
        setInstanceUrl={setSfInstanceUrl}
        accessToken={sfAccessToken}
        setAccessToken={setSfAccessToken}
        isConnected={sfIsConnected}
        setIsConnected={setSfIsConnected}
      />

    </div>
  );
}
