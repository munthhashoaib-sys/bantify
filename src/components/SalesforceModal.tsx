/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings, X, CheckCircle2, AlertTriangle, Loader2, ShieldCheck, Link2, LogOut, ChevronDown } from 'lucide-react';

interface SalesforceModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceUrl: string;
  setInstanceUrl: (url: string) => void;
  accessToken: string;
  setAccessToken: (token: string) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
}

export default function SalesforceModal({
  isOpen,
  onClose,
  instanceUrl,
  setInstanceUrl,
  accessToken,
  setAccessToken,
  isConnected,
  setIsConnected,
}: SalesforceModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [oauthUsername, setOauthUsername] = useState<string | null>(null);

  const isOAuthMode = accessToken === 'OAUTH';

  React.useEffect(() => {
    if (isOpen && isOAuthMode) {
      fetch('/api/oauth/status')
        .then((r) => r.json())
        .then((s) => setOauthUsername(s?.username || null))
        .catch(() => {});
    }
  }, [isOpen, isOAuthMode]);

  if (!isOpen) return null;

  const trimmedUrl = instanceUrl.trim();
  const hasLightningWarning = trimmedUrl.includes('lightning.force.com');

  const handleConnectOAuth = () => {
    // Full-page redirect: Salesforce login -> consent -> /api/oauth/callback -> back here
    window.location.href = '/api/oauth/login';
  };

  const handleDisconnectOAuth = async () => {
    try {
      await fetch('/api/oauth/disconnect', { method: 'POST' });
    } catch {}
    setAccessToken('');
    setInstanceUrl('');
    setIsConnected(false);
    setOauthUsername(null);
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let normalizedUrl = trimmedUrl.replace(/\/+$/, '');

    if (normalizedUrl.includes('lightning.force.com')) {
      return;
    }

    if (!normalizedUrl) {
      setErrorMessage('Please enter a valid Salesforce Instance URL.');
      return;
    }

    if (!accessToken.trim()) {
      setErrorMessage('Please enter an Access Token.');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = `${normalizedUrl}/services/data/v60.0/`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken.trim()}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        setIsConnected(true);
        setErrorMessage(null);
      } else {
        setIsConnected(false);
        const responseBody = await response.text();
        setErrorMessage(`HTTP ${response.status} ${response.statusText}${responseBody ? `: ${responseBody}` : ''}`);
      }
    } catch (err: any) {
      setIsConnected(false);
      setErrorMessage(err.message || 'Failed to connect. Please check the URL and CORS settings.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div
        className="bg-[#0e1626] border border-slate-800 text-[#eaeef6] rounded-2xl max-w-md w-full p-6 shadow-2xl relative flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-white">Salesforce connection</h2>
              <p className="text-xs text-slate-400">Sign in with Salesforce (OAuth) or use a manual token</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connected Badge */}
        {isConnected && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 rounded-xl flex items-center justify-between gap-2 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {isOAuthMode
                  ? `Connected via OAuth${oauthUsername ? ` as ${oauthUsername}` : ''}`
                  : 'Connected to Salesforce API'}
              </span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-900/90 text-emerald-200 text-[10px] font-mono rounded-md uppercase font-bold tracking-wider">
              Connected
            </span>
          </div>
        )}

        {/* OAuth: primary connection method */}
        <div className="space-y-3">
          {!isOAuthMode ? (
            <button
              type="button"
              onClick={handleConnectOAuth}
              className="w-full px-5 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Connect with Salesforce</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDisconnectOAuth}
              className="w-full px-5 py-2.5 text-xs font-bold text-slate-200 bg-slate-800/70 hover:bg-slate-800 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect Salesforce</span>
            </button>
          )}
          <p className="text-xs text-slate-400 leading-normal">
            OAuth uses the authorization code flow with PKCE. Tokens are held server side and never
            reach the browser; sessions refresh automatically.
          </p>
        </div>

        {/* Manual token: collapsible fallback */}
        {!isOAuthMode && (
          <div className="border-t border-slate-800/80 pt-4">
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showManual ? 'rotate-180' : ''}`} />
              <span>Advanced: manual access token</span>
            </button>

            {showManual && (
              <form onSubmit={handleTestConnection} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Instance URL
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={instanceUrl}
                      onChange={(e) => {
                        setInstanceUrl(e.target.value);
                        setIsConnected(false);
                      }}
                      placeholder="https://yourorg.develop.my.salesforce.com"
                      className="w-full bg-[#070b12] border border-slate-800 focus:border-indigo-500 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-600 font-mono"
                    />
                  </div>
                </div>

                {hasLightningWarning && (
                  <div className="p-3 bg-amber-950/80 border border-amber-600/60 text-amber-200 text-xs rounded-xl flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      This looks like the Salesforce UI address. Use your My Domain API URL, which ends in .my.salesforce.com
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Access token
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => {
                      setAccessToken(e.target.value);
                      setIsConnected(false);
                    }}
                    placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                    className="w-full bg-[#070b12] border border-slate-800 focus:border-indigo-500 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-600 font-mono"
                  />
                </div>

                <p className="text-xs text-slate-400 leading-normal">
                  Your token is held in memory for this session only and is never stored.
                </p>

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading || hasLightningWarning}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Test connection</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/90 border border-rose-600/80 text-rose-200 text-xs rounded-xl flex items-start gap-2.5 break-words font-mono">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-rose-100 mb-0.5">Connection Failed</span>
              <span className="text-[11px] leading-relaxed">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
