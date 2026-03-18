import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPlayerImage(url: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;

  // Prefix relative Cricinfo paths
  const baseUrl = "https://img1.hscicdn.com/image/upload/f_auto,t_h_100"; // Responsive height 100
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${baseUrl}${cleanPath}`;
}

export const iplColors: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  CSK: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
  },
  MI: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800" },
  RCB: { bg: "bg-red-100", border: "border-red-300", text: "text-red-950" },
  KKR: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-800",
  },
  DC: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800" },
  GT: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
  },
  LSG: { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-800" },
  PBKS: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  RR: { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-800" },
  SRH: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-800",
  },
};
