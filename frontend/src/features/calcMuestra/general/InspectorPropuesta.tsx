/**
 * Inspector de una propuesta de muestra (Acreditación › Resultados): el total, la respuesta que exige cada meta
 * frente a la esperada del actor, dibujada como barra con una marca, y el archivo (portada, lámina de diseño,
 * solicitante y descargas). Geometría de Codificación › Aplicar: panel de mesa con conmutador en la cabecera y pie
 * fijo con las acciones.
 */
import type { CSSProperties } from "react";
import { FileSpreadsheet, Presentation, Scale } from "lucide-react";
import { apiCalcMuestraPropuestaExportar } from "../../../api/calcMuestra";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { Alert } from "../../../components/Alert";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
// El relleno de las barras usa la secuencia de datos (--pulso-data-seq-*), que vive en tokens-datos.css.
import "../../../app/tokens-datos.css";
import { MODULO_CALC_MUESTRA } from "../entregas/modeloEntrega";
import {
  escalaDeRespuesta,
  fmtPorcentaje,
  lecturaMeta,
  payloadPropuesta,
  totalPropuesta,
  type EstadoPropuesta,
  type FilaPropuesta,
} from "./modeloPropuesta";

const cifra = new Intl.NumberFormat("en-US");

export function InspectorPropuesta({ estado, filas, activa, onActiva, onCambio }: {
  estado: EstadoPropuesta;
  filas: readonly FilaPropuesta[];
  activa: number;
  onActiva: (indice: number) => void;
  onCambio: (siguiente: EstadoPropuesta) => void;
}) {
  const ppt = useGeneracion({ titulo: "Propuesta de diseño muestral", modulo: MODULO_CALC_MUESTRA, formato: "pptx", articulo: "la" });
  const xlsx = useGeneracion({ titulo: "Escenarios de muestra", modulo: MODULO_CALC_MUESTRA, formato: "xlsx", articulo: "los" });
  const indice = Math.min(activa, estado.escenarios.length - 1);
  const escenario = estado.escenarios[indice];
  if (!escenario) return null;
  const total = totalPropuesta(escenario.metas, filas);
  const poblacion = filas.reduce((x, f) => x + f.poblacion, 0);
  const escala = escalaDeRespuesta(estado, filas);
  const opciones = estado.escenarios.map((e, i) => ({ i, rotulo: e.nombre.replace(/^Propuesta\s+/, "") }));
  const lecturas = filas.map((f) => ({ f, l: lecturaMeta(escenario.metas[f.id] ?? 0, f) }));
  const excedidas = lecturas.filter(({ l }) => l.excede);

  return (
    <PanelDeMesa
      zona="propuesta-detalle"
      titulo={escenario.nombre}
      icono={<Scale size={16} />}
      etiquetaCuerpo={`Detalle de ${escenario.nombre}`}
      acciones={estado.escenarios.length > 1 ? (
        <GlidingRadioGroup
          value={indice}
          options={opciones}
          getOptionValue={(o) => o.i}
          onValueChange={onActiva}
          className="cmg-segmentado"
          aria-label="Propuesta que se ve"
        >
          {(o) => <span>{o.rotulo}</span>}
        </GlidingRadioGroup>
      ) : undefined}
      pie={(
        <>
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
        </>
      )}
    >
      <dl className="cmg-insp-cifras" aria-label={`Cifras de ${escenario.nombre}`}>
        <div>
          <dt>encuestas</dt>
          <dd>{cifra.format(total)}</dd>
        </div>
        <div>
          <dt>respuesta global, de {cifra.format(poblacion)} invitados</dt>
          <dd>{poblacion > 0 ? fmtPorcentaje(total / poblacion) : "Sin población"}</dd>
        </div>
      </dl>

      <div className="cmg-insp-cuerpo">
      <section className="cmg-insp-seccion" aria-labelledby="cmg-insp-respuesta">
        <div className="cmg-insp-titulo">
          <h4 id="cmg-insp-respuesta">Respuesta que exige cada meta</h4>
          <span className="cmg-insp-leyenda" aria-hidden="true">
            <span className="cmg-insp-leyenda-barra" />exige
            <span className="cmg-insp-leyenda-marca" />esperada
          </span>
        </div>
        <ul className="cmg-insp-actores">
          {lecturas.map(({ f, l }) => (
            <li key={f.id} data-excede={l.excede ? "true" : undefined}>
              <span className="cmg-insp-actor">{f.actor}</span>
              <span className="cmg-insp-exige">{l.respuestaNecesaria == null ? "Sin meta" : fmtPorcentaje(l.respuestaNecesaria)}</span>
              <div
                className="cmg-insp-barra"
                style={{
                  "--cmg-necesaria": String(Math.min(1, (l.respuestaNecesaria ?? 0) / escala)),
                  "--cmg-esperada": String(Math.min(1, (f.respuestaEsperada ?? 0) / escala)),
                } as CSSProperties}
                aria-hidden="true"
              >
                <span className="cmg-insp-barra-relleno" />
                {f.respuestaEsperada != null ? <span className="cmg-insp-barra-marca" /> : null}
              </div>
              <span className="cmg-insp-detalle">
                {f.respuestaEsperada != null ? `Esperada ${fmtPorcentaje(f.respuestaEsperada)}` : "Sin respuesta esperada"}
                {l.margen != null ? `, margen ± ${fmtPorcentaje(l.margen)}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {excedidas.length > 0 ? (
          <Alert kind="error">
            {excedidas.map(({ f }) => f.actor).join(", ")}: la meta exige más respuesta que la esperada y no se alcanza
            invitando a todos.
          </Alert>
        ) : null}
      </section>

      <section className="cmg-insp-seccion" aria-labelledby="cmg-insp-archivo">
        <h4 id="cmg-insp-archivo">Archivo</h4>
        <div className="cmg-insp-opciones">
          <PulsoSwitch checked={estado.incluir_portada} onCheckedChange={(v) => onCambio({ ...estado, incluir_portada: v })} size="sm" label="Portada" />
          <PulsoSwitch checked={estado.incluir_diseno} onCheckedChange={(v) => onCambio({ ...estado, incluir_diseno: v })} size="sm" label="Lámina de diseño muestral" />
          <label className="cmg-propuesta-solicitante">
            <span>Solicitante</span>
            <PulsoInput size="sm" value={estado.solicitante} onChange={(e) => onCambio({ ...estado, solicitante: e.currentTarget.value })} />
          </label>
        </div>
        <ContenedorEntregable estado={ppt.estado} forma="bloque" onCerrar={ppt.cerrar} />
        <ContenedorEntregable estado={xlsx.estado} forma="bloque" onCerrar={xlsx.cerrar} />
      </section>
      </div>
    </PanelDeMesa>
  );
}
