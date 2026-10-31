// La franja de Cronograma › Plan: cuándo es el campo y en qué etapa está el
// estudio (ADR 0122 §2). La etapa hoy tiene dos dueños —Hojas de ruta y
// Monitoreo territorial— y el Planner la muestra con su fuente; si no
// coinciden, lo dice en vez de elegir una.

import { useEffect, useState } from "react";

import { apiPlannerCalendario, type PlannerCalendario } from "../../../api/planner";
import { parseLocalDate } from "../dateUtils";
import { PlannerAvisos } from "./PlannerCabecera";

const FUENTE: Record<string, string> = { hojas_ruta: "Hojas de ruta", monitoreo: "Monitoreo" };
const ETAPA: Record<string, string> = { piloto: "Piloto", campo: "Campo" };

function fecha(iso: string) {
  const d = parseLocalDate(iso);
  return d ? d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
}

export function PlannerCalendarioResumen({ recarga }: { recarga: unknown }) {
  const [cal, setCal] = useState<PlannerCalendario | null>(null);
  useEffect(() => {
    let vivo = true;
    apiPlannerCalendario().then((c) => { if (vivo) setCal(c); }).catch(() => { if (vivo) setCal(null); });
    return () => { vivo = false; };
  }, [recarga]);
  if (!cal) return null;

  const fuentes = Object.entries(cal.etapa.fuentes);
  const campo = cal.campo.inicio || cal.campo.fin
    ? `${fecha(cal.campo.inicio) || "sin inicio"} – ${fecha(cal.campo.fin) || "sin fin"}`
    : "Sin fechas en el cronograma";

  return (
    <section className="planner-calendario" aria-label="Campo y etapa del estudio" data-audit-ready="planner-calendario">
      <dl className="planner-calendario-datos">
        <div>
          <dt>Campo</dt>
          <dd>{campo}</dd>
        </div>
        <div>
          <dt>Etapa operativa</dt>
          <dd>
            {cal.etapa.valor ? ETAPA[cal.etapa.valor] : fuentes.length ? "Sin acuerdo" : "Sin declarar"}
            {fuentes.length ? (
              <span className="planner-calendario-fuente">
                según {fuentes.map(([k, f]) => `${FUENTE[k] ?? k}${cal.etapa.valor ? "" : ` (${f?.etapa ? ETAPA[f.etapa] : "—"})`}`).join(" y ")}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
      <PlannerAvisos avisos={cal.avisos} tono="aviso" />
    </section>
  );
}
