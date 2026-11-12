/**
 * Acreditación › Resultados › Propuesta: las propuestas de muestra de un barrido (A, B, C y hasta una D) con la meta
 * de cada actor, el margen de referencia que da y la respuesta que exige frente a la esperada del actor, más la
 * descarga del PPT de diseño muestral y del Excel de escenarios. Pedido de Gonzalo (2026-11-12): "que este cálculo
 * de muestra esté al nivel, se configure bien y la interfaz sea entendible". Las propuestas se guardan en
 * `workspace.propuesta` del estudio, así que viajan en el `.pulso`.
 */
import { FileSpreadsheet, Minus, Plus, Presentation } from "lucide-react";
import { useMemo } from "react";
import type { CalcMuestraComponente, CalcMuestraWorkspace } from "../../../api/calcMuestra";
import { apiCalcMuestraPropuestaExportar } from "../../../api/calcMuestra";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { MODULO_CALC_MUESTRA } from "../entregas/modeloEntrega";
import { NumberCell } from "../universidad/aulas";
import {
  actoresDePropuesta,
  agregarPropuesta,
  fijarMeta,
  fmtPorcentaje,
  lecturaMeta,
  MAX_PROPUESTAS,
  payloadPropuesta,
  propuestaVigente,
  quitarUltimaPropuesta,
  totalPropuesta,
  type EstadoPropuesta,
  type FilaPropuesta,
} from "./modeloPropuesta";
import "./propuesta.css";

const cifra = new Intl.NumberFormat("en-US");

type FilaTabla = FilaPropuesta & { total: boolean };

function CeldaMeta({ n, fila, nombre, onChange }: { n: number; fila: FilaPropuesta; nombre: string; onChange: (v: number) => void }) {
  const l = lecturaMeta(n, fila);
  return (
    <div className="cmg-propuesta-celda">
      <NumberCell value={n} ariaLabel={`${nombre} de ${fila.actor}`} onChange={onChange} />
      <span className="cmg-propuesta-lectura">{l.margen == null ? "Sin margen" : `± ${fmtPorcentaje(l.margen)}`}</span>
      {l.respuestaNecesaria != null && (
        <span className="cmg-propuesta-lectura" data-excede={l.excede ? "true" : undefined}>
          Respuesta {fmtPorcentaje(l.respuestaNecesaria)}
        </span>
      )}
    </div>
  );
}

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
  const guardar = (siguiente: EstadoPropuesta) => onWorkspace({ ...workspace, propuesta: siguiente });
  const ppt = useGeneracion({ titulo: "Propuesta de diseño muestral", modulo: MODULO_CALC_MUESTRA, formato: "pptx", articulo: "la" });
  const xlsx = useGeneracion({ titulo: "Escenarios de muestra", modulo: MODULO_CALC_MUESTRA, formato: "xlsx", articulo: "los" });
  const excedidas = estado.escenarios.flatMap((e) => filas.filter((f) => lecturaMeta(e.metas[f.id] ?? 0, f).excede).map((f) => `${e.nombre} en ${f.actor}`));

  const poblacionTotal = filas.reduce((x, f) => x + f.poblacion, 0);
  const columnas: PulsoTableColumna<FilaTabla>[] = [
    { id: "actor", encabezado: "Actor", ancho: 200, celda: (f) => (f.total ? <strong>{f.actor}</strong> : f.actor) },
    { id: "poblacion", encabezado: "Población", ancho: 110, tipo: "cifra", celda: (f) => (f.total ? <strong>{cifra.format(f.poblacion)}</strong> : cifra.format(f.poblacion)) },
    {
      id: "esperada",
      encabezado: "Respuesta esperada",
      ancho: 156,
      tipo: "cifra",
      celda: (f) => (f.total ? "" : f.respuestaEsperada == null ? "Sin declarar" : fmtPorcentaje(f.respuestaEsperada)),
    },
    ...estado.escenarios.map((e, i): PulsoTableColumna<FilaTabla> => ({
      id: `p${i}`,
      encabezado: e.nombre,
      ancho: 150,
      tipo: "cifra",
      celda: (f) => {
        if (!f.total) return <CeldaMeta n={e.metas[f.id] ?? 0} fila={f} nombre={e.nombre} onChange={(v) => guardar(fijarMeta(estado, i, f.id, v))} />;
        const total = totalPropuesta(e.metas, filas);
        return (
          <div className="cmg-propuesta-celda">
            <strong>{cifra.format(total)}</strong>
            {poblacionTotal > 0 && <span className="cmg-propuesta-lectura">Respuesta {fmtPorcentaje(total / poblacionTotal)}</span>}
          </div>
        );
      },
    })),
  ];

  return (
    <Panel className="cmg-propuesta" aria-labelledby="cmg-propuesta-titulo" data-qa-geometry-member>
      <h3 id="cmg-propuesta-titulo" className="cmg-propuesta-titulo">Propuestas de muestra</h3>
      {filas.length === 0 ? (
        <p className="cmg-propuesta-vacio">Declara el N de al menos un actor para armar las propuestas.</p>
      ) : (
        <>
          <PulsoTable
            columnas={columnas}
            filas={[...filas.map((f) => ({ ...f, total: false })), { id: "__total", actor: "Total", poblacion: poblacionTotal, respuestaEsperada: null, total: true }]}
            idDeFila={(f) => f.id}
            ariaLabel="Meta de cada actor por propuesta"
            densidad="compacta"
          />
          <p className="cmg-propuesta-nota" id="cmg-propuesta-nota">
            Margen de referencia al 95 % (p = 0.5). Respuesta: la que exige la meta sobre la población; la esperada se
            declara en Actores.
          </p>
          {excedidas.length > 0 && (
            <p className="cmg-propuesta-aviso" role="status">
              Exige más respuesta que la esperada: {excedidas.join("; ")}. Esas metas no se alcanzan invitando a todos.
            </p>
          )}
          <div className="cmg-propuesta-acciones">
            <PulsoButton
              variant="secondary"
              size="sm"
              disabled={estado.escenarios.length >= MAX_PROPUESTAS}
              onClick={() => guardar(agregarPropuesta(estado))}
            >
              <Plus size={14} aria-hidden="true" /> Agregar propuesta
            </PulsoButton>
            {estado.escenarios.length > 1 && (
              <PulsoButton variant="secondary" size="sm" onClick={() => guardar(quitarUltimaPropuesta(estado))}>
                <Minus size={14} aria-hidden="true" /> Quitar {estado.escenarios[estado.escenarios.length - 1]?.nombre}
              </PulsoButton>
            )}
          </div>
          <div className="cmg-propuesta-opciones">
            <PulsoSwitch checked={estado.incluir_portada} onCheckedChange={(v) => guardar({ ...estado, incluir_portada: v })} size="sm" label="Portada" />
            <PulsoSwitch checked={estado.incluir_diseno} onCheckedChange={(v) => guardar({ ...estado, incluir_diseno: v })} size="sm" label="Lámina de diseño muestral" />
            <label className="cmg-propuesta-solicitante">
              <span>Solicitante</span>
              <PulsoInput size="sm" value={estado.solicitante} onChange={(e) => guardar({ ...estado, solicitante: e.currentTarget.value })} />
            </label>
          </div>
          <div className="cmg-propuesta-acciones">
            <PulsoButton
              variant="primary"
              size="sm"
              disabled={ppt.estado.fase === "en_curso"}
              onClick={() => { void ppt.ejecutar(() => apiCalcMuestraPropuestaExportar(payloadPropuesta("pptx", estado, filas))); }}
            >
              <Presentation size={14} aria-hidden="true" /> Descargar PPT
            </PulsoButton>
            <PulsoButton
              variant="secondary"
              size="sm"
              disabled={xlsx.estado.fase === "en_curso"}
              onClick={() => { void xlsx.ejecutar(() => apiCalcMuestraPropuestaExportar(payloadPropuesta("xlsx", estado, filas))); }}
            >
              <FileSpreadsheet size={14} aria-hidden="true" /> Descargar Excel
            </PulsoButton>
          </div>
          <ContenedorEntregable estado={ppt.estado} forma="bloque" onCerrar={ppt.cerrar} />
          <ContenedorEntregable estado={xlsx.estado} forma="bloque" onCerrar={xlsx.cerrar} />
        </>
      )}
    </Panel>
  );
}
