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
import { Check, Copy, Pencil, Plus, Sparkles, Trash2 } from "../../../vendor/lucide-react";
import { DialogoLinea } from "./DialogoLinea";
import { cambiosSobreLinea, diferencias, estiloDesdeHuella, huellaPlan, lineaDesdePlan, type PlanParaLinea } from "./modeloLineaPropia";
import { PulsoButton } from "../../../components/PulsoButton";
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

/** La forma que espera `restaurarEstilo` (la huella guarda los ajustes guardados como `unknown[]`). */
type EstiloRestaurable = Parameters<ReturnType<typeof usePlanStore.getState>["restaurarEstilo"]>[0];

const planActual = (): PlanParaLinea => {
  const p = usePlanStore.getState();
  return { presets: p.presets, paletas: p.paletas, overridesReusables: p.overridesReusables, scopeRules: p.scopeRules };
};

/** ID3d: aplica una línea propia y toma la huella del plan, contra la que después se detectan los cambios. */
export function aplicarPropia(linea: LineaVisualPropia) {
  usePlanStore.getState().applyPptStyleProfile(linea);
  useLineasPropias.getState().setHuella({ id: linea.id, valor: huellaPlan(planActual(), linea.incluye) });
}

type AccionesTarjeta = { onEditar?: () => void; onDuplicar: () => void; onEliminar?: () => void };

function TarjetaLinea({ perfil, aplicada, onAplicar, acciones }: { perfil: PptStyleProfileMeta; aplicada: boolean; onAplicar: () => void; acciones: AccionesTarjeta }) {
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
      {/* ID3c: lo que se hace con la línea. Las del recetario sólo se duplican como propias. */}
      <span className="pulso-f6-lv-acciones">
        {acciones.onEditar && <PulsoButton variant="icon" size="sm" onClick={acciones.onEditar} aria-label={`Editar ${perfil.titulo_humano}`} title="Editar"><Pencil size={14} aria-hidden="true" /></PulsoButton>}
        <PulsoButton variant="icon" size="sm" onClick={acciones.onDuplicar} aria-label={`Duplicar ${perfil.titulo_humano} como línea propia`} title="Duplicar como propia"><Copy size={14} aria-hidden="true" /></PulsoButton>
        {acciones.onEliminar && <PulsoButton variant="icon" size="sm" className="pulso-f6-lv-eliminar" onClick={acciones.onEliminar} aria-label={`Eliminar ${perfil.titulo_humano}`} title="Eliminar"><Trash2 size={14} aria-hidden="true" /></PulsoButton>}
      </span>
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
  const editar = useLineasPropias((s) => s.setEdicion);
  const guardar = useLineasPropias((s) => s.guardar);
  const quitar = usePlanStore((s) => s.quitarPptStyleProfile);
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const overridesReusables = usePlanStore((s) => s.overridesReusables);
  const scopeRules = usePlanStore((s) => s.scopeRules);
  // ID3d: con una línea PROPIA aplicada, ¿el plan cambió algo de lo que ella pone?
  const propiaAplicada = propias.find((l) => l.id === aplicadaId) ?? null;
  const plan = { presets, paletas, overridesReusables, scopeRules };
  const huella = useLineasPropias((s) => s.huella);
  // Con huella (tomada al aplicar en esta sesión) se ven también los ajustes nuevos; sin ella, los valores de la línea.
  const cambios = !propiaAplicada ? 0
    : huella?.id === propiaAplicada.id ? diferencias(huellaPlan(plan, propiaAplicada.incluye), huella.valor)
      : cambiosSobreLinea(plan, propiaAplicada);

  useEffect(() => {
    if (!useLineasPropias.getState().cargadas) void useLineasPropias.getState().cargar();
  }, []);

  return (
    <div className="pulso-f6-lv">
      {propiaAplicada && cambios > 0 && (
        <div className="pulso-f6-lv-banda" role="status">
          <span>Cambiaste {cambios === 1 ? "un valor" : `${cambios} valores`} de «{propiaAplicada.titulo_humano}».</span>
          <span className="pulso-f6-lv-banda-acciones">
            <PulsoButton variant="primary" size="sm" onClick={() => void guardar(propiaAplicada.id, lineaDesdePlan(plan, {
              titulo: propiaAplicada.titulo_humano, descripcion: propiaAplicada.descripcion,
              colores: propiaAplicada.incluye.colores, graficos: propiaAplicada.incluye.portada,
            })).then((l) => useLineasPropias.getState().setHuella({ id: l.id, valor: huellaPlan(planActual(), l.incluye) }))}>Guardar en la línea</PulsoButton>
            <PulsoButton variant="secondary" size="sm" onClick={() => editar({ modo: "nueva" })}>Guardar como nueva</PulsoButton>
            <PulsoButton variant="ghost" size="sm" onClick={() => {
              // Con huella, el plan vuelve a como quedó al aplicar (también se van los ajustes nuevos); sin ella, se
              // vuelven a poner los valores de la línea.
              if (huella?.id === propiaAplicada.id) usePlanStore.getState().restaurarEstilo(estiloDesdeHuella(huella.valor, propiaAplicada.id) as EstiloRestaurable);
              else { quitar(propiaAplicada); aplicarPropia(propiaAplicada); }
            }}>Descartar cambios</PulsoButton>
          </span>
        </div>
      )}
      <div className="pulso-f6-lv-barra">
        <PulsoButton variant="secondary" size="sm" onClick={() => editar({ modo: "nueva" })}>
          <Plus size={14} aria-hidden="true" />
          Guardar como línea nueva
        </PulsoButton>
      </div>
      <section className="pulso-f6-lv-grupo" aria-labelledby="f6-lv-recetario">
        <h4 id="f6-lv-recetario" className="pulso-f6-lv-grupo-titulo">Del recetario <small>se aplican tal cual; para cambiarlas, guarda una propia</small></h4>
        {loading ? <p className="pulso-f6-lv-estado" role="status">Cargando las líneas del recetario…</p>
          : error ? <p className="pulso-f6-lv-estado is-error" role="alert">No se pudieron cargar: {error}</p>
          : (
            <div className="pulso-f6-lv-lista" data-qa-geometry-group="graficos/f6-lv-recetario" data-qa-geometry-contract="equal">
              {profiles.map((p) => <TarjetaLinea key={p.name} perfil={p} aplicada={aplicadaId === idDe(p)} onAplicar={() => aplicar(p)} acciones={{ onDuplicar: () => editar({ modo: "duplicar", base: p }) }} />)}
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
              {propias.map((l: LineaVisualPropia) => (
                <TarjetaLinea key={l.id} perfil={l} aplicada={aplicadaId === l.id} onAplicar={() => aplicarPropia(l)} acciones={{
                  onEditar: () => editar({ modo: "editar", linea: l }),
                  onDuplicar: () => editar({ modo: "duplicar", base: l }),
                  onEliminar: () => editar({ modo: "eliminar", linea: l }),
                }} />
              ))}
            </div>
          )}
      </section>
      <DialogoLinea />
    </div>
  );
}
