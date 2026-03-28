"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { RulesEditor } from "@/components/rules/RulesEditor";
import { RulesView } from "@/components/rules/RulesView";
import { Button } from "@/components/ui/button";
import { Edit2, Eye, ShieldAlert as ShieldIcon } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function RulesPage() {
  const { profile: authProfile } = useAuth();
  const [content, setContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync role from auth context
  useEffect(() => {
    if (authProfile) setRole(authProfile.role || "Participant");
  }, [authProfile]);

  useEffect(() => {
    fetchRules();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('rules-sync')
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'auction_settings', 
          filter: 'id=eq.current_rules' 
        },
        (payload) => {
          console.log("Realtime Update Received:", payload);
          if (payload.new && (payload.new as any).content !== undefined) {
             setContent((payload.new as any).content || "");
          }
        }
      )
      .subscribe((status) => {
        console.log("Realtime Subscription Status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRules = async () => {
    const { data, error } = await supabase
      .from("auction_settings")
      .select("content")
      .eq("id", "current_rules")
      .maybeSingle();
    
    if (error) {
        console.error("Error fetching rules:", error);
    }

    if (data) {
        setContent(data.content || "");
    }
    setLoading(false);
  };

  const handleSave = async (newContent: string) => {
    setIsSaving(true);
    const { error } = await supabase
      .from("auction_settings")
      .update({ 
        content: newContent, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", "current_rules");

    if (!error) {
      setContent(newContent);
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = role === "Admin";

  return (
    <div className="min-h-screen bg-[#fafafa] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Admin Pencil Toggle */}
        {isAdmin && (
          <div className="flex justify-end mb-10">
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant={isEditing ? "outline" : "default"}
              className={`rounded-2xl shadow-xl font-black uppercase tracking-widest text-[10px] h-12 px-8 group transition-all ${isEditing ? 'bg-white border-stone-200 text-stone-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              {isEditing ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  View Mode
                </>
              ) : (
                <>
                  <Edit2 className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                  Edit Rulebook
                </>
              )}
            </Button>
          </div>
        )}

        {isEditing && isAdmin ? (
          <RulesEditor 
            initialContent={content} 
            onSave={handleSave} 
            isSaving={isSaving} 
          />
        ) : (
          <RulesView content={content} />
        )}

        {!isAdmin && (
          <div className="max-w-4xl mx-auto mt-12 pointer-events-none">
             <div className="flex flex-col items-center gap-2 justify-center text-slate-300 opacity-50">
                <ShieldIcon className="h-4 w-4" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em]">Official Sealed View • Read Only</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShieldAlert(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
        </svg>
    )
}
