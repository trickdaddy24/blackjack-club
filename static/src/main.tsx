import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      theme="dark"
      toastOptions={{
        style: {
          background: "#171009",
          border: "1px solid rgba(201,162,39,.35)",
          color: "#f6eeda",
        },
      }}
    />
  </StrictMode>
);
