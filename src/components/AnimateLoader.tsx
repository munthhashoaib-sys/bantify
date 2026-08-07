/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface AnimateLoaderProps {
  isLoading: boolean;
}

export default function AnimateLoader({ isLoading }: AnimateLoaderProps) {
  if (!isLoading) return null;

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
      <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
      <h3 className="font-display text-xl font-bold text-slate-100">
        Running BANT Engine
      </h3>
    </div>
  );
}
