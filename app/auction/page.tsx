"use client";

import { useState, useEffect } from "react";
import { mockPlayers, Player } from "@/data/players";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Gavel, Timer, TrendingUp, Users } from "lucide-react";

export default function AuctionPage() {
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    // Find first available player
    const available = mockPlayers.find(p => p.status === "Available");
    if (available) {
      setActivePlayer(available);
      setCurrentBid(parseInt(available.basePrice));
    }
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && activePlayer) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, activePlayer]);

  const handleBid = (increment: number) => {
    setCurrentBid(prev => prev + increment);
    setHighestBidder("You"); 
    setTimeLeft(30); 
  };

  if (!activePlayer) return <div className="p-8 text-center text-slate-500 font-sans">All players auctioned!</div>;

  return (
    <main className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between bg-blue-600 text-white p-6 rounded-2xl shadow-xl overflow-hidden relative">
          <div className="relative z-10">
            <h1 className="text-4xl font-black tracking-tight uppercase">Live Bidding Arena</h1>
            <p className="opacity-80 font-medium font-sans">IPL Auction 2026 Season</p>
          </div>
          <div className="flex items-center space-x-6 z-10">
             <div className="flex flex-col items-center">
                <Timer className="h-6 w-6 mb-1 animate-pulse" />
                <span className="text-2xl font-black tracking-widest">{timeLeft}s</span>
             </div>
             <Trophy className="h-16 w-16 opacity-20 absolute -right-4 -top-4 rotate-12" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Player Profil Card */}
          <Card className="shadow-2xl border-none overflow-hidden group">
            <div className="aspect-[4/5] bg-slate-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                <div className="absolute bottom-6 left-6 text-white space-y-2">
                    <Badge className="bg-blue-600 text-white border-none px-3 font-bold">{activePlayer.category}</Badge>
                    <h2 className="text-5xl font-black uppercase tracking-tighter">{activePlayer.name}</h2>
                    <p className="text-xl font-bold opacity-90">{activePlayer.team}</p>
                </div>
            </div>
            <CardContent className="p-6 bg-white">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Base Price</span>
                        <span className="text-2xl font-black text-slate-900">{activePlayer.basePrice}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Stats Rating</span>
                        <span className="text-2xl font-black text-slate-900">8.9/10</span>
                    </div>
                </div>
            </CardContent>
          </Card>

          {/* Bidding Control Card */}
          <Card className="shadow-2xl border-none flex flex-col bg-white">
            <CardHeader className="bg-slate-900 text-white rounded-t-2xl p-8">
               <CardTitle className="text-sm font-bold opacity-60 uppercase tracking-widest flex items-center">
                 <TrendingUp className="mr-2 h-4 w-4" />
                 Current High Bid
               </CardTitle>
               <div className="text-7xl font-black tracking-tighter mt-2">
                  {currentBid} <span className="text-2xl font-bold opacity-60">Cr</span>
               </div>
               {highestBidder && (
                 <Badge className="mt-4 bg-green-500 hover:bg-green-600 text-white border-none py-1.5 px-4 font-bold">
                    <Users className="mr-2 h-3 w-3" />
                    Highest Bidder: {highestBidder}
                 </Badge>
               )}
            </CardHeader>
            <CardContent className="flex-1 p-8 flex flex-col justify-center space-y-8">
                <div className="space-y-4 text-center">
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Quick Bid Increments</p>
                    <div className="grid grid-cols-2 gap-4">
                        <Button 
                          onClick={() => handleBid(0.5)}
                          className="h-20 text-xl font-black rounded-2xl border-2 border-slate-100 bg-white text-slate-900 hover:bg-slate-50 hover:border-blue-500 shadow-none transition-all"
                        >
                          +0.5 Cr
                        </Button>
                        <Button 
                          onClick={() => handleBid(1)}
                          className="h-20 text-xl font-black rounded-2xl border-2 border-slate-100 bg-white text-slate-900 hover:bg-slate-50 hover:border-blue-500 shadow-none transition-all"
                        >
                          +1.0 Cr
                        </Button>
                        <Button 
                          onClick={() => handleBid(2)}
                          className="col-span-2 h-24 text-2xl font-black rounded-2xl bg-slate-900 text-white hover:bg-blue-600 shadow-lg transition-all"
                        >
                          <Gavel className="mr-3 h-6 w-6" />
                          BID +2.0 Cr
                        </Button>
                    </div>
                </div>
                <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                    <h4 className="text-amber-900 font-black text-xs uppercase mb-2">Bidding Rules</h4>
                    <p className="text-amber-800 text-xs font-medium leading-relaxed">
                        Clicking the button will instantly place a bid. This action is irreversible. 
                        Ensure you have enough budget before bidding.
                    </p>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
