// Un margen del censo dentro de "Metas del CPV 2025": qué variable de la base
// le corresponde y a qué categoría del censo va cada categoría de esa variable.
// Lo que queda sin meta se avisa.

import type { ValorColumna, VariableInstrumento } from "../../../api/client";
import type { CpvMargen } from "../../../api/ponderacionCpv2025";
import { Alert } from "../../../components/Alert";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { avisosDelMapeo, metasDesdeMapeo, sugerirMapeo, type Mapeo } from "../panes/metasCpvModel";

const SIN_META = "__sin_meta__";

export function MargenCpv({ margen, categoricas, asignado, categoriasBase, enUso, onAsignar, onAplicar }: {
  margen: CpvMargen;
  categoricas: VariableInstrumento[];
  asignado: { var: string; mapeo: Mapeo };
  categoriasBase: ValorColumna[];
  enUso: boolean;
  onAsignar: (a: { var: string; mapeo: Mapeo }) => void;
  onAplicar: () => void;
}) {
  const base = categoriasBase.map((c) => ({ value: c.value, label: c.label || c.value }));
  // Sin mapeo guardado se propone el de rótulos iguales; editarlo lo fija.
  const mapeo = Object.keys(asignado.mapeo).length ? asignado.mapeo : sugerirMapeo(base, margen);
  const r = asignado.var && base.length ? metasDesdeMapeo(base, margen, mapeo) : null;
  const avisos = r ? avisosDelMapeo(r, base, margen) : [];
  const elegir = (valor: string, cpv: string) => {
    const next = { ...mapeo };
    if (cpv) next[valor] = [cpv]; else delete next[valor];
    onAsignar({ var: asignado.var, mapeo: next });
  };
  return (
    <Panel variant="subtle" className="pond-cpv-margen" aria-label={`Margen ${margen.etiqueta}`}>
      <div className="pond-cpv-margen-head">
        <strong className="pond-cpv-titulo">{margen.etiqueta}</strong>
        <small>{formatoConteoDe(margen.categorias.length, "categoría")}</small>
        <PulsoSelect size="sm" value={asignado.var || undefined} placeholder="Variable de la base"
          onValueChange={(v) => onAsignar({ var: v, mapeo: {} })}
          ariaLabel={`Variable de la base para ${margen.etiqueta}`}
          options={categoricas.map((v) => ({ value: v.name, label: v.name }))} />
        <PulsoButton variant={enUso ? "secondary" : "primary"} size="sm" disabled={!r || !Object.keys(r.targets).length} onClick={onAplicar}
          title="Las metas pasan al margen como población censada">
          {enUso ? "Actualizar metas" : "Usar como metas"}
        </PulsoButton>
      </div>
      {asignado.var && !base.length ? <p className="pond-copy">Leyendo las categorías de {asignado.var}</p> : null}
      {r && (
        <div className="pond-cpv-mapeo">
          {base.map((c) => (
            <div key={c.value} className="pond-cpv-mapeo-fila">
              <span className="pond-cpv-mapeo-base">{c.label}</span>
              <PulsoSelect size="sm" value={mapeo[c.value]?.[0] ?? SIN_META}
                onValueChange={(v) => elegir(c.value, v === SIN_META ? "" : v)}
                ariaLabel={`Categoría del censo para ${c.label}`}
                options={[{ value: SIN_META, label: "Sin meta" }, ...margen.categorias.map((k) => ({ value: k.codigo, label: k.etiqueta }))]} />
              <span className="pond-num">{formatoConteo(r.targets[c.value])}</span>
            </div>
          ))}
        </div>
      )}
      {avisos.map((a, i) => (
        <Alert key={i} kind="warn">{a.message}</Alert>
      ))}
    </Panel>
  );
}
