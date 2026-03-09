"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Edit, Save, Lock } from "lucide-react";

export default function RulesPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [rules, setRules] = useState([
    "Each team has a budget of 120 Cr.",
    "Minimum 18 players and maximum 25 players per squad.",
    "Maximum 8 overseas players allowed.",
    "Bidding starts at the player base price.",
    "Increment rules: Up to 2 Cr: 10L, 2-5 Cr: 20L, 5-10 Cr: 25L, Above 10 Cr: 50L.",
  ]);

  const handleSave = () => {
    setIsEditing(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">IPL Auction Rulebook</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsAdmin(!isAdmin)}
            >
              {isAdmin ? "Exit Admin Mode" : "Admin Login (Simulated)"}
            </Button>
          </div>
        </div>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 font-sans">
            <CardTitle className="text-xl font-semibold font-sans">Official Rules & Regulations</CardTitle>
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              >
                {isEditing ? <Save className="h-4 w-4 text-green-600" /> : <Edit className="h-4 w-4 text-slate-500" />}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                {rules.map((rule, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                      value={rule}
                      onChange={(e) => {
                        const newRules = [...rules];
                        newRules[index] = e.target.value;
                        setRules(newRules);
                      }}
                    />
                  </div>
                ))}
                <Button onClick={handleSave} className="w-full">Save Changes</Button>
              </div>
            ) : (
              <ul className="space-y-4 font-sans">
                {rules.map((rule, index) => (
                  <li key={index} className="flex items-start space-x-3 border-b border-slate-100 pb-3 last:border-0 font-sans font-medium">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600 font-sans">
                      {index + 1}
                    </span>
                    <p className="text-slate-700 leading-relaxed font-sans">{rule}</p>
                  </li>
                ))}
              </ul>
            )}
            {!isAdmin && (
              <p className="mt-8 flex items-center justify-center text-sm text-slate-400 font-sans">
                <Lock className="mr-2 h-3 w-3" />
                Only administrators can modify the rulebook.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
