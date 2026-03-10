"use client";

import { useState, useEffect } from "react";
import { Timer, Clock, Gavel } from "lucide-react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function AuctionTimer() {
  const targetDate = new Date("2026-03-14T04:30:00Z");
  
  const calculateTimeLeft = (): TimeLeft | null => {
    const difference = targetDate.getTime() - new Date().getTime();
    if (difference <= 0) return null;

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [localTimeInfo, setLocalTimeInfo] = useState<string>("");

  useEffect(() => {
    setIsMounted(true);
    setTimeLeft(calculateTimeLeft());
    
    // Get local timezone abbreviation or offset
    const timeString = targetDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    });
    setLocalTimeInfo(timeString);

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isMounted) return null;

  if (!timeLeft) {
    return (
      <div className="flex items-center gap-2 text-blue-600 font-black bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 italic text-sm">
        <Gavel size={14} className="animate-bounce" />
        THE HAMMER IS UP - AUCTION LIVE
      </div>
    );
  }

  const Unit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-black tabular-nums text-slate-900 tracking-tighter">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">{label}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-end">
         <div className="flex items-center gap-1.5 mb-0.5">
            <Clock size={10} className="text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Countdown to Lot 1</span>
         </div>
         <div className="flex items-center gap-4">
            <Unit value={timeLeft.days} label="d" />
            <div className="h-3 w-[1px] bg-slate-100" />
            <Unit value={timeLeft.hours} label="h" />
            <div className="h-3 w-[1px] bg-slate-100" />
            <Unit value={timeLeft.minutes} label="m" />
            <div className="h-3 w-[1px] bg-slate-100" />
            <Unit value={timeLeft.seconds} label="s" />
         </div>
      </div>
      
      <div className="h-10 w-[1px] bg-slate-100 mx-2" />
      
      <div className="flex flex-col items-start bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 border-dashed">
         <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Lot Deployment Status</span>
         <span className="text-[11px] font-black text-slate-900 italic uppercase">
           Sat 10:00 AM IST <span className="text-slate-400 normal-case ml-1">({localTimeInfo})</span>
         </span>
      </div>
    </div>
  );
}
