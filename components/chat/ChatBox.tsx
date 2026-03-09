"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send } from "lucide-react";

export function ChatBox() {
  const [messages, setMessages] = useState([
    { id: "1", user: "Admin", text: "Welcome to the IPL 2026 Auction!" },
    { id: "2", user: "RCB", text: "Ready to break the bank!" },
  ]);
  const [newMessage, setNewMessage] = useState("");

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    setMessages([...messages, { id: Date.now().toString(), user: "You", text: newMessage }]);
    setNewMessage("");
  };

  return (
    <Card className="flex flex-col h-[600px] shadow-lg border-slate-200">
      <CardHeader className="border-b bg-slate-50/50 py-4">
        <CardTitle className="flex items-center text-lg font-bold text-slate-900">
          <MessageSquare className="mr-2 h-5 w-5 text-blue-600" />
          Auction Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1">{msg.user}</span>
                <div className="inline-block rounded-lg bg-blue-50 px-3 py-2 text-sm text-slate-800 break-words max-w-[90%] font-medium">
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t bg-slate-50/50">
          <div className="flex space-x-2">
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="bg-white border-slate-200 focus-visible:ring-blue-500"
            />
            <Button size="icon" onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
