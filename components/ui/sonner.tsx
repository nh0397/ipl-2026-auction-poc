"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={7000}
      toastOptions={{
        classNames: {
          toast: "border border-border shadow-lg",
        },
      }}
    />
  );
}
