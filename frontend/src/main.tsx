import React from "react";
import ReactDOM from "react-dom/client";
import BootGate from "./app/BootGate";
import "./app/boot.css";

// Segoe UI (Windows) renderiza los pesos Medium más livianos que SF Pro;
// theme.css compensa --pulso-control-weight vía este atributo.
document.documentElement.dataset.platform = /^win/i.test(navigator.platform ?? "")
  ? "windows"
  : "mac";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BootGate loadSuite={() => import("./app/AppSuite")} />
  </React.StrictMode>
);
