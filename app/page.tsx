import { mockPlayers } from "@/data/players";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ListFilter } from "lucide-react";
import { ChatBox } from "@/components/chat/ChatBox";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Top Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">IPL Auction 2026</h1>
            <p className="text-slate-500 font-medium">Live Dashboard & Player Insights</p>
          </div>
          <div className="flex items-center space-x-3">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Search players..." 
                  className="pl-10 h-11 ring-offset-background border-slate-200 focus-visible:ring-blue-600 rounded-lg"
                />
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content: Player List */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-bold flex items-center">
                  <ListFilter className="mr-2 h-5 w-5 text-blue-600" />
                  Available Player Pool
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/10">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700">PLAYER</TableHead>
                      <TableHead className="font-bold text-slate-700">CATEGORY</TableHead>
                      <TableHead className="font-bold text-slate-700">BASE PRICE</TableHead>
                      <TableHead className="font-bold text-slate-700">STATUS</TableHead>
                      <TableHead className="font-bold text-slate-700">TEAM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockPlayers.map((player) => (
                      <TableRow key={player.id} className="hover:bg-blue-50/30 transition-all border-b border-slate-100">
                        <TableCell className="font-bold text-slate-900 py-4">{player.name}</TableCell>
                        <TableCell className="text-slate-600">{player.category}</TableCell>
                        <TableCell className="font-medium text-slate-800">{player.basePrice}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={player.status === "Sold" ? "default" : "secondary"}
                            className={player.status === "Sold" ? "bg-green-100/80 text-green-700 border-none px-3 py-1 font-bold" : "bg-blue-100/80 text-blue-700 border-none px-3 py-1 font-bold"}
                          >
                            {player.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600 font-bold uppercase text-xs">
                          {player.soldTo || player.team}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Area: Chat Box */}
          <div className="lg:col-span-1 space-y-6">
            <ChatBox />
            
            <Card className="shadow-sm border-blue-100 bg-blue-50/30">
                <CardHeader>
                    <CardTitle className="text-sm font-bold text-blue-900">Auction Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-blue-700 font-medium">Players Sold</span>
                        <span className="text-xl font-black text-blue-900">84 / 120</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-blue-700 font-medium">Total Spend</span>
                        <span className="text-xl font-black text-blue-900">420.5 Cr</span>
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
