// EnsayoPublicacionDialog.tsx — «Revisar → Aplicar» de Avance › Salidas
// (Meta B, L38). El ensayo solo lee el libro destino; Aplicar es la misma
// publicación de siempre, ofrecida con el peso que el diff le da.

import { AlertTriangle, ExternalLink, ListChecks, Loader2 } from "lucide-react";
import type { EnsayoPestana, EnsayoPublicacion } from "../../../api/monitoreoPublicarEnsayo";
import { Dialog } from "../../../components/Dialog";
import { PulsoButton } from "../../../components/PulsoButton";
import { PANEL_REVISAR_PUBLICACION } from "../../../lib/navegacion/manifiesto";
import {
  ROTULO_ESTADO,
  accionAplicar,
  cifrasResumen,
  estadoPestana,
  lineaClave,
  lineaIntactas,
  lineaPestana,
} from "./ensayoPublicacionModelo";
import "./ensayoPublicacion.css";

export type EstadoEnsayo =
  | { kind: "cargando" }
  | { kind: "listo"; ensayo: EnsayoPublicacion }
  | { kind: "error"; message: string }
  /** Falta algo que el ensayo no puede resolver (corte, destino, confirmación): sin reintento. */
  | { kind: "bloqueado"; message: string };

type Props = {
  destino: string;
  estado: EstadoEnsayo;
  aplicando: boolean;
  onAplicar: () => void;
  onReintentar: () => void;
};

const MAX_FILAS_VISIBLES = 8;

function DetallePestana({ p }: { p: EnsayoPestana }) {
  const { anadidas, cambiadas, borradas } = p.detalle;
  if (!anadidas.length && !cambiadas.length && !borradas.length) return null;
  return (
    <details className="mon-ensayo-detalle">
      <summary>Ver filas</summary>
      <div className="mon-ensayo-detalle__cuerpo">
        {cambiadas.length ? (
          <section>
            <h5>Cambiadas</h5>
            <ul>
              {cambiadas.slice(0, MAX_FILAS_VISIBLES).map((c) => (
                <li key={`c-${c.clave}`}>
                  <b>{c.clave}</b>
                  {c.celdas.map((celda) => (
                    <span key={celda.columna} className="mon-ensayo-celda">
                      {celda.columna}: <s>{celda.antes || "vacío"}</s> → {celda.despues || "vacío"}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {anadidas.length ? (
          <section>
            <h5>Añadidas</h5>
            <ul>
              {anadidas.slice(0, MAX_FILAS_VISIBLES).map((f, i) => (
                <li key={`a-${i}-${f.clave}`}>{f.valores.filter(Boolean).slice(0, 4).join(" · ")}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {borradas.length ? (
          <section className="is-borradas">
            <h5>Borradas</h5>
            <ul>
              {borradas.slice(0, MAX_FILAS_VISIBLES).map((f, i) => (
                <li key={`b-${i}-${f.clave}`}>{f.valores.filter(Boolean).slice(0, 4).join(" · ")}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {p.detalleTruncado || Math.max(anadidas.length, cambiadas.length, borradas.length) > MAX_FILAS_VISIBLES ? (
          <p className="mon-ensayo-detalle__nota">Se muestran las primeras {MAX_FILAS_VISIBLES} de cada grupo.</p>
        ) : null}
      </div>
    </details>
  );
}

function FilaPestana({ p }: { p: EnsayoPestana }) {
  const estado = estadoPestana(p);
  const clave = lineaClave(p);
  return (
    <li className={`mon-ensayo-pestana is-${estado}`}>
      <div className="mon-ensayo-pestana__cabeza">
        <b>{p.pestana}</b>
        <span className={`mon-ensayo-pildora is-${estado}`}>{ROTULO_ESTADO[estado]}</span>
      </div>
      <p className="mon-ensayo-pestana__linea">{lineaPestana(p)}</p>
      {clave ? <p className="mon-ensayo-pestana__clave">{clave}</p> : null}
      <DetallePestana p={p} />
    </li>
  );
}

export function EnsayoPublicacionDialog({ destino, estado, aplicando, onAplicar, onReintentar }: Props) {
  const ensayo = estado.kind === "listo" ? estado.ensayo : null;
  const accion = ensayo ? accionAplicar(ensayo) : null;
  const intactas = ensayo ? lineaIntactas(ensayo) : "";

  return (
    <Dialog
      panel={PANEL_REVISAR_PUBLICACION}
      size="lg"
      alto="fijo"
      icon={<ListChecks size={18} />}
      tono={accion?.tono === "peligro" ? "peligro" : "modulo"}
      title={`Revisar la publicación ${destino}`}
      subtitle="Qué cambiaría en el libro de Google Sheets. Revisar no escribe nada."
      dismissible={!aplicando}
      footerStatus={accion?.aviso ? (
        <span className={`mon-ensayo-aviso${accion.tono === "peligro" ? " is-peligro" : ""}`}>
          {accion.tono === "peligro" ? <AlertTriangle size={14} aria-hidden="true" /> : null}
          {accion.aviso}
        </span>
      ) : null}
      footer={
        estado.kind === "error" ? (
          <PulsoButton variant="secondary" onClick={onReintentar}>Volver a revisar</PulsoButton>
        ) : accion ? (
          accion.tono === "peligro" ? (
            <PulsoButton variant="danger" confirm onClick={onAplicar} disabled={aplicando}>
              {aplicando ? <Loader2 size={14} className="pulso-spin" /> : <AlertTriangle size={14} />}
              {accion.rotulo}
            </PulsoButton>
          ) : (
            <PulsoButton variant="primary" onClick={onAplicar} disabled={aplicando}>
              {aplicando ? <Loader2 size={14} className="pulso-spin" /> : null}
              {accion.rotulo}
            </PulsoButton>
          )
        ) : null
      }
    >
      {estado.kind === "cargando" ? (
        <div className="mon-ensayo-estado" role="status">
          <Loader2 size={18} className="pulso-spin" />
          <span>Leyendo el libro destino para compararlo…</span>
        </div>
      ) : estado.kind === "bloqueado" ? (
        <div className="mon-ensayo-estado is-bloqueado" role="status">
          <AlertTriangle size={18} />
          <span>{estado.message}</span>
        </div>
      ) : estado.kind === "error" ? (
        <div className="mon-ensayo-estado is-error" role="alert">
          <AlertTriangle size={18} />
          <span>{estado.message}</span>
        </div>
      ) : ensayo ? (
        <div className="mon-ensayo">
          <div className="mon-ensayo-resumen" aria-label="Resumen del ensayo">
            {cifrasResumen(ensayo).map((c) => (
              <div key={c.clave} className={`mon-ensayo-cifra is-${c.clave}${c.valor ? "" : " is-cero"}`}>
                <b>{c.valor.toLocaleString("es-PE")}</b>
                <span>{c.rotulo}</span>
              </div>
            ))}
          </div>
          <ul className="mon-ensayo-pestanas">
            {ensayo.pestanas.map((p) => <FilaPestana key={p.pestana} p={p} />)}
          </ul>
          <div className="mon-ensayo-pie">
            {intactas ? <span>{intactas}</span> : null}
            {ensayo.spreadsheetUrl ? (
              <a href={ensayo.spreadsheetUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={13} />
                Abrir el libro
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
