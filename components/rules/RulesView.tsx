"use client";

import { Trophy, CheckCircle2, ShieldAlert } from "lucide-react";

interface RulesViewProps {
  content: string;
}

export function RulesView({ content }: RulesViewProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="text-center relative py-12">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-24 w-24 bg-blue-100/50 rounded-full blur-3xl -z-10" />
        <div className="h-20 w-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200 rotate-6 hover:rotate-0 transition-transform cursor-default">
          <Trophy className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-6xl font-black uppercase tracking-tighter text-slate-900 mb-2 leading-none">
            The Rulebook<span className="text-blue-600">.</span>
        </h1>
        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">IPL 2026 AUCTION POC • AUTHORITY VERIFIED</p>
      </div>

      <div className="bg-white p-8 md:p-16 rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)] border border-slate-50 min-h-[400px]">
        {content ? (
          <div 
            className={`prose prose-slate max-w-none 
                prose-headings:text-slate-900 prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-headings:leading-tight
                prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl
                prose-p:text-slate-600 prose-p:text-lg prose-p:leading-relaxed
                prose-strong:text-slate-900 prose-strong:font-black
                prose-li:text-slate-600 prose-li:text-lg font-sans
                prose-blockquote:border-l-blue-600 prose-blockquote:bg-blue-50 prose-blockquote:py-2 prose-blockquote:rounded-r-xl
                prose-img:rounded-3xl prose-img:shadow-2xl`}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center space-y-4">
            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center">
                <ShieldAlert className="h-8 w-8 text-slate-200" />
            </div>
            <div>
                <p className="text-xl font-bold uppercase tracking-tight text-slate-400">No rules have been created yet.</p>
                <p className="text-sm font-medium text-slate-300">The Admin can create them now using the edit button above.</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-1 w-12 bg-blue-600/30 rounded-full" />
        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-300">Section Closed</span>
      </div>
    </div>
  );
}
