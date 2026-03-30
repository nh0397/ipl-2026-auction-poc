"use client";

import React from "react";
import { Zap, Target, Shield, Users, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const RuleRow = ({ label, pts, sub, isNegative }: { label: string; pts: string | number; sub?: string; isNegative?: boolean }) => (
  <div className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0 group hover:bg-slate-50/50 transition-colors px-2 rounded-lg">
    <div className="space-y-0.5">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      {sub && <p className="text-[8px] font-black text-slate-300 uppercase leading-none">{sub}</p>}
    </div>
    <span className={cn("text-[12px] font-black italic", isNegative ? "text-rose-500" : "text-emerald-500")}>
      {typeof pts === 'number' && pts > 0 ? `+${pts}` : pts}
    </span>
  </div>
);

const SectionHeader = ({ title, icon: Icon, colorClass }: { title: string; icon: any; colorClass: string }) => (
  <div className="flex items-center justify-between border-b pb-4 mb-2">
    <h4 className="text-sm font-black uppercase tracking-tight text-slate-800 italic">{title}</h4>
    <Icon size={16} className={colorClass} />
  </div>
);

export const ScoringRulesLegend = () => {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-slate-100 divide-y md:divide-y-0">
        {/* BATTING */}
        <div className="p-8 space-y-6">
          <SectionHeader title="Batting" icon={Zap} colorClass="text-indigo-500" />
          <div className="space-y-1">
            <RuleRow label="Runs" pts={1} />
            <RuleRow label="Four Bonus" pts={4} />
            <RuleRow label="Six Bonus" pts={6} />
            <RuleRow label="25 Runs Bonus" pts={4} />
            <RuleRow label="50 Runs Bonus" pts={8} />
            <RuleRow label="75 Runs Bonus" pts={12} />
            <RuleRow label="100 Runs Bonus" pts={16} />
            <RuleRow label="Dismissal for Duck" pts={-2} sub="Excl. Bowlers" isNegative />
          </div>
          
          <div className="pt-6 border-t border-slate-100">
            <h5 className="text-[9px] font-black uppercase text-slate-400 mb-4 tracking-widest">Strike Rate</h5>
            <p className="text-[8px] font-bold text-slate-300 mb-3 uppercase tracking-tighter">Min 20 runs OR 10 balls played</p>
            <div className="space-y-1.5">
              {[{ r: "Below 50", p: -6 }, { r: "50 - 59.9", p: -4 }, { r: "60 - 69.9", p: -2 }, { r: "130 - 149.9", p: +2 }, { r: "150 - 169.9", p: +4 }, { r: "Above 170", p: +6 }].map((sr, i) => (
                <div key={i} className="flex justify-between items-center text-[10px] px-2">
                  <span className="text-slate-400 font-bold">{sr.r}</span>
                  <span className={cn("font-black italic", sr.p > 0 ? "text-emerald-500" : "text-rose-500")}>{sr.p > 0 ? `+${sr.p}` : sr.p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOWLING */}
        <div className="p-8 space-y-6 bg-slate-50/20">
          <SectionHeader title="Bowling" icon={Target} colorClass="text-emerald-500" />
          <div className="space-y-1">
            <RuleRow label="Wickets" pts={30} />
            <RuleRow label="LBW / Bowled Bonus" pts={8} />
            <RuleRow label="Maiden Over" pts={12} />
            <RuleRow label="Dot Ball" pts={1} />
            <RuleRow label="3 Wicket Haul" pts={4} />
            <RuleRow label="4 Wicket Haul" pts={8} />
            <RuleRow label="5 Wicket Haul" pts={12} />
          </div>

          <div className="pt-6 border-t border-slate-100">
            <h5 className="text-[9px] font-black uppercase text-slate-400 mb-4 tracking-widest">Economy Rate</h5>
            <p className="text-[8px] font-bold text-slate-300 mb-3 uppercase tracking-tighter">Minimum 2 overs bowled</p>
            <div className="space-y-1.5">
              {[{ r: "Below 5", p: +6 }, { r: "5 - 5.9", p: +4 }, { r: "6 - 6.9", p: +2 }, { r: "10 - 10.9", p: -2 }, { r: "11 - 11.9", p: -4 }, { r: "Above 12", p: -6 }].map((er, i) => (
                <div key={i} className="flex justify-between items-center text-[10px] px-2">
                  <span className="text-slate-400 font-bold">{er.r}</span>
                  <span className={cn("font-black italic", er.p > 0 ? "text-emerald-500" : er.p < 0 ? "text-rose-500" : "text-slate-300")}>
                    {er.p > 0 ? `+${er.p}` : er.p === 0 ? "0" : er.p}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FIELDING & OTHERS */}
        <div className="p-8 space-y-8">
          <div className="space-y-6">
            <SectionHeader title="Fielding" icon={Shield} colorClass="text-amber-500" />
            <div className="space-y-1">
              <RuleRow label="Catch" pts={8} />
              <RuleRow label="3 Catch Bonus" pts={4} />
              <RuleRow label="Stumping" pts={12} />
              <RuleRow label="Run Out (Direct)" pts={12} />
              <RuleRow label="Run Out (Indirect)" pts={6} />
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between border-b pb-4 mb-2">
              <h4 className="text-sm font-black uppercase tracking-tight text-slate-800 italic">Others</h4>
              <Users size={16} className="text-slate-400" />
            </div>
            <RuleRow label="Playing XI presence" pts={4} />
            
            <div className="mt-8 p-5 bg-slate-900 rounded-[1.5rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><Trophy size={40} className="text-white" /></div>
              <h6 className="text-[8px] font-black uppercase text-indigo-400 leading-none mb-1.5">Elite Performance Bonus</h6>
              <p className="text-[10px] font-black text-white uppercase italic tracking-tighter leading-tight">Additional multipliers applied for exceptional match hauls (100+ Runs / 5+ Wickets)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
