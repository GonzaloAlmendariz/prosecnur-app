// Panel «Tipo de gráfico» (`panel=tipo-grafico`; dirección F6 §4.4). La ranura que se llena la nombra el foco
// (`foco=<slide.id>:g2`). Izquierda, las familias; centro, los tipos de gráfico de la familia con su glifo, también las
// variantes del catálogo (ADR 0139: «Contraste de públicos» es `p_dumbbell` en estilo resumen); derecha, el detalle.
// Usar un gráfico conserva los argumentos compatibles del anterior (`compatibleGraficadorRef`) y, si es una variante,
// escribe sus args fijos. Un tipo que no se puede usar aquí no se esconde: su tarjeta dice por qué en una línea.

import { BarChart3, MousePointer2 } from "../../../../vendor/lucide-react";
import { useId, useMemo, useRef } from "react";
import type { GraficadorRef, Slide } from "../../../../api/graficos";
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
import { destinoAlCerrarEnDocumento } from "./focoAlCerrar";
import { nombreSlot } from "./etiquetas";
import { PANEL_TIPO_GRAFICO } from "./panelesSelectores";
import { useSelectoresUi } from "./selectoresStore";
import { TarjetaTipoGrafico } from "./TarjetaTipoGrafico";
import {
  encajeEnRanura, entradasDeFamilia, FAMILIAS_GRAFICO, familiaInicial, familiasVisibles, familiaVisible, graficoDeEntrada, salidaDe,
  type EntradaGrafico,
} from "./tiposGrafico";
import { entradaDeGrafico, nombreDeEntrada } from "../../catalogoGraficos";
import { esTipoRetirado } from "../../retirados";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { formatoConteo } from "../../../../lib/formatoNumero";

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
  // ADR 0137: un tipo retirado no abre en su familia (puede haber desaparecido) y, al cambiarlo, sus datos no pasan.
  const actualRetirado = !!actual && esTipoRetirado(actual.graficador, registry);

  // La entrada del catálogo que la ranura ya es: su variante (contraste, aperturas, escala) o su graficador.
  const entradaActual = actual ? entradaDeGrafico(actual.graficador, actual.args ?? {}) : null;
  const porFamilia = useMemo(() => {
    const todos = registry?.graficadores ?? [];
    return new Map(FAMILIAS_GRAFICO.map((f) => [f.id, entradasDeFamilia(todos, f.id)]));
  }, [registry]);
  const familias = familiasVisibles(porFamilia, !!registry);
  const familia = familiaVisible(ui.familia ?? familiaInicial(actualRetirado ? null : metaActual, slot), familias);
  const lista = porFamilia.get(familia) ?? [];
  const candidato: EntradaGrafico | null = (ui.candidatoGrafico ? lista.find((e) => e.id === ui.candidatoGrafico) : undefined)
    ?? (entradaActual ? lista.find((e) => e.id === entradaActual) : undefined)
    ?? lista[0]
    ?? null;

  // H6: en una lámina de varios gráficos la ranura se nombra por su lugar («espacio «Derecha»»), como en los avisos.
  const rotuloRanura = k && slot
    ? slots.length > 1 ? `espacio «${nombreSlot(slot, slide ? slidesById[slide.tipo] : undefined)}»` : "gráfico"
    : "";
  // ADR 0139, ítem 6: el motivo en una línea; la tarjeta no se esconde ni se apaga en silencio.
  const bloqueoDe = ({ meta: g }: EntradaGrafico): string | null => {
    if (canInsertGraficador(g, dimOk)) {
      const encaje = encajeEnRanura(g.name, slot);
      return encaje.cabe ? null : encaje.corto ?? encaje.nota ?? "No va en esta ranura";
    }
    return g.disabled_reason?.trim() || graficadorAvailabilityLabel(g, dimOk);
  };
  const nombreDe = (e: EntradaGrafico): string => (e.variante ? nombreDeEntrada(e.id) : graficadorDisplayName(e.meta.name, e.meta));
  const nombreActual = actual
    ? entradaActual && entradaActual !== actual.graficador
      ? nombreDeEntrada(entradaActual)
      : graficadorDisplayName(actual.graficador, graficadoresById[actual.graficador])
    : "";

  const cerrarYOlvidar = () => {
    useSelectoresUi.getState().prepararGrafico();
    cerrar(posicion ?? undefined, k);
  };

  const aplicar = (e: EntradaGrafico | null) => {
    if (!e || !slide || !slot || bloqueoDe(e) || e.id === entradaActual) return;
    const id = slide.id;
    setSlot(id, slot, graficoDeEntrada(e, compatibleGraficadorRef(e.meta, actualRetirado ? null : actual)));
    toast.exito(`${rotuloRanura.charAt(0).toUpperCase()}${rotuloRanura.slice(1)}: ${nombreDe(e)}`, {
      detalle: actual
        ? `Reemplaza a ${nombreActual}; ${actualRetirado ? "sus datos no pasan al nuevo tipo" : "se conservan sus datos compatibles"}.`
        : undefined,
      accion: { label: "Deshacer", onSelect: () => undo() },
    });
    cerrarYOlvidar();
  };

  const sinRanura = !slide || !slot;
  const vacio = sinRanura
    ? "Esta lámina no lleva gráficos: elige otra composición en Tipo de lámina."
    : loading && !registry ? "cargando"
    : error && !registry ? "No se pudo leer el catálogo de gráficos. Cierra y vuelve a intentarlo."
    : lista.length === 0 ? "Esta familia no tiene gráficos en este estudio."
    : null;

  return (
    <DialogoSelector
      abierto={panel.abierto}
      onCerrar={cerrarYOlvidar}
      panelProps={panel.props}
      auditReady="f6-selector-grafico"
      antetitulo={posicion && rotuloRanura && slots.length > 1 ? `Lámina ${posicion}, ${rotuloRanura}` : posicion ? `Lámina ${posicion}` : "Gráfico"}
      titulo="Tipo de gráfico"
      descripcion={actual
        ? actualRetirado
          ? `Hoy: ${nombreActual}, un tipo retirado. Al cambiarlo se empieza sin sus datos.`
          : `Hoy: ${nombreActual}. Al cambiarlo se conservan los datos que el nuevo entienda.`
        : "Elige cómo se dibuja la pregunta de esta ranura."}
      focoInicialRef={focoInicialRef}
      destinoAlCerrar={() => destinoAlCerrarEnDocumento(k)}
      pregunta={(
        <fieldset className="pulso-f6-opciones">
          <legend className="pulso-f6-selector-leyenda">Familia</legend>
          {familias.map((f) => {
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
            <span>{formatoConteo(lista.length)} {lista.length === 1 ? "gráfico" : "gráficos"}</span>
          </div>
          {vacio ? (
            loading && !registry
              ? <CargaDeBloque label="Cargando los gráficos del estudio…" />
              : <EstadoVacio icono={<BarChart3 size={16} aria-hidden="true" />} titulo={vacio} />
          ) : (
            <ul
              className="pulso-f6-tarjetas is-graficos"
              role="radiogroup"
              aria-labelledby={`${grupo}-galeria`}
              data-qa-geometry-group="graficos/f6-selector-grafico-tarjetas"
              data-qa-geometry-contract="equal"
              data-qa-geometry-capacity="owned"
            >
              {lista.map((e) => (
                <li key={e.id} data-qa-geometry-member>
                  <TarjetaTipoGrafico
                    nombreGrupo={`${grupo}-grafico`}
                    entrada={e.id}
                    tipo={e.meta.name}
                    nombre={nombreDe(e)}
                    descripcion={e.descripcion}
                    salida={salidaDe(e.meta.name)}
                    bloqueo={bloqueoDe(e)}
                    elegida={e.id === candidato?.id}
                    actual={e.id === entradaActual}
                    onElegir={() => ui.elegirGrafico(e.id)}
                    onAplicar={() => { if (e.id !== candidato?.id) ui.elegirGrafico(e.id); else aplicar(e); }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      detalle={candidato && !sinRanura ? (
        <DetalleTipoGrafico
          meta={candidato.meta}
          nombre={nombreDe(candidato)}
          descripcion={candidato.descripcion}
          tipoBase={candidato.variante ? graficadorDisplayName(candidato.meta.name, candidato.meta) : null}
          ranura={rotuloRanura && slots.length > 1 ? `el ${rotuloRanura}` : "esta ranura"}
          encaje={encajeEnRanura(candidato.meta.name, slot)}
          bloqueo={canInsertGraficador(candidato.meta, dimOk) ? null : bloqueoDe(candidato)}
          esActual={candidato.id === entradaActual}
          onAplicar={() => aplicar(candidato)}
        />
      ) : (
        <EstadoVacio
          icono={<MousePointer2 size={16} aria-hidden="true" />}
          titulo={sinRanura ? "Sin ranura de gráfico" : "Elige un gráfico para ver qué pide y cómo sale"}
        />
      )}
    />
  );
}
