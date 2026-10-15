// Biblioteca de líneas visuales (ID3 del rediseño, 2026-10-14; decisiones D3 y D7). Dos grupos: «Del recetario» (los
// perfiles del motor; no se editan) y «Tus líneas» (guardadas en la app, para todos los estudios). Cada tarjeta dice qué
// trae y se aplica con un clic: aplicar copia sus valores al plan (`applyPptStyleProfile`), así el `.pulso` sigue
// portable aunque la línea propia se borre después. La línea aplicada se reconoce por su `profile_id`.

import { useEffect } from "react";
import type { PptStyleProfileMeta } from "../../../api/graficos";
import type { LineaVisualPropia } from "../../../api/graficosLineasVisuales";
import { lineaVisualAplicada } from "../estiloInforme/modeloEstiloInforme";
import { usePlanStore } from "../store";
import { usePptStyleProfiles } from "../usePptStyleProfiles";
import { Check, Sparkles } from "../../../vendor/lucide-react";
import { useLineasPropias } from "./lineasPropiasStore";

/** Lo que trae una línea, en palabras: cuántas bases de gráfico, paletas y estilos guardados. */
export function queTrae(perfil: Pick<PptStyleProfileMeta, "presets" | "paletas" | "overrides_reusables">): string {
  const n = (k: number, uno: string, varios: string) => (k ? `${k} ${k === 1 ? uno : varios}` : "");
  return [
    n(Object.keys(perfil.presets ?? {}).length, "base de gráfico", "bases de gráfico"),
    n(Object.keys(perfil.paletas ?? {}).length, "paleta", "paletas"),
    n(perfil.overrides_reusables?.length ?? 0, "estilo guardado", "estilos guardados"),
  ].filter(Boolean).join(" · ") || "Sin ajustes";
}

const idDe = (p: PptStyleProfileMeta) => lineaVisualAplicada(p.scope_rules ?? {}) ?? p.name;

function TarjetaLinea({ perfil, aplicada, onAplicar }: { perfil: PptStyleProfileMeta; aplicada: boolean; onAplicar: () => void }) {
  return (
    <article className={`pulso-f6-lv-tarjeta${aplicada ? " is-aplicada" : ""}`} data-qa-geometry-member>
      <span className="pulso-f6-lv-colores" aria-hidden="true">
        {(perfil.preview_colors ?? []).slice(0, 6).map((c, i) => <i key={`${c}-${i}`} style={{ background: c }} />)}
      </span>
      <span className="pulso-f6-lv-nombre">{perfil.titulo_humano}</span>
      {perfil.descripcion ? <span className="pulso-f6-lv-desc">{perfil.descripcion}</span> : null}
      <span className="pulso-f6-lv-trae">{queTrae(perfil)}</span>
      <button type="button" className={`pulso-f6-lv-aplicar${aplicada ? " is-aplicada" : ""}`} aria-pressed={aplicada}
        onClick={onAplicar} disabled={aplicada} aria-label={aplicada ? `${perfil.titulo_humano}: línea activa` : `Aplicar la línea ${perfil.titulo_humano}`}>
        {aplicada ? <Check size={13} aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}
        {aplicada ? "Línea activa" : "Aplicar"}
      </button>
    </article>
  );
}

export function BibliotecaLineas() {
  const { profiles, loading, error } = usePptStyleProfiles();
  const propias = useLineasPropias((s) => s.lineas);
  const cargadas = useLineasPropias((s) => s.cargadas);
  const errorPropias = useLineasPropias((s) => s.error);
  const aplicar = usePlanStore((s) => s.applyPptStyleProfile);
  const aplicadaId = usePlanStore((s) => lineaVisualAplicada(s.scopeRules));

  useEffect(() => {
    if (!useLineasPropias.getState().cargadas) void useLineasPropias.getState().cargar();
  }, []);

  return (
    <div className="pulso-f6-lv">
      <section className="pulso-f6-lv-grupo" aria-labelledby="f6-lv-recetario">
        <h4 id="f6-lv-recetario" className="pulso-f6-lv-grupo-titulo">Del recetario <small>se aplican tal cual; para cambiarlas, guarda una propia</small></h4>
        {loading ? <p className="pulso-f6-lv-estado" role="status">Cargando las líneas del recetario…</p>
          : error ? <p className="pulso-f6-lv-estado is-error" role="alert">No se pudieron cargar: {error}</p>
          : (
            <div className="pulso-f6-lv-lista" data-qa-geometry-group="graficos/f6-lv-recetario" data-qa-geometry-contract="equal">
              {profiles.map((p) => <TarjetaLinea key={p.name} perfil={p} aplicada={aplicadaId === idDe(p)} onAplicar={() => aplicar(p)} />)}
            </div>
          )}
      </section>
      <section className="pulso-f6-lv-grupo" aria-labelledby="f6-lv-propias">
        <h4 id="f6-lv-propias" className="pulso-f6-lv-grupo-titulo">Tus líneas <small>guardadas en la app, para todos los estudios</small></h4>
        {!cargadas ? <p className="pulso-f6-lv-estado" role="status">Cargando tus líneas…</p>
          : errorPropias ? <p className="pulso-f6-lv-estado is-error" role="alert">{errorPropias}</p>
          : propias.length === 0 ? (
            <p className="pulso-f6-lv-estado">Todavía no guardaste líneas. «Guardar como línea nueva» parte de lo que tienes ahora.</p>
          ) : (
            <div className="pulso-f6-lv-lista" data-qa-geometry-group="graficos/f6-lv-propias" data-qa-geometry-contract="equal">
              {propias.map((l: LineaVisualPropia) => <TarjetaLinea key={l.id} perfil={l} aplicada={aplicadaId === l.id} onAplicar={() => aplicar(l)} />)}
            </div>
          )}
      </section>
    </div>
  );
}
