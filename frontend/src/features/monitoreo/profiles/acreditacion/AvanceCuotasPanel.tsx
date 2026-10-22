import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { MonitoreoCuota, MonitoreoCuotaPublico } from "../../../../api/monitoreoCuotas";
import { Alert } from "../../../../components/Alert";
import { PulsoButton } from "../../../../components/PulsoButton";
import type { PanelDeclarado } from "../../../../lib/navegacion/paneles";
import { Loader2, Trash2, Wand2, X } from "../../../../vendor/lucide-react";
import { AvanceCuotasEditorMetas } from "./AvanceCuotasEditorMetas";
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
}: AvanceCuotasPanelProps) {
  const ids = useId();
  const primero = useRef<HTMLSelectElement | null>(null);
  const ocupado = proponiendo || guardando;
  const publico = publicos.find((p) => p.actor === borrador.actor);
  const variables = publico?.variables ?? [];
  const porDefecto = coberturaPorDefecto(publico);
  const suma = sumaDeMetas(borrador);
  const metaPublico = publico?.meta ?? null;
  const diferencia = metaPublico != null && borrador.filas.length ? suma - metaPublico : null;
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
              <h2 id={`${ids}-t`}>{borrador.id ? `${borrador.actor} · ${borrador.variable}` : "Nueva cuota"}</h2>
            </div>
            <PulsoButton variant="icon" size="sm" aria-label="Cerrar" onClick={onCerrar}><X size={16} aria-hidden /></PulsoButton>
          </header>

          <div className="mon-cuotas-panel-cuerpo" data-qa-scroll-owner="cuota-panel">
            <div className="mon-cuotas-panel-campos">
              <label className="mon-cuotas-campo">
                <span className="mon-cuotas-versalita">Público</span>
                <select
                  ref={primero}
                  value={borrador.actor}
                  disabled={ocupado || Boolean(borrador.id)}
                  onChange={(e) => onBorrador({ tipo: "publico", actor: e.target.value, publicos })}
                >
                  {publicos.map((p) => (
                    <option key={p.actor} value={p.actor}>
                      {p.actor} · {cifra(p.universo)} en la base{p.meta != null ? ` · meta ${cifra(p.meta)}` : ""}
                    </option>
                  ))}
                </select>
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
                    <option key={v.variable} value={v.variable}>
                      {v.variable} · {cifra(v.categorias)} categorías
                    </option>
                  ))}
                  {borrador.variable && !variables.some((v) => v.variable === borrador.variable) ? (
                    <option value={borrador.variable}>{borrador.variable}</option>
                  ) : null}
                </select>
              </label>
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
            </div>

            {borrador.filas.length ? (
              <>
                <p className="mon-cuotas-suma" role="status">
                  <span>Suma de metas <strong>{cifra(suma)}</strong></span>
                  {metaPublico != null ? <span>meta del público <strong>{cifra(metaPublico)}</strong></span> : null}
                  {diferencia ? (
                    <span className={diferencia > 0 ? "es-sobre" : "es-bajo"}>
                      {diferencia > 0 ? `${cifra(diferencia)} sobre` : `${cifra(-diferencia)} bajo`} la meta del público
                    </span>
                  ) : null}
                </p>
                <AvanceCuotasEditorMetas
                  filas={borrador.filas}
                  deshabilitado={ocupado}
                  onMeta={(categoria, meta) => onBorrador({ tipo: "meta", categoria, meta })}
                />
              </>
            ) : (
              <p className="mon-cuotas-panel-vacio">
                {borrador.variable ? "Propón las metas para llenar la tabla por categoría." : "Elige la variable de la cuota."}
              </p>
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
              {problema && borrador.variable ? <small className="mon-cuotas-tenue">{problema}</small> : null}
              <PulsoButton variant="ghost" size="sm" disabled={guardando} onClick={onCerrar}>Cancelar</PulsoButton>
              <PulsoButton variant="primary" size="sm" disabled={ocupado || Boolean(problema)} onClick={onGuardar}>
                {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
                Guardar
              </PulsoButton>
            </span>
          </footer>
        </aside>
      </div>
    </EnPortal>
  );
}
