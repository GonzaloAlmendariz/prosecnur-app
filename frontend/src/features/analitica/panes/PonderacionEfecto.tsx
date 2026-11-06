// Efecto de la ponderación sobre la muestra: márgenes antes y después, deff de
// Kish y n efectivo (antes y después del recorte), casos imputados por variable
// y los avisos del motor con su causa. Un error declarado del backend (peso
// base inválido, imputación sobre el umbral, expansión sin total) se muestra
// tal cual: es lo que el analista debe corregir.

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "../../../vendor/lucide-react";
import type { PonderPreview } from "../../../api/client";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { formatoConteo } from "../../../lib/formatoNumero";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const dec = (x: number | null | undefined) => (x != null && Number.isFinite(x) ? x.toFixed(2) : "—");
const ent = (x: number | null | undefined) => (x != null && Number.isFinite(x) ? formatoConteo(x) : "—");

export function PonderacionEfecto({ preview, labelOf }: {
  preview: PonderPreview | null;
  labelOf: (name: string) => string;
}) {
  const [varElegida, setVarElegida] = useState<string>("");
  if (preview && !preview.ok && preview.message) {
    return (
      <div className="pond-card pond-diagnostico">
        <div className="pond-aviso is-warn" role="alert" data-pond-error={preview.reason}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{preview.message}</span>
        </div>
      </div>
    );
  }
  const sinEfecto = preview?.ok && !preview.rake_applied && !preview.design_applied;
  if (!preview?.ok || sinEfecto) {
    return (
      <div className="pond-card pond-diagnostico">
        <div className="pond-copy">Configura al menos una variable con metas para ver el efecto.</div>
      </div>
    );
  }
  const d = preview.diagnostics;
  const vars = Object.keys(preview.margins ?? {});
  const v = vars.includes(varElegida) ? varElegida : vars[0];
  const rows = v ? preview.margins![v] : [];
  const max = Math.max(0.4, ...rows.flatMap((r) => [r.muestra, r.ponderado, r.objetivo]));
  const rec = preview.recorte ?? null;
  const imp = preview.imputacion?.variables ?? {};
  const imputadas = Object.entries(imp).filter(([, x]) => x.imputados > 0 || x.sin_donante > 0);
  const loss = d && Number.isFinite(d.loss_pct) ? Math.round(d.loss_pct) : null;

  return (
    <div className="pond-card pond-diagnostico">
      {v && (
        <>
          <div className="pond-diagnostico-cabeza">
            <span className="pond-title pond-diagnostico-titulo">Antes y después</span>
            {vars.length > 1 && (
              <PulsoSelect size="sm" value={v} onValueChange={setVarElegida} ariaLabel="Margen a mostrar"
                options={vars.map((x) => ({ value: x, label: labelOf(x) }))} />
            )}
          </div>
          {rows.map((r) => (
            <div key={r.categoria} className="pond-barra-fila">
              <span className="pond-barra-categoria">{r.categoria}</span>
              <div className="pond-barra-pista">
                {/* El ancho de cada barra es el dato: es lo único que va en línea. */}
                <div className="pond-barra is-muestra" style={{ width: `${(r.muestra / max) * 100}%` }} />
                <div className="pond-barra is-ponderado" style={{ width: `${(r.ponderado / max) * 100}%` }} />
                <div className="pond-barra-objetivo" style={{ left: `${(r.objetivo / max) * 100}%` }} />
              </div>
              <span className="pond-barra-valores">{pct(r.muestra)} → {pct(r.ponderado)}</span>
            </div>
          ))}
          <div className="pond-leyenda">
            <Legend tono="muestra" text="tu muestra" />
            <Legend tono="ponderado" text="ponderado" />
            <Legend tono="objetivo" text="meta" />
          </div>
        </>
      )}

      <div className="pond-stats" data-qa-geometry-group="analitica/ponderacion-stats" data-qa-geometry-contract="equal">
        <StatCard label="n efectivo"
          title="(Σw)² / Σw²: cuántos casos sin ponderar equivalen en precisión."
          value={<>{rec ? <>{ent(rec.antes.n_eff)} → </> : null}{ent(d?.n_eff)} <span className="pond-stat-de">de {ent(d?.n)}</span></>} />
        <StatCard label="deff de Kish" title="1 + CV² de los pesos."
          value={<>{rec ? <>{dec(rec.antes.deff)} → </> : null}{dec(d?.deff)}</>} />
        <StatCard label="precisión que cedes" value={loss != null ? `${loss}%` : "—"} tone={loss != null && loss >= 25 ? "warn" : undefined} />
        {preview.escala === "expansion" && (
          <StatCard label="Σ pesos (N̂)" value={ent(preview.total_poblacion)} />
        )}
      </div>

      {rec && (
        <p className="pond-copy pond-recorte-resumen"
          title={`Tolerancia de margen ${(rec.tol_margen * 100).toFixed(1)} puntos.`}>
          Recorte a {rec.cap}×: peso mayor {dec(rec.antes.max_sobre_media)} → {dec(rec.despues.max_sobre_media)} veces la media
          {rec.modo === "recalibrar"
            ? `, ${rec.ciclos} ciclos de recalibración${rec.convergio ? "" : " sin conciliar"}`
            : ", sin recalibrar"}; desvío máximo de margen {(rec.max_desvio_margen * 100).toFixed(2)} puntos.
        </p>
      )}

      {imputadas.length > 0 && (
        <div className="pond-imputados" aria-label="Casos imputados por variable">
          {imputadas.map(([nombre, x]) => (
            <span key={nombre} className="pond-imputado"
              title={`${(x.pct * 100).toFixed(1)} % sin dato. Semilla ${preview.imputacion?.semilla}.${x.sin_donante ? ` ${x.sin_donante} sin donante.` : ""}`}>
              <strong>{labelOf(nombre)}</strong> {formatoConteo(x.imputados)} imputados
            </span>
          ))}
        </div>
      )}

      {(preview.warnings ?? []).map((w, i) => (
        <div key={i} className={`pond-aviso${w.level === "warn" ? " is-warn" : " is-info"}`} data-pond-aviso={w.code}>
          {w.level === "warn" ? <AlertTriangle size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}
          <span>{w.message}</span>
        </div>
      ))}

      <div className="pond-pie">
        <CheckCircle2 size={13} aria-hidden="true" />
        Se aplica a frecuencias, cruces y dimensiones, y queda en la ficha técnica.
      </div>
    </div>
  );
}

function StatCard({ label, value, tone, title }: { label: string; value: React.ReactNode; tone?: "warn"; title?: string }) {
  return (
    <div className={`pond-stat${tone === "warn" ? " is-warn" : ""}`} title={title}>
      <div className="pond-stat-label">{label}</div>
      <div className="pond-stat-valor">{value}</div>
    </div>
  );
}

function Legend({ tono, text }: { tono: "muestra" | "ponderado" | "objetivo"; text: string }) {
  return (
    <span className="pond-leyenda-item">
      <span className={`pond-leyenda-marca is-${tono}`} aria-hidden="true" />{text}
    </span>
  );
}
