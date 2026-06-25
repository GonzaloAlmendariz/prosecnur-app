import React from "react";
import ReactDOM from "react-dom/client";
import BootGate from "./app/BootGate";
import "./app/boot.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BootGate loadSuite={() => import("./app/AppSuite")} />
  </React.StrictMode>
);
