"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MessageSquare, X, Send, ChevronDown } from "lucide-react";

interface Message {
  id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [profile, setProfile] = useState<{ id: string; full_name: string | null } | null>(null);
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", session.user.id)
        .single();
      setProfile(profileData);

      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(50);
      setMessages(msgs || []);
    };

    init();

    const channel = supabase
      .channel("floating-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => [...prev, msg]);
          setUnread((prev) => (open ? 0 : prev + 1));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Clear unread when opened
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || sending) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage("");
    await supabase.from("chat_messages").insert({
      user_id: profile.id,
      user_name: profile.full_name || "Anonymous",
      message: text,
    });
    setSending(false);
  };

  const getUserColor = (userId: string) => {
    const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f97316", "#ec4899", "#6366f1"];
    const idx = userId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[idx % colors.length];
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Don't render at all if not logged in
  if (!profile) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
      {/* Chat Window */}
      {open && (
        <div className="w-[360px] bg-white rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.18)] border border-slate-100 flex flex-col overflow-hidden"
          style={{ height: "480px" }}
        >
          {/* Header */}
          <div className="bg-blue-600 px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white font-black uppercase tracking-widest text-xs">Auction Room</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-blue-200 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-2 py-8">
                <MessageSquare className="h-10 w-10" />
                <p className="text-xs font-bold uppercase tracking-wider">No messages yet</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.user_id === profile.id;
                return (
                  <div key={msg.id} className={`flex gap-2 items-end ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                    {!isOwn && (
                      <div
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0"
                        style={{ backgroundColor: getUserColor(msg.user_id) }}
                      >
                        {getInitials(msg.user_name)}
                      </div>
                    )}
                    <div className={`max-w-[78%] flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
                      {!isOwn && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 px-1">
                          {msg.user_name}
                        </span>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-xs font-medium leading-relaxed ${
                        isOwn
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white text-slate-800 border border-slate-100 shadow-sm rounded-bl-sm"
                      }`}>
                        {msg.message}
                      </div>
                      <span className="text-[9px] text-slate-300 font-bold px-1">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="px-3 py-3 bg-white border-t border-slate-100 flex gap-2 items-center shrink-0">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="h-9 w-9 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-14 w-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center shadow-[0_8px_32px_rgba(37,99,235,0.4)] hover:shadow-[0_8px_40px_rgba(37,99,235,0.55)] transition-all active:scale-95 cursor-pointer"
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
