// Columna derecha de la pestaña Láminas (F6.1; dirección F6 §4.1 «Inspector»). Cuatro secciones fijas con tabs
// reales: Contenido (abre por defecto, decisión provisional §10) · Composición · Gráficos · Estado. Lo que esta parte
// no construye se declara como tal («todavía no está en Láminas»), sin mandar al Editor anterior (C32/O3).
// «Cambiar lámina» (cabecera) abre «¿Qué lámina?»; «Cambiar» de una ranura, «¿Qué gráfico?» (F6.2). El rótulo de la
// cabecera (acabado W2-A) separa las dos acciones, que antes decían las dos «Cambiar».

import { useId } from "react";
import { BarChart3, FileText } from "../../../vendor/lucide-react";
import type { GraficadorRef, Slide } from "../../../api/graficos";
import { GlidingTabList } from "../../../components/GlidingTabList";
import { CabeceraPanel } from "../../../components/CabeceraPanel";
import { PulsoButton } from "../../../components/PulsoButton";
import { avisoDentroDeLamina } from "./avisoEnLamina";
import { faltaEnLamina } from "./faltaLamina";
import { DatosGrafico } from "./DatosGrafico";
import { AvisosLamina } from "./AvisosLamina";
import { PestanaLamina } from "./tarjetaLamina/PestanaLamina";
import { rolDeEstructura } from "./rolEstructura";
import { nombreSlot } from "./selectores/etiquetas";
import { graficadorDisplayName } from "../graficadorDisplay";
import { conSlideMeta, leerSlideMeta } from "../slideMeta";
import { IconoTipo } from "../iconos/IconoTipo";
import { GlifoGrafico } from "../iconos/GlifoGrafico";
import { presentacionDeGrafico, ROTULO_CLASE } from "./selectores/intencionesContar";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import { usePlanValidator } from "../usePlanValidator";
import { estadoDeLamina, motivoDeEstado, type LaminaVisor } from "./estadoLamina";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { useLaminasUi, type SeccionInspector } from "./laminasStore";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import "./inspectorLamina.css";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { formatoConteo } from "../../../lib/formatoNumero";
import { toast } from "../../../components/toasterStore";
import { fichaRetirado, reemplazoDirecto } from "../retirados";
import { RanuraRetirada } from "./retirados/RanuraRetirada";

// G14 (Gonzalo, 2026-10-13): dos pestañas, cada una con una función: «Lámina» (qué es, su composición y sus textos en el
// orden en que salen) y «Gráfico» (un gráfico a la vez). La lámina de estructura no tiene «Gráfico». «Revisión» se quitó
// («no entiendo el propósito»): los avisos de la lámina van en una franja arriba y «sale como imagen» dentro de «Gráfico».
// «composicion» y «estado» siguen siendo claves válidas de direcciones viejas: abren «Lámina» y «Gráfico».
const SECCIONES: { key: SeccionInspector; label: string }[] = [
  { key: "contenido", label: "Lámina" },
  { key: "graficos", label: "Gráfico" },
];

type Props = {
  slide: Slide;
  lamina: LaminaEnEstructura;
  /** Ranura seleccionada (1-based) desde `foco=<slide.id>:gK`. */
  ranura: number | null;
  onRanura: (ranura: number | null) => void;
  visor: LaminaVisor | null;
  onCerrar: () => void;
  /** Ya no se usa en el Inspector (C32/O3: sus textos no mandan al Editor anterior); queda por compatibilidad. */
  onIrEditorAnterior?: () => void;
  /** Abre «¿Qué lámina?» para cambiar el tipo de esta lámina. */
  onCambiarLamina: () => void;
  /** Abre «¿Qué gráfico?» para la ranura k (1-based). */
  onCambiarGrafico: (k: number) => void;
};

export function InspectorLamina({
  slide, lamina, ranura, onRanura, visor, onCerrar, onCambiarLamina, onCambiarGrafico,
}: Props) {
  const seccionGuardada = useLaminasUi((s) => s.seccionInspector);
  const setSeccion = useLaminasUi((s) => s.setSeccionInspector);
  const baseId = useId();
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const conGraficos = slots.length > 0;
  const seccion: SeccionInspector = conGraficos && (seccionGuardada === "graficos" || seccionGuardada === "estado") ? "graficos" : "contenido";
  const { issues } = usePlanValidator();
  // Dentro de la lámina, sin repetir «Lámina N · “título”» ni el mismo aviso dos veces (U4 de CCSS: cuatro casi iguales).
  // H12: dentro de la lámina, sin su rótulo «Lámina N · “…”» ni punto medio (avisoEnLamina.ts).
  const avisos = [...new Set([...issues.filter((i) => i.slideId === slide.id).map((i) => i.detalle ?? i.message), ...(visor?.avisos ?? [])].map(avisoDentroDeLamina))];

  const tabId = (k: SeccionInspector) => `${baseId}-tab-${k}`;
  const panelId = (k: SeccionInspector) => `${baseId}-panel-${k}`;

  return (
    <aside id="pulso-f6-inspector" className="pulso-f6-inspector" aria-label="Ajustes de la lámina">
      {/* Acabado W2-A: la cabecera de toda superficie con X es CabeceraPanel. «Cambiar lámina» se distingue del «Cambiar»
          del gráfico por su rótulo; la X cierra el panel y devuelve el foco a «Ajustes» (useSideoverModal). */}
      <CabeceraPanel
        className="pulso-f6-inspector-cabecera"
        tituloId="pulso-f6-inspector-titulo"
        titulo={`Lámina ${lamina.posicion}: ${lamina.tipoLabel}`}
        subtitulo={conGraficos ? (lamina.antetituloHeredado ? `Capítulo: ${lamina.antetituloHeredado}` : "Sin capítulo") : rolDeEstructura(slide.tipo)}
        icono={<IconoTipo clase="lamina" tipo={slide.tipo} size={16} />}
        acciones={(
          <PulsoButton variant="secondary" size="sm" className="pulso-f6-inspector-cambiar" onClick={onCambiarLamina}
            aria-label={`Cambiar el tipo de la lámina ${lamina.posicion}`}>
            Cambiar lámina
          </PulsoButton>
        )}
        onCerrar={onCerrar}
        etiquetaCerrar="Cerrar ajustes"
      />

      {/* H4: los avisos, plegados en un chip que se despliega. */}
      <AvisosLamina avisos={avisos} />

      {conGraficos && (
        <GlidingTabList activeKey={seccion} className="pulso-f6-inspector-tabs" role="tablist" aria-label="Secciones de la lámina">
          {SECCIONES.map(({ key, label }) => (
            <button
              key={key}
              id={tabId(key)}
              type="button"
              role="tab"
              data-gliding-key={key}
              aria-selected={seccion === key}
              aria-controls={panelId(key)}
              tabIndex={seccion === key ? 0 : -1}
              className={`pulso-f6-inspector-tab${seccion === key ? " is-activa" : ""}`}
              onClick={() => setSeccion(key)}
            >
              {label}
            </button>
          ))}
        </GlidingTabList>
      )}

      <div
        className="pulso-f6-inspector-cuerpo"
        // R8-5 (C1): el cuerpo del inspector es el grupo de sus tarjetas (salida, gráficos, secciones con sus .pulso-f6-dato):
        // secciones independientes que crecen con lo suyo. Cada sección plegable declara además su cuerpo (f6-grupo-cuerpo).
        data-qa-geometry-group="graficos/f6-inspector-cuerpo"
        data-qa-geometry-contract="intrinsic"
        role={conGraficos ? "tabpanel" : undefined}
        id={panelId(seccion)}
        aria-labelledby={conGraficos ? tabId(seccion) : undefined}
        tabIndex={0}
      >
        {/* H4: en secciones plegables con índice, como la tarjeta del gráfico. */}
        {seccion === "contenido" && <PestanaLamina slide={slide} lamina={lamina} ranura={ranura} onCambiarLamina={onCambiarLamina} />}
        {seccion === "graficos" && (
          <>
            <SalidaDelGrafico slide={slide} visor={visor} />
            <SeccionGraficos slide={slide} slots={slots} ranura={ranura} onRanura={onRanura} onCambiarGrafico={onCambiarGrafico} />
          </>
        )}
      </div>
    </aside>
  );
}

function SeccionGraficos({ slide, slots, ranura, onRanura, onCambiarGrafico }: {
  slide: Slide;
  slots: string[];
  ranura: number | null;
  onRanura: (r: number | null) => void;
  onCambiarGrafico: (k: number) => void;
}) {
  const { registry, graficadoresById, slidesById } = useGraficosRegistry();
  const setSlot = usePlanStore((s) => s.setSlot);
  const undo = usePlanStore((s) => s.undo);
  const { irA } = useSeccion("procesamiento");
  if (slots.length === 0) {
    return (
      <EstadoVacio
        icono={<FileText size={16} aria-hidden="true" />}
        titulo="Esta lámina no lleva gráficos"
        descripcion="Su contenido se edita en la pestaña Lámina."
      />
    );
  }
  const payload = slide.payload as Record<string, unknown>;
  // Un gráfico a la vez: el elegido en la maqueta o con el selector; los demás no se apilan debajo.
  const activo = ranura !== null && ranura >= 1 && ranura <= slots.length ? ranura : 1;
  return (
    <div className="pulso-f6-pila" data-qa-geometry-group="graficos/f6-graficos" data-qa-geometry-contract="intrinsic">
      {slots.length > 1 && (
        <div className="pulso-f6-selector-grafico" role="tablist" aria-label="Gráfico de la lámina"
          data-qa-geometry-group="graficos/f6-selector-grafico" data-qa-geometry-contract="equal" data-gliding-opt-out="Elige cuál de los gráficos de la lámina se edita (1 a 4 chips con el ícono de su tipo); no es el recorrido del módulo y la opción activa se marca con su propio fondo.">
          {slots.map((slot, i) => {
            const v = payload[slot] as GraficadorRef | undefined;
            return (
              <button key={slot} type="button" role="tab" aria-selected={activo === i + 1} data-gliding-opt-out="Chip del selector de gráfico de la lámina; ver su tablist."
                className={`pulso-f6-selector-grafico-opcion${activo === i + 1 ? " is-activa" : ""}`} onClick={() => onRanura(i + 1)}>
                {v?.graficador ? <IconoTipo clase="grafico" tipo={v.graficador} size={16} /> : null}
                {/* H6: el lugar en la lámina («Izquierda», «Derecha»), como en los avisos («Espacio «Derecha»»). */}
                {nombreSlot(slot, slidesById[slide.tipo])}
              </button>
            );
          })}
        </div>
      )}
      <ul className="pulso-f6-ranuras" data-qa-geometry-group="graficos/f6-ranuras" data-qa-geometry-contract="intrinsic">
        {slots.map((slot, i) => {
          const k = i + 1;
          if (k !== activo) return null;
          const valor = payload[slot] as GraficadorRef | undefined;
          const tecnico = valor?.graficador ?? "";
          // ADR 0137: un tipo retirado se nombra con su ficha y no abre su tarjeta de datos.
          const retirado = tecnico ? fichaRetirado(tecnico, registry) : null;
          // ADR 0135 §1: el inspector dice la clase de lo que hay en la ranura y lo nombra como su tarjeta.
          const presentacion = tecnico && !retirado ? presentacionDeGrafico(tecnico, (valor?.args ?? {}) as Record<string, unknown>) : null;
          const nombre = retirado ? retirado.titulo_humano
            : tecnico ? presentacion?.nombre ?? graficadorDisplayName(tecnico, graficadoresById[tecnico]) : "Sin gráfico";
          const abierta = true;
          const rotulo = slots.length > 1 ? `gráfico (${nombreSlot(slot, slidesById[slide.tipo]).toLowerCase()})` : "gráfico";
          return (
            <li key={slot} className={`pulso-f6-ranura${abierta ? " is-abierta" : ""}`}>
              <div className="pulso-f6-ranura-fila">
                {/* El selector de arriba ya dice dónde va: la cabecera sólo dice su tipo. */}
                <div className="pulso-f6-ranura-cabeza" aria-label={`${rotulo.charAt(0).toUpperCase()}${rotulo.slice(1)}`}>
                  {tecnico && (
                    <span className="pulso-f6-ranura-miniatura"><GlifoGrafico tipo={tecnico} /></span>
                  )}
                  <span className="pulso-f6-ranura-texto">
                    <strong>{nombre}</strong>
                    {presentacion && (
                      <span className="pulso-f6-ranura-clase" data-clase-tarjeta={presentacion.clase}>{ROTULO_CLASE[presentacion.clase]}</span>
                    )}
                  </span>
                </div>
                {abierta && (
                  <PulsoButton
                    variant="secondary"
                    size="sm"
                    className="pulso-f6-ranura-cambiar"
                    aria-label={`${tecnico ? "Cambiar" : "Elegir"} el ${rotulo.toLowerCase()}`}
                    onClick={() => onCambiarGrafico(k)}
                  >
                    {tecnico ? "Cambiar" : "Elegir"}
                  </PulsoButton>
                )}
              </div>
              {abierta && retirado && (
                <RanuraRetirada id={`${slide.id}-${slot}-retirado`} ficha={retirado} reemplazo={reemplazoDirecto(retirado, graficadoresById)}
                  onCambiarPor={(graficador) => {
                    // Cambiar descarta los args del tipo retirado (ADR 0137): el nuevo empieza en blanco.
                    setSlot(slide.id, slot, { graficador, args: {} });
                    toast.exito(`${rotulo.charAt(0).toUpperCase()}${rotulo.slice(1)}: ${graficadorDisplayName(graficador, graficadoresById[graficador])}`, {
                      detalle: `Reemplaza a "${retirado.titulo_humano}"; sus datos no pasan al nuevo tipo.`,
                      accion: { label: "Deshacer", onSelect: () => undo() },
                    });
                  }} />
              )}
              {abierta && tecnico && valor && !retirado && (
                <div className="pulso-f6-ranura-cuerpo-datos">
                  <DatosGrafico slideId={slide.id} slot={slot} valor={valor} />
                </div>
              )}
              {abierta && !tecnico && (
                <EstadoVacio
                  icono={<BarChart3 size={16} aria-hidden="true" />}
                  titulo="Esta ranura está vacía"
                  descripcion="Elige el gráfico que va aquí."
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Sólo cuando el gráfico NO sale editable: dice por qué y, si fue una elección guardada en un plan viejo
 * (`meta.motor_nativo = FALSE`), ofrece volver al editable. Ya no se ofrece pasar a imagen (G14: «el motor ya lo hace mejor»).
 */
function SalidaDelGrafico({ slide, visor }: { slide: Slide; visor: LaminaVisor | null }) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const apagado = leerSlideMeta(slide).motor_nativo === false;
  // Q4-2: mientras falte un dato obligatorio (la pregunta que divide, los grupos) no se sabe cómo sale.
  const estado = visor && !faltaEnLamina(slide) ? estadoDeLamina(visor) : null;
  if (!apagado && estado !== "ruta_anterior" && !(estado && visor && visor.partes.length > 1)) return null;
  return (
    <div className="pulso-f6-pila" data-qa-geometry-group="graficos/f6-salida" data-qa-geometry-contract="intrinsic">
      {(estado === "ruta_anterior" || apagado) && (
        <div className="pulso-f6-tarjeta is-ruta">
          <div>
            <strong>Sale como imagen</strong>
            <p>{motivoDeEstado(estado ?? "ruta_anterior", apagado, (visor?.avisos.length ?? 0) > 0)}</p>
            {apagado && (
              <PulsoButton variant="secondary" size="sm"
                onClick={() => updatePayload(slide.id, { meta: conSlideMeta(slide, { motor_nativo: undefined }).payload.meta })}>
                Volver a editable
              </PulsoButton>
            )}
          </div>
        </div>
      )}
      {estado && visor && visor.partes.length > 1 && (
        <p className="pulso-f6-ayuda-texto">
          Sale en {formatoConteo(visor.partes.length)} láminas: {visor.partes.map((p) => `${p.indice}${p.continuacion ? " (cont.)" : ""}`).join(", ")}.
        </p>
      )}
    </div>
  );
}
