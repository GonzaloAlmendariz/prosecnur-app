import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { MonitoreoCuota, MonitoreoCuotaPublico } from "../../../../api/monitoreoCuotas";
import { Alert } from "../../../../components/Alert";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";
import type { PanelDeclarado } from "../../../../lib/navegacion/paneles";
import { Eye, Loader2, Target, Trash2, Wand2, X } from "../../../../vendor/lucide-react";
import { SelectorDeSubvistas } from "../../core/selectorDeSubvistas/SelectorDeSubvistas";
import { claveDeSeguida } from "./seguidas";
import { AvanceCuotasEditorMetas } from "./AvanceCuotasEditorMetas";
import "./cuotasPanelUso.css";
import {
  type AccionBorrador,
  type BorradorCuota,
  cifra,
  coberturaATexto,
  coberturaPorDefecto,
  problemaDelBorrador,
  sumaDeMetas,
} from "./avanceCuotasModelo";

// Configurar una cuota: `?panel=cuota` (nueva) o `?panel=cuota&foco=<id>`
// (editar). Público, variable de su base, cobertura esperada, «Proponer
// metas» y la tabla editable; Guardar manda la configuración completa.

export const PANEL_CUOTA: PanelDeclarado = {
  id: "cuota",
  label: "Configurar cuota",
  clase: "sideover",
};

export type AvanceCuotasPanelProps = {
  borrador: BorradorCuota;
  publicos: MonitoreoCuotaPublico[];
  cuotas: MonitoreoCuota[];
  proponiendo: boolean;
  guardando: boolean;
  error: string;
  panelProps: { "data-pulso-panel": string };
  onBorrador: (a: AccionBorrador) => void;
  onProponer: () => void;
  onGuardar: () => void;
  onQuitar: (id: string) => void;
  onCerrar: () => void;
  /** Deja la variable en seguimiento, sin metas; sin él, el panel sólo arma cuotas. */
  onSeguir?: () => void;
  /** Saca la variable del seguimiento. */
  onDejarDeSeguir?: () => void;
  /** Variables ya en seguimiento (`claveDeSeguida`). */
  seguidas?: ReadonlySet<string>;
};

function EnPortal({ children }: { children: ReactNode }) {
  // Sin documento (render estático de los tests) se pinta en su sitio.
  return typeof document === "undefined" ? <>{children}</> : createPortal(children, document.body);
}

export function AvanceCuotasPanel({
  borrador,
  publicos,
  cuotas,
  proponiendo,
  guardando,
  error,
  panelProps,
  onBorrador,
  onProponer,
  onGuardar,
  onQuitar,
  onCerrar,
  onSeguir,
  onDejarDeSeguir,
  seguidas,
}: AvanceCuotasPanelProps) {
  // Una variable no siempre es para metas: a veces sólo se sigue su avance frente a
  // la distribución del universo (Gonzalo, 30/10). Editar una cuota es siempre «con metas».
  const [uso, setUso] = useState<"metas" | "seguimiento">(() => (
    !borrador.id && borrador.actor && borrador.variable && seguidas?.has(claveDeSeguida(borrador.actor, borrador.variable)) ? "seguimiento" : "metas"
  ));
  const seguimiento = uso === "seguimiento" && !borrador.id && Boolean(onSeguir);
  const yaSeguida = Boolean(borrador.actor && borrador.variable && seguidas?.has(claveDeSeguida(borrador.actor, borrador.variable)));
  const ids = useId();
  const primero = useRef<HTMLSelectElement | null>(null);
  const ocupado = proponiendo || guardando;
  const publico = publicos.find((p) => p.actor === borrador.actor);
  const variables = publico?.variables ?? [];
  const porDefecto = coberturaPorDefecto(publico);
  const suma = sumaDeMetas(borrador);
  const metaPublico = publico?.meta ?? null;
  // Una referencial no se compara con la meta del público: no se exige (ADR 0126).
  const referencial = borrador.caracter === "referencial";
  const diferencia = !referencial && metaPublico != null && borrador.filas.length ? suma - metaPublico : null;
  const problema = problemaDelBorrador(borrador, cuotas);

  useEffect(() => {
    primero.current?.focus();
    const alPulsar = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  return (
    <EnPortal>
      <div
        className="mon-cuotas-velo"
        {...panelProps}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      >
        <aside className="mon-cuotas-panel" role="dialog" aria-modal="true" aria-labelledby={`${ids}-t`}>
          <header className="mon-cuotas-panel-cabeza">
            <div>
              <span className="mon-cuotas-versalita">Cuotas</span>
              <h2 id={`${ids}-t`}>{borrador.id ? borrador.variable : seguimiento ? "Variable en seguimiento" : "Nueva cuota"}</h2>
              {borrador.id ? <small className="mon-cuotas-tenue">{borrador.actor}</small> : null}
            </div>
            <PulsoButton variant="icon" size="sm" aria-label="Cerrar" onClick={onCerrar}><X size={16} aria-hidden /></PulsoButton>
          </header>

          <div className="mon-cuotas-panel-cuerpo" data-qa-scroll-owner="cuota-panel">
            {!borrador.id && onSeguir ? (
              <div className="mon-cuotas-uso">
                <SelectorDeSubvistas
                  opciones={[{ clave: "metas", etiqueta: "Con metas", valor: "metas" as const }, { clave: "seguimiento", etiqueta: "Solo seguimiento", valor: "seguimiento" as const }]}
                  esActiva={(valor) => valor === uso}
                  onElegir={setUso}
                />
                <small className="mon-cuotas-tenue">
                  {seguimiento
                    ? "Sin metas: el avance de cada categoría se compara con su peso en el universo."
                    : "Cuántas encuestas pide cada categoría."}
                </small>
              </div>
            ) : null}
            <div className={`mon-cuotas-panel-campos${seguimiento ? " es-seguimiento" : ""}`}>
              <label className="mon-cuotas-campo">
                <span className="mon-cuotas-versalita">Público</span>
                <select
                  ref={primero}
                  value={borrador.actor}
                  disabled={ocupado || Boolean(borrador.id)}
                  onChange={(e) => onBorrador({ tipo: "publico", actor: e.target.value, publicos })}
                >
                  {publicos.map((p) => (
                    <option key={p.actor} value={p.actor}>{p.actor}</option>
                  ))}
                </select>
                {publico ? (
                  <small className="mon-cuotas-datos">
                    <span><b>{cifra(publico.universo)}</b> en la base</span>
                    {publico.meta != null ? <span>Meta <b>{cifra(publico.meta)}</b></span> : null}
                  </small>
                ) : null}
              </label>
              <label className="mon-cuotas-campo">
                <span className="mon-cuotas-versalita">Variable</span>
                <select
                  value={borrador.variable}
                  disabled={ocupado || Boolean(borrador.id)}
                  onChange={(e) => onBorrador({ tipo: "variable", variable: e.target.value })}
                >
                  <option value="">Elige la variable</option>
                  {variables.map((v) => (
                    <option key={v.variable} value={v.variable}>{v.variable}</option>
                  ))}
                  {borrador.variable && !variables.some((v) => v.variable === borrador.variable) ? (
                    <option value={borrador.variable}>{borrador.variable}</option>
                  ) : null}
                </select>
                {(() => {
                  const elegida = variables.find((v) => v.variable === borrador.variable);
                  return elegida ? <small className="mon-cuotas-datos"><span><b>{cifra(elegida.categorias)}</b> categorías</span></small> : null;
                })()}
              </label>
              {seguimiento ? null : (<>
              <label className="mon-cuotas-campo es-cobertura">
                <span className="mon-cuotas-versalita">Cobertura esperada</span>
                <span className="mon-cuotas-entrada-sufijo">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={borrador.cobertura}
                    placeholder={coberturaATexto(porDefecto) || "—"}
                    disabled={ocupado}
                    aria-describedby={`${ids}-cob`}
                    onChange={(e) => onBorrador({ tipo: "cobertura", cobertura: e.target.value })}
                  />
                  <span aria-hidden>%</span>
                </span>
                <small id={`${ids}-cob`}>
                  {publico && porDefecto != null
                    ? `Meta del público ${cifra(publico.meta)} de ${cifra(publico.universo)}`
                    : "El público no tiene meta declarada"}
                </small>
              </label>
              <PulsoButton
                variant="secondary"
                size="sm"
                className="mon-cuotas-proponer"
                disabled={ocupado || !borrador.actor || !borrador.variable}
                onClick={onProponer}
              >
                {proponiendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Wand2 size={14} aria-hidden />}
                Proponer metas
              </PulsoButton>
              </>)}
            </div>

            {seguimiento ? null : (
              <div className="mon-cuotas-uso">
                <SelectorDeSubvistas
                  opciones={[{ clave: "meta", etiqueta: "Meta", valor: "meta" as const }, { clave: "referencial", etiqueta: "Referencial", valor: "referencial" as const }]}
                  esActiva={(valor) => valor === borrador.caracter}
                  onElegir={(caracter) => onBorrador({ tipo: "caracter", caracter })}
                />
                <small className="mon-cuotas-tenue">
                  {borrador.caracter === "referencial"
                    ? "Los números son una referencia: se describe la composición frente al universo, sin faltante."
                    : "Los números se exigen: cada categoría tiene su faltante y se cumple o no."}
                </small>
              </div>
            )}
            {seguimiento ? (
              <EstadoVacio
                icono={<Target size={16} />}
                titulo={yaSeguida
                  ? 'Esta variable ya está en seguimiento. Su comparación está en Avance › Variables de control; para ponerle metas elige "Con metas".'
                  : borrador.variable ? "Se verá en Avance › Variables de control: universo frente a efectivas, categoría por categoría." : "Elige la variable que quieres seguir."}
              />
            ) : borrador.filas.length ? (
              <>
                <p className="mon-cuotas-suma" role="status">
                  <span>{referencial ? "Suma de referencias" : "Suma de metas"} <strong>{cifra(suma)}</strong></span>
                  {metaPublico != null && !referencial ? <span>meta del público <strong>{cifra(metaPublico)}</strong></span> : null}
                  {diferencia ? (
                    <span className={diferencia > 0 ? "es-sobre" : "es-bajo"}>
                      {diferencia > 0 ? `${cifra(diferencia)} sobre` : `${cifra(-diferencia)} bajo`} la meta del público
                    </span>
                  ) : null}
                </p>
                <AvanceCuotasEditorMetas
                  filas={borrador.filas}
                  deshabilitado={ocupado}
                  referencial={referencial}
                  onMeta={(categoria, meta) => onBorrador({ tipo: "meta", categoria, meta })}
                />
              </>
            ) : (
              <EstadoVacio
                icono={<Target size={15} />}
                titulo={borrador.variable ? "Propón las metas para llenar la tabla por categoría." : "Elige la variable de la cuota."}
              />
            )}
            {error ? <Alert kind="error">{error}</Alert> : null}
          </div>

          <footer className="mon-cuotas-panel-pie">
            {borrador.id ? (
              <PulsoButton variant="ghost" size="sm" className="mon-cuotas-quitar" disabled={ocupado} onClick={() => onQuitar(borrador.id)}>
                <Trash2 size={14} aria-hidden /> Quitar cuota
              </PulsoButton>
            ) : <span />}
            <span className="mon-cuotas-panel-acciones">
              {problema && borrador.variable && !seguimiento ? <small className="mon-cuotas-tenue">{problema}</small> : null}
              <PulsoButton variant="ghost" size="sm" disabled={guardando} onClick={onCerrar}>Cancelar</PulsoButton>
              {seguimiento && yaSeguida && onDejarDeSeguir ? (
                <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={onDejarDeSeguir}>
                  {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <X size={14} aria-hidden />}
                  Dejar de seguir
                </PulsoButton>
              ) : seguimiento ? (
                <PulsoButton variant="primary" size="sm" disabled={ocupado || !borrador.actor || !borrador.variable || yaSeguida} onClick={onSeguir}>
                  {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Eye size={14} aria-hidden />}
                  Seguir variable
                </PulsoButton>
              ) : (
                <PulsoButton variant="primary" size="sm" disabled={ocupado || Boolean(problema)} onClick={onGuardar}>
                  {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
                  Guardar
                </PulsoButton>
              )}
            </span>
          </footer>
        </aside>
      </div>
    </EnPortal>
  );
}
