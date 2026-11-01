// Ventana de campo del estudio: el Planner la PROPONE (decisión de Gonzalo vía
// Meta B, 2026-10-31). Se siembra de Monitoreo o del cronograma; declararla no
// escribe en ninguno: Monitoreo muestra la discrepancia y ofrece alinearse.

import { useEffect, useState } from "react";

import type { PlannerVentana } from "../../../api/planner";
import { textoOrigen } from "./plannerCopia";
import type { ControlPlanner } from "./usePlanner";

const FUENTE = { monitoreo: "Monitoreo", cronograma: "el cronograma" } as const;

export function PlannerVentanaCampo({ ventana, control }: { ventana: PlannerVentana; control: ControlPlanner }) {
  const [inicio, setInicio] = useState(ventana.inicio);
  const [fin, setFin] = useState(ventana.fin);
  useEffect(() => { setInicio(ventana.inicio); setFin(ventana.fin); }, [ventana.inicio, ventana.fin]);

  const guardando = control.guardando === "ventana";
  const cambio = inicio !== ventana.inicio || fin !== ventana.fin;
  const invertida = Boolean(inicio && fin && fin < inicio);
  const listo = Boolean(inicio && fin) && !invertida;
  // Sembrada y sin tocar también se puede proponer tal cual: así queda declarada.
  const proponible = listo && (cambio || ventana.origen === "proyectado") && !guardando && Boolean(control.estado);
  const origen = guardando ? "Guardando…"
    : invertida ? "El fin va después del inicio."
      : ventana.origen === "declarado" ? `Propuesta del Planner · ${textoOrigen("declarado", control.estado?.declaradoEn.ventana).toLowerCase()}`
        : ventana.fuente === "monitoreo" || ventana.fuente === "cronograma"
          ? `Según ${FUENTE[ventana.fuente]}${inicio && !fin ? ", que no da el fin: ponlo para proponerla" : ", sin proponer"}`
          : "Nadie la declara todavía: pon las dos fechas";

  return (
    <div className="planner-ventana">
      <label className="planner-campo planner-campo--fecha">
        <span>Desde</span>
        <input type="date" value={inicio} max={fin || undefined} onChange={(e) => setInicio(e.target.value)} />
      </label>
      <label className="planner-campo planner-campo--fecha">
        <span>Hasta</span>
        <input type="date" value={fin} min={inicio || undefined} onChange={(e) => setFin(e.target.value)} />
      </label>
      <button
        type="button"
        className="plan-button plan-button--primary"
        disabled={!proponible}
        onClick={() => { void control.declarar("ventana", { inicio, fin }); }}
      >
        Proponer ventana
      </button>
      <span className="planner-calendario-fuente" role={invertida ? "alert" : undefined}>{origen}</span>
    </div>
  );
}
