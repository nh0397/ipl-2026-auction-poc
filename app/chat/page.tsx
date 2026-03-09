"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Send, MessageSquare } from "lucide-react";

interface Message {
  id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      // Get current user profile
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", session.user.id)
        .single();

      setProfile(profileData);

      // Load existing messages
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);

      setMessages(msgs || []);
      setLoading(false);
    };

    init();

    // Subscribe to new messages in realtime
    const channel = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || sending) return;

    setSending(true);
    const text = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("chat_messages").insert({
      user_id: profile.id,
      user_name: profile.full_name || "Anonymous",
      message: text,
    });

    if (error) {
      console.error("Error sending message:", error);
      setNewMessage(text); // Restore message if failed
    }

    setSending(false);
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate a consistent color for each user
  const getUserColor = (userId: string) => {
    const colors = [
      "bg-blue-500", "bg-purple-500", "bg-emerald-500",
      "bg-orange-500", "bg-pink-500", "bg-indigo-500",
    ];
    const idx = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[idx % colors.length];
  };

  const isOwnMessage = (msg: Message) => msg.user_id === profile?.id;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-3 shadow-sm">
        <div className="h-10 w-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
          <MessageSquare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">Auction Room</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Real-time Chat</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-3">
            <MessageSquare className="h-16 w-16" />
            <p className="font-black uppercase tracking-tight text-lg">No messages yet</p>
            <p className="text-sm font-medium">Be the first to say something!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = isOwnMessage(msg);
            return (
              <div
                key={msg.id}
                className={`flex gap-3 items-end ${isOwn ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                {!isOwn && (
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 ${getUserColor(msg.user_id)}`}>
                    {getInitials(msg.user_name)}
                  </div>
                )}

                {/* Bubble */}
                <div className={`max-w-[72%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {!isOwn && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                      {msg.user_name}
                    </span>
                  )}
                  <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                    isOwn
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-white text-slate-800 border border-slate-100 rounded-bl-md"
                  }`}>
                    {msg.message}
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 px-1">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-100 px-4 py-4">
        <form onSubmit={sendMessage} className="flex gap-3 items-center max-w-4xl mx-auto">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Say something, ${profile?.full_name?.split(" ")[0] || "friend"}...`}
            className="flex-1 h-12 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="h-12 w-12 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
