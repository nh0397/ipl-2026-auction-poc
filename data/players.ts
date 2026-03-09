export interface Player {
  id: string;
  name: string;
  team: string;
  category: "Batsman" | "Bowler" | "All-Rounder" | "Wicket-Keeper";
  basePrice: string;
  status: "Available" | "Sold" | "Unsold";
  soldTo?: string;
  soldPrice?: string;
  image?: string;
}

export const mockPlayers: Player[] = [
  {
    id: "1",
    name: "Virat Kohli",
    team: "RCB",
    category: "Batsman",
    basePrice: "2 Cr",
    status: "Sold",
    soldTo: "RCB",
    soldPrice: "21 Cr",
  },
  {
    id: "2",
    name: "Jasprit Bumrah",
    team: "MI",
    category: "Bowler",
    basePrice: "2 Cr",
    status: "Sold",
    soldTo: "MI",
    soldPrice: "18 Cr",
  },
  {
    id: "3",
    name: "Rishabh Pant",
    team: "LSG",
    category: "Wicket-Keeper",
    basePrice: "2 Cr",
    status: "Sold",
    soldTo: "LSG",
    soldPrice: "27 Cr",
  },
  {
    id: "4",
    name: "Shreyas Iyer",
    team: "PBKS",
    category: "Batsman",
    basePrice: "2 Cr",
    status: "Sold",
    soldTo: "PBKS",
    soldPrice: "26.75 Cr",
  },
  {
    id: "5",
    name: "Mitchell Starc",
    team: "DC",
    category: "Bowler",
    basePrice: "2 Cr",
    status: "Available",
  },
  {
    id: "6",
    name: "Jos Buttler",
    team: "GT",
    category: "Wicket-Keeper",
    basePrice: "2 Cr",
    status: "Sold",
    soldTo: "GT",
    soldPrice: "15.75 Cr",
  },
];
