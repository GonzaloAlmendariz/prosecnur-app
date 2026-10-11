// Panel «¿Qué gráfico?» (`panel=tipo-grafico`; dirección F6 §4.4). La ranura que se llena la nombra el foco
// (`foco=l-07:g2`). Izquierda, las siete familias; centro, los gráficos de la familia con su glifo; derecha, el
// detalle. Usar un gráfico conserva los argumentos compatibles del anterior (`compatibleGraficadorRef`).

import { useId, useMemo, useRef } from "react";
import type { GraficadorMetadata, GraficadorRef, Slide } from "../../../../api/graficos";
import { toast } from "../../../../components/toasterStore";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { useSession } from "../../../../lib/SessionContext";
import { canInsertGraficador, graficadorAvailabilityLabel, graficadorDimensionsReady } from "../../GraficadorPicker";
import { compatibleGraficadorRef } from "../../GraficosLibrariesHost";
import { graficadorDisplayName } from "../../graficadorDisplay";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { esGraficadorRef } from "./cambioTipoLamina";
import { DetalleTipoGrafico } from "./DetalleTipoGrafico";
import { DialogoSelector } from "./DialogoSelector";
import { nombreSlot } from "./etiquetas";
import { PANEL_TIPO_GRAFICO } from "./panelesSelectores";
import { useSelectoresUi } from "./selectoresStore";
import { TarjetaTipoGrafico } from "./TarjetaTipoGrafico";
import { encajeEnRanura, FAMILIAS_GRAFICO, familiaInicial, graficosDeFamilia, salidaDe } from "./tiposGrafico";

type Props = {
  slide: Slide | null;
  posicion: number | null;
  /** Ranura del foco (1-based); sin ella, la primera de la lámina. */
  ranura: number | null;
  /** Cierra el panel en una sola navegación dejando el foco en la ranura. */
  cerrar: (posicion?: number, ranura?: number | null) => void;
};

export function SelectorTipoGrafico({ slide, posicion, ranura, cerrar }: Props) {
  const panel = usePanelDireccionable(PANEL_TIPO_GRAFICO);
  const { registry, graficadoresById, slidesById, loading, error } = useGraficosRegistry();
  const { state, sessionId } = useSession();
  const dimOk = graficadorDimensionsReady(state?.session_id, sessionId, state?.analitica_dim_ok);
  const ui = useSelectoresUi();
  const setSlot = usePlanStore((s) => s.setSlot);
  const undo = usePlanStore((s) => s.undo);
  const grupo = useId();
  const focoInicialRef = useRef<HTMLInputElement>(null);

  const slots = slide ? SLIDE_GRAF_SLOTS[slide.tipo] ?? [] : [];
  const k = ranura && ranura <= slots.length ? ranura : slots.length ? 1 : null;
  const slot = k ? slots[k - 1] : null;
  const valor = slide && slot ? (slide.payload as Record<string, unknown>)[slot] : undefined;
  const actual: GraficadorRef | null = esGraficadorRef(valor) ? valor : null;
  const metaActual = actual ? graficadoresById[actual.graficador] ?? { name: actual.graficador } : null;
  const familia = ui.familia ?? familiaInicial(metaActual, slot);

  const porFamilia = useMemo(() => {
    const todos = registry?.graficadores ?? [];
    return new Map(FAMILIAS_GRAFICO.map((f) => [f.id, graficosDeFamilia(todos, f.id)]));
  }, [registry]);
  const lista = porFamilia.get(familia) ?? [];
  const candidato: GraficadorMetadata | null = (ui.candidatoGrafico ? lista.find((g) => g.name === ui.candidatoGrafico) : undefined)
    ?? (actual ? lista.find((g) => g.name === actual.graficador) : undefined)
    ?? lista[0]
    ?? null;

  const rotuloRanura = k && slot ? `Gráfico ${k} · ${nombreSlot(slot, slide ? slidesById[slide.tipo] : undefined)}` : "";
  const bloqueoDe = (g: GraficadorMetadata): string | null => {
    if (canInsertGraficador(g, dimOk)) return encajeEnRanura(g.name, slot).cabe ? null : "No va en esta ranura";
    return g.disabled_reason?.trim() || graficadorAvailabilityLabel(g, dimOk);
  };

  const cerrarYOlvidar = () => {
    useSelectoresUi.getState().prepararGrafico();
    cerrar(posicion ?? undefined, k);
  };

  const aplicar = (g: GraficadorMetadata | null) => {
    if (!g || !slide || !slot || bloqueoDe(g) || g.name === actual?.graficador) return;
    const id = slide.id;
    setSlot(id, slot, compatibleGraficadorRef(g, actual));
    toast.exito(`${rotuloRanura}: ${graficadorDisplayName(g.name, g)}`, {
      detalle: actual ? `Reemplaza a ${graficadorDisplayName(actual.graficador, graficadoresById[actual.graficador])}; se conservan sus datos compatibles.` : undefined,
      accion: { label: "Deshacer", onSelect: () => undo() },
    });
    cerrarYOlvidar();
  };

  const sinRanura = !slide || !slot;
  const vacio = sinRanura
    ? "Esta lámina no lleva gráficos: elige otra composición en «¿Qué lámina?»."
    : loading && !registry ? "Cargando los gráficos del estudio…"
    : error && !registry ? "No se pudo leer el catálogo de gráficos. Cierra y vuelve a intentarlo."
    : lista.length === 0 ? "Esta familia no tiene gráficos en este estudio."
    : null;

  return (
    <DialogoSelector
      abierto={panel.abierto}
      onCerrar={cerrarYOlvidar}
      panelProps={panel.props}
      auditReady="f6-selector-grafico"
      antetitulo={posicion && rotuloRanura ? `Lámina ${posicion} · ${rotuloRanura}` : posicion ? `Lámina ${posicion}` : "Gráfico"}
      titulo="¿Qué gráfico?"
      descripcion={actual
        ? `Hoy: ${graficadorDisplayName(actual.graficador, graficadoresById[actual.graficador])}. Al cambiarlo se conservan los datos que el nuevo entienda.`
        : "Elige cómo se dibuja la pregunta de esta ranura."}
      focoInicialRef={focoInicialRef}
      pregunta={(
        <fieldset className="pulso-f6-opciones">
          <legend className="pulso-f6-selector-leyenda">Familia</legend>
          {FAMILIAS_GRAFICO.map((f) => {
            const n = porFamilia.get(f.id)?.length ?? 0;
            return (
              <label key={f.id} className="pulso-f6-opcion">
                <input
                  ref={f.id === familia ? focoInicialRef : undefined}
                  type="radio"
                  className="pulso-f6-radio-oculto"
                  name={`${grupo}-familia`}
                  value={f.id}
                  checked={f.id === familia}
                  onChange={() => ui.elegirFamilia(f.id)}
                />
                <strong>{f.label}</strong>
                <span className="pulso-f6-opcion-cuenta">{n}</span>
                <span>{f.descripcion}</span>
              </label>
            );
          })}
        </fieldset>
      )}
      galeria={(
        <section aria-labelledby={`${grupo}-galeria`}>
          <div className="pulso-f6-galeria-cabeza">
            <h3 id={`${grupo}-galeria`}>{FAMILIAS_GRAFICO.find((f) => f.id === familia)?.label}</h3>
            <span>{lista.length} {lista.length === 1 ? "gráfico" : "gráficos"}</span>
          </div>
          {vacio ? (
            <p className="pulso-f6-selector-vacio" data-qa-geometry-capacity="owned">{vacio}</p>
          ) : (
            <ul
              className="pulso-f6-tarjetas is-graficos"
              role="radiogroup"
              aria-labelledby={`${grupo}-galeria`}
              data-qa-geometry-group="graficos/f6-selector-grafico-tarjetas"
              data-qa-geometry-contract="equal"
              data-qa-geometry-capacity="owned"
            >
              {lista.map((g) => (
                <li key={g.name} data-qa-geometry-member>
                  <TarjetaTipoGrafico
                    nombreGrupo={`${grupo}-grafico`}
                    tipo={g.name}
                    nombre={graficadorDisplayName(g.name, g)}
                    descripcion={g.descripcion}
                    salida={salidaDe(g.name)}
                    bloqueo={bloqueoDe(g)}
                    elegida={g.name === candidato?.name}
                    actual={g.name === actual?.graficador}
                    onElegir={() => ui.elegirGrafico(g.name)}
                    onAplicar={() => { if (g.name !== candidato?.name) ui.elegirGrafico(g.name); else aplicar(g); }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      detalle={candidato && !sinRanura ? (
        <DetalleTipoGrafico
          meta={candidato}
          nombre={graficadorDisplayName(candidato.name, candidato)}
          ranura={rotuloRanura ? `«${rotuloRanura}»` : "esta ranura"}
          encaje={encajeEnRanura(candidato.name, slot)}
          bloqueo={canInsertGraficador(candidato, dimOk) ? null : bloqueoDe(candidato)}
          esActual={candidato.name === actual?.graficador}
          onAplicar={() => aplicar(candidato)}
        />
      ) : (
        <p className="pulso-f6-selector-vacio" data-qa-geometry-capacity="owned">
          {sinRanura ? "Sin ranura de gráfico." : "Elige un gráfico para ver qué pide y cómo sale."}
        </p>
      )}
    />
  );
}
