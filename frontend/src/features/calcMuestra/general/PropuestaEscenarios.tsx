/**
 * Acreditación › Resultados › Propuesta: la meta de cada actor en dos escenarios y la descarga del PPT de diseño
 * muestral y del Excel de escenarios, armados por el motor con los actores del estudio. Pedido de Gonzalo
 * (2026-11-11): "asegúrate que Cálculo de muestra pueda hacer ello". La entrega va por el kit de entregables.
 */
import { FileSpreadsheet, Presentation } from "lucide-react";
import { useMemo, useState } from "react";
import type { CalcMuestraComponente } from "../../../api/calcMuestra";
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
import { actoresDePropuesta, escenariosIniciales, payloadPropuesta, totalEscenario, type FilaPropuesta } from "./modeloPropuesta";
import "./propuesta.css";

const cifra = new Intl.NumberFormat("en-US");

type FilaTabla = FilaPropuesta & { total: boolean };

export function PropuestaEscenarios({ componentes }: { componentes: readonly CalcMuestraComponente[] }) {
  const filas = useMemo(() => actoresDePropuesta(componentes), [componentes]);
  const iniciales = useMemo(() => escenariosIniciales(componentes), [componentes]);
  const [editadas, setEditadas] = useState<{ A: Record<string, number>; B: Record<string, number> }>({ A: {}, B: {} });
  const [portada, setPortada] = useState(true);
  const [diseno, setDiseno] = useState(true);
  const [solicitante, setSolicitante] = useState("");
  const metas = {
    A: { ...iniciales.A, ...editadas.A },
    B: { ...iniciales.B, ...editadas.B },
  };
  const ppt = useGeneracion({ titulo: "Propuesta de diseño muestral", modulo: MODULO_CALC_MUESTRA, formato: "pptx", articulo: "la" });
  const xlsx = useGeneracion({ titulo: "Escenarios de muestra", modulo: MODULO_CALC_MUESTRA, formato: "xlsx", articulo: "los" });
  const opciones = { portada, diseno, solicitante };
  const fijar = (esc: "A" | "B", id: string, valor: number) =>
    setEditadas((prev) => ({ ...prev, [esc]: { ...prev[esc], [id]: Math.max(0, Math.round(valor)) } }));
  const celdaMeta = (esc: "A" | "B") => (f: FilaTabla) =>
    f.total ? <strong>{cifra.format(totalEscenario(metas[esc], filas))}</strong>
      : <NumberCell value={metas[esc][f.id] ?? 0} ariaLabel={`Propuesta ${esc} de ${f.actor}`} onChange={(v) => fijar(esc, f.id, v)} />;
  const columnas: PulsoTableColumna<FilaTabla>[] = [
    { id: "actor", encabezado: "Actor", ancho: 260, celda: (f) => (f.total ? <strong>{f.actor}</strong> : f.actor) },
    { id: "poblacion", encabezado: "Población", ancho: 120, tipo: "cifra", celda: (f) => (f.total ? <strong>{cifra.format(f.poblacion)}</strong> : cifra.format(f.poblacion)) },
    { id: "a", encabezado: "Propuesta A", ancho: 150, tipo: "cifra", celda: celdaMeta("A") },
    { id: "b", encabezado: "Propuesta B", ancho: 150, tipo: "cifra", celda: celdaMeta("B") },
  ];

  return (
    <Panel className="cmg-propuesta" aria-labelledby="cmg-propuesta-titulo" data-qa-geometry-member>
      <h3 id="cmg-propuesta-titulo" className="cmg-propuesta-titulo">Propuesta</h3>
      {filas.length === 0 ? (
        <p className="cmg-propuesta-vacio">Declara el N de al menos un actor para armar la propuesta.</p>
      ) : (
        <>
          <PulsoTable
            columnas={columnas}
            filas={[...filas.map((f) => ({ ...f, total: false })), { id: "__total", actor: "Total", poblacion: filas.reduce((x, f) => x + f.poblacion, 0), total: true }]}
            idDeFila={(f) => f.id}
            ariaLabel="Meta de cada actor por escenario"
            densidad="compacta"
          />
          <div className="cmg-propuesta-opciones">
            <PulsoSwitch checked={portada} onCheckedChange={setPortada} size="sm" label="Portada" />
            <PulsoSwitch checked={diseno} onCheckedChange={setDiseno} size="sm" label="Lámina de diseño muestral" />
            <label className="cmg-propuesta-solicitante">
              <span>Solicitante</span>
              <PulsoInput size="sm" value={solicitante} onChange={(e) => setSolicitante(e.currentTarget.value)} />
            </label>
          </div>
          <div className="cmg-propuesta-acciones">
            <PulsoButton
              variant="primary"
              size="sm"
              disabled={ppt.estado.fase === "en_curso"}
              onClick={() => { void ppt.ejecutar(() => apiCalcMuestraPropuestaExportar(payloadPropuesta("pptx", metas, filas, opciones))); }}
            >
              <Presentation size={14} aria-hidden="true" /> Descargar PPT
            </PulsoButton>
            <PulsoButton
              variant="secondary"
              size="sm"
              disabled={xlsx.estado.fase === "en_curso"}
              onClick={() => { void xlsx.ejecutar(() => apiCalcMuestraPropuestaExportar(payloadPropuesta("xlsx", metas, filas, opciones))); }}
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
