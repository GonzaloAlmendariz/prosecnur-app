import React from "react";
import ReactDOM from "react-dom/client";
import BootGate from "./app/BootGate";
import "./app/boot.css";
import { instalarMovimientoReducido } from "./lib/movimientoReducido";

// Segoe UI (Windows) renderiza los pesos Medium más livianos que SF Pro;
// theme.css compensa --pulso-control-weight vía este atributo.
document.documentElement.dataset.platform = /^win/i.test(navigator.platform ?? "")
  ? "windows"
  : "mac";

// Con movimiento reducido, las transiciones que desplazan se terminan al arrancar (ver theme.css).
instalarMovimientoReducido();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BootGate loadSuite={() => import("./app/AppSuite")} />
  </React.StrictMode>
);
