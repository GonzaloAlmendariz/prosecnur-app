import { ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import type { CalcMuestraCanalRecojo, CalcMuestraComponente } from "../../../api/calcMuestra";
import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConNivel } from "../../../lib/navegacion/useDireccion";
import { safeNumber, type ComponentePatch } from "../sharedCore";
import { actorVisual, CANAL_OPTIONS } from "./catalogos";
import { useMuestraGeneral } from "./useMuestraGeneral";
import { useMuestraGeneralStore } from "./store";
import "./general.css";
import "./secciones-acreditacion.css";
import { Panel } from "../../../components/Panel";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";

/** Dirección de una sección con un actor en foco: `seccion=<seccion>&foco=<id>`. */
export function hrefSeccionDeActor(pathname: string, search: string, seccion: string, componenteId: string): string {
  return `${pathname}${conNivel(searchConNivel(search, "seccion", seccion), "foco", componenteId)}`;
}

/** Dirección de la Selección de un actor: `seccion=seleccion&foco=<id>`. */
export function hrefSeleccionDeActor(pathname: string, search: string, componenteId: string): string {
  return hrefSeccionDeActor(pathname, search, "seleccion", componenteId);
}

const cifra = new Intl.NumberFormat("en-US");

/**
 * Acreditación › Actores: los públicos del estudio, con el nombre que les pone el equipo y su canal. La población
 * sale del Marco y la meta de Meta; aquí solo se ve en qué quedó cada uno y se enlaza a esa sección.
 */
export function ActoresAcreditacion({
  componentes,
  onComponente,
}: {
  componentes: CalcMuestraComponente[];
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const location = useLocation();
  useMuestraGeneral(null);
  const marcos = useMuestraGeneralStore((s) => s.marcos);
  const columnas: PulsoTableColumna<CalcMuestraComponente>[] = [
    {
      id: "actor", encabezado: "Actor", ancho: 320, celda: (comp) => {
        const meta = actorVisual(comp);
        return (
          <span className={`cmg-actor-nombre cmv2-actor-row--${meta.key}`}>
            <span className="cmv2-actor-dot" aria-hidden="true" />
            <PulsoInput
              key={meta.label}
              size="sm"
              aria-label={`Nombre de ${meta.label}`}
              defaultValue={meta.label}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              onBlur={(e) => {
                const nombre = e.currentTarget.value.trim();
                if (nombre && nombre !== meta.label) onComponente(comp.id, { actor: nombre });
                else e.currentTarget.value = meta.label;
              }}
            />
          </span>
        );
      },
    },
    {
      id: "canal", encabezado: "Canal", ancho: 200, celda: (comp) => (
        <select
          className="cmv2-channel-select"
          aria-label={`Canal de ${actorVisual(comp).label}`}
          value={comp.canal_recojo}
          onChange={(e) => onComponente(comp.id, { canal_recojo: e.currentTarget.value as CalcMuestraCanalRecojo })}
        >
          {CANAL_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
        </select>
      ),
    },
    {
      id: "marco", encabezado: "Marco", ancho: 220, celda: (comp) => {
        const N = safeNumber(comp.marco?.marco_validado, 0);
        return (
          <Link className="cmg-actor-estado" to={hrefSeccionDeActor(location.pathname, location.search, "marco", comp.id)}>
            {N > 0
              ? <><strong>{cifra.format(N)}</strong><small>{marcos[comp.id] ? (marcos[comp.id].fuente === "conteos" ? "desde una tabla" : "desde la base") : "escrita a mano"}</small></>
              : <span className="cmg-sin-dato">Sin marco</span>}
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        );
      },
    },
    {
      id: "meta", encabezado: "Meta", ancho: 200, celda: (comp) => {
        const encuestas = safeNumber(comp.meta?.valor, 0) || safeNumber(comp.resultado?.n_objetivo, 0);
        return (
          <Link className="cmg-actor-estado" to={hrefSeccionDeActor(location.pathname, location.search, "meta", comp.id)}>
            {encuestas > 0 ? <><strong>{cifra.format(encuestas)}</strong><small>encuestas</small></> : <span className="cmg-sin-dato">Sin meta</span>}
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        );
      },
    },
  ];
  return (
    <Panel
      className="cmg-actores-acred"
      aria-labelledby="cmg-actores-titulo"
      data-audit-ready="true"
      eyebrow="Públicos del estudio"
      title={<span id="cmg-actores-titulo">Actores del estudio</span>}
    >
      <PulsoTable columnas={columnas} filas={componentes} idDeFila={(c) => c.id} ariaLabel="Actores del estudio" />
    </Panel>
  );
}
