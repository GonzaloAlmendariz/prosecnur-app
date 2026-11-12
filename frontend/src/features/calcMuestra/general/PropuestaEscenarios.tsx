/**
 * Acreditación › Resultados: propuestas de muestra de un barrido (A, B, C y hasta una D). Pedido de Gonzalo
 * (2026-11-12): "que este cálculo de muestra esté al nivel, se configure bien y la interfaz sea entendible", con la
 * geometría de las superficies nuevas de Procesamiento (Codificación › Aplicar): a la izquierda la tabla de metas por
 * actor y propuesta, a la derecha el inspector de la propuesta elegida con el criterio dibujado (respuesta que exige
 * cada meta frente a la esperada) y el archivo. Las propuestas se guardan en `workspace.propuesta` del estudio.
 */
import { Minus, Plus, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CalcMuestraComponente, CalcMuestraWorkspace } from "../../../api/calcMuestra";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { NumberCell } from "../universidad/aulas";
import { InspectorPropuesta } from "./InspectorPropuesta";
import {
  actoresDePropuesta,
  agregarPropuesta,
  fijarMeta,
  fmtPorcentaje,
  lecturaMeta,
  MAX_PROPUESTAS,
  propuestaVigente,
  quitarUltimaPropuesta,
  totalPropuesta,
  type EstadoPropuesta,
  type FilaPropuesta,
} from "./modeloPropuesta";
import "./propuesta.css";

const cifra = new Intl.NumberFormat("en-US");

type FilaTabla = FilaPropuesta & { total: boolean };

export function PropuestaEscenarios({
  componentes,
  workspace,
  onWorkspace,
}: {
  componentes: readonly CalcMuestraComponente[];
  workspace: CalcMuestraWorkspace;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const filas = useMemo(() => actoresDePropuesta(componentes), [componentes]);
  const estado = useMemo(() => propuestaVigente(workspace.propuesta, componentes), [workspace.propuesta, componentes]);
  const [activa, setActiva] = useState(0);
  const guardar = (siguiente: EstadoPropuesta) => onWorkspace({ ...workspace, propuesta: siguiente });
  const poblacionTotal = filas.reduce((x, f) => x + f.poblacion, 0);
  const ultima = estado.escenarios[estado.escenarios.length - 1];

  if (filas.length === 0) {
    return (
      <PanelDeMesa zona="propuesta-metas" titulo="Propuestas de muestra" icono={<Table2 size={16} />}>
        <EstadoVacio icono={<Table2 size={16} />} titulo="Sin actores con población" descripcion="Declara el N de al menos un actor en Actores para armar las propuestas." />
      </PanelDeMesa>
    );
  }

  const columnas: PulsoTableColumna<FilaTabla>[] = [
    { id: "actor", encabezado: "Actor", ancho: 190, celda: (f) => (f.total ? <strong>{f.actor}</strong> : f.actor) },
    { id: "poblacion", encabezado: "Población", ancho: 100, tipo: "cifra", celda: (f) => (f.total ? <strong>{cifra.format(f.poblacion)}</strong> : cifra.format(f.poblacion)) },
    {
      id: "esperada",
      encabezado: "Respuesta esperada",
      ancho: 150,
      tipo: "cifra",
      celda: (f) => (f.total ? "" : f.respuestaEsperada == null ? "Sin declarar" : fmtPorcentaje(f.respuestaEsperada)),
    },
    ...estado.escenarios.map((e, i): PulsoTableColumna<FilaTabla> => ({
      id: `p${i}`,
      encabezado: e.nombre,
      ancho: 130,
      tipo: "cifra",
      celda: (f) => {
        if (f.total) return <strong className="cmg-propuesta-total">{cifra.format(totalPropuesta(e.metas, filas))}</strong>;
        const n = e.metas[f.id] ?? 0;
        const l = lecturaMeta(n, f);
        return (
          // Enfocar una meta lleva el inspector a su propuesta.
          <div className="cmg-propuesta-celda" data-activa={i === activa ? "true" : undefined} onFocus={() => setActiva(i)}>
            <NumberCell value={n} ariaLabel={`${e.nombre} de ${f.actor}`} onChange={(v) => guardar(fijarMeta(estado, i, f.id, v))} />
            <span className="cmg-propuesta-lectura">{l.margen == null ? "Sin margen" : `± ${fmtPorcentaje(l.margen)}`}</span>
            {l.excede && l.respuestaNecesaria != null ? (
              <span className="cmg-propuesta-lectura" data-excede="true">Exige {fmtPorcentaje(l.respuestaNecesaria)}</span>
            ) : null}
          </div>
        );
      },
    })),
  ];

  return (
    <div className="cmg-propuesta-mesa" data-qa-geometry-member data-qa-geometry-group="calc-muestra/propuesta-mesa" data-qa-geometry-contract="intrinsic">
      <PanelDeMesa
        zona="propuesta-metas"
        titulo="Propuestas de muestra"
        icono={<Table2 size={16} />}
        conteo={estado.escenarios.length}
        acciones={(
          <>
            {estado.escenarios.length > 1 && ultima ? (
              <PulsoButton
                variant="ghost"
                size="sm"
                onClick={() => { guardar(quitarUltimaPropuesta(estado)); setActiva((a) => Math.min(a, estado.escenarios.length - 2)); }}
              >
                <Minus size={14} aria-hidden="true" /> Quitar {ultima.nombre.replace(/^Propuesta\s+/, "")}
              </PulsoButton>
            ) : null}
            <PulsoButton
              variant="secondary"
              size="sm"
              disabled={estado.escenarios.length >= MAX_PROPUESTAS}
              onClick={() => { guardar(agregarPropuesta(estado)); setActiva(estado.escenarios.length); }}
            >
              <Plus size={14} aria-hidden="true" /> Agregar propuesta
            </PulsoButton>
          </>
        )}
        pie={<span className="cmg-propuesta-nota">Margen de referencia al 95 % con p = 0.5. La respuesta esperada se declara en Actores.</span>}
      >
        <PulsoTable
          columnas={columnas}
          filas={[...filas.map((f) => ({ ...f, total: false })), { id: "__total", actor: "Total", poblacion: poblacionTotal, respuestaEsperada: null, total: true }]}
          idDeFila={(f) => f.id}
          ariaLabel="Meta de cada actor por propuesta"
          densidad="compacta"
        />
      </PanelDeMesa>
      <InspectorPropuesta estado={estado} filas={filas} activa={activa} onActiva={setActiva} onCambio={guardar} />
    </div>
  );
}
