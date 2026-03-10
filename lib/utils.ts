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
