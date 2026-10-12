// Columna derecha de la pestaña Láminas (F6.1; dirección F6 §4.1 «Inspector»). Cuatro secciones fijas con tabs
// reales: Contenido (abre por defecto, decisión provisional §10) · Composición · Gráficos · Estado. Lo que esta parte
// no construye se declara como tal («todavía no está en Láminas»), sin mandar al Editor anterior (C32/O3).
// «Cambiar» (cabecera y Composición) abre «¿Qué lámina?»; «Cambiar» de una ranura, «¿Qué gráfico?» (F6.2).

import { useId, useMemo } from "react";
import { ChevronRight, History, Lock, X } from "../../../vendor/lucide-react";
import type { GraficadorRef, Slide } from "../../../api/graficos";
import { GlidingTabList } from "../../../components/GlidingTabList";
import { Switch } from "../../../components/Switch";
import { EditorIndice } from "../indice/EditorIndice";
import { ARGS_FIJADOS_INDICE } from "../indice/fijadosIndiceModel";
import { useVariables } from "../useVariables";
import { ContenidoEspecialLamina } from "./contenidoEspecial/ContenidoEspecialLamina";
import { contenidoEspecialDe, esArgEspecial, tituloPorDefecto } from "./contenidoEspecial/modeloContenidoEspecial";
import { DatosGrafico } from "./DatosGrafico";
import { SeccionComposicion } from "./SeccionComposicion";
import { nombreSlot } from "./selectores/etiquetas";
import { graficadorDisplayName } from "../graficadorDisplay";
import { conSlideMeta, leerSlideMeta } from "../slideMeta";
import { IconoTipo } from "../iconos/IconoTipo";
import { firstVariableRefFromGraph } from "../slideAutoTitle";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import { contenidoDeLamina } from "./contenidoLamina";
import { ETIQUETA_ESTADO, estadoDeLamina, motivoDeEstado, type LaminaVisor } from "./estadoLamina";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { useLaminasUi, type SeccionInspector } from "./laminasStore";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import "./inspectorLamina.css";

// Tres pestañas con una sola función cada una (Gonzalo, I11): la lámina (tipo, composición y textos), un gráfico a la vez
// y la revisión de cómo sale. «composicion» sigue siendo una clave válida (direcciones viejas) y abre «Lámina».
const SECCIONES: { key: SeccionInspector; label: string }[] = [
  { key: "contenido", label: "Lámina" },
  { key: "graficos", label: "Gráfico" },
  { key: "estado", label: "Revisión" },
];

/** Rótulos y ayudas de los textos de la lámina, en el idioma del usuario (el registro trae «slide» y «disclaimer»). */
const TEXTOS_CAMPO: Record<string, { label: string; descripcion: string }> = {
  titulo: { label: "Título", descripcion: "Va arriba de la lámina." },
  subtitulo: { label: "Subtítulo", descripcion: "Línea bajo el título." },
  base: { label: "Base", descripcion: "Vacía, sale la base automática." },
  pie: { label: "Nota al pie", descripcion: "Fuente u otra aclaración al pie de la lámina." },
};

// Los capítulos e íconos tienen su editor; los ajustes del dibujo de los focos, su candado (decisión 32).
const ARGS_DEL_INDICE = new Set<string>(["secciones", "subtemas", "subindices", "iconos_focos", ...ARGS_FIJADOS_INDICE]);

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
  const seccion = useLaminasUi((s) => s.seccionInspector);
  const setSeccion = useLaminasUi((s) => s.setSeccionInspector);
  const baseId = useId();
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const estado = visor ? estadoDeLamina(visor) : null;
  const avisos = visor?.avisos.length ?? 0;

  const tabId = (k: SeccionInspector) => `${baseId}-tab-${k}`;
  const panelId = (k: SeccionInspector) => `${baseId}-panel-${k}`;

  return (
    <aside id="pulso-f6-inspector" className="pulso-f6-inspector" aria-label="Ajustes de la lámina">
      <header className="pulso-f6-inspector-tipo">
        <span className="pulso-f6-inspector-icono">
          <IconoTipo clase="lamina" tipo={slide.tipo} size={24} className="pulso-icono-tipo--acento" />
        </span>
        <span className="pulso-f6-inspector-tipo-texto">
          <strong id="pulso-f6-inspector-titulo">{lamina.tipoLabel}</strong>
          <span>
            {slots.length > 0
              ? `${slots.length} ${slots.length === 1 ? "gráfico" : "gráficos"} · lámina ${lamina.posicion}`
              : `Lámina ${lamina.posicion}`}
          </span>
        </span>
        <button type="button" className="pulso-f6-boton pulso-f6-inspector-cambiar" onClick={onCambiarLamina} aria-label={`Cambiar el tipo de la lámina ${lamina.posicion}`}>
          Cambiar
        </button>
        <button type="button" className="pulso-f6-icono-boton" aria-label="Ocultar los ajustes" title="Ocultar los ajustes: la lámina gana su ancho" onClick={onCerrar}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <GlidingTabList activeKey={seccion === "composicion" ? "contenido" : seccion} className="pulso-f6-inspector-tabs" role="tablist" aria-label="Secciones de la lámina">
        {SECCIONES.map(({ key, label }) => (
          <button
            key={key}
            id={tabId(key)}
            type="button"
            role="tab"
            data-gliding-key={key}
            aria-selected={seccion === key || (key === "contenido" && seccion === "composicion")}
            aria-controls={panelId(key)}
            tabIndex={seccion === key ? 0 : -1}
            className={`pulso-f6-inspector-tab${seccion === key || (key === "contenido" && seccion === "composicion") ? " is-activa" : ""}`}
            onClick={() => setSeccion(key)}
          >
            {label}
            {key === "estado" && (estado === "ruta_anterior" || avisos > 0) && (
              <span className="pulso-f6-marca-aviso" aria-label={estado === "ruta_anterior" ? "sale como imagen" : `${avisos} avisos`} />
            )}
          </button>
        ))}
      </GlidingTabList>

      <div
        className="pulso-f6-inspector-cuerpo"
        role="tabpanel"
        id={panelId(seccion)}
        aria-labelledby={tabId(seccion)}
        tabIndex={0}
      >
        {(seccion === "contenido" || seccion === "composicion") && (
          <>
            <SeccionContenido slide={slide} lamina={lamina} />
            <h3 className="pulso-f6-subtitulo pulso-f6-inspector-apartado">Composición</h3>
            <SeccionComposicion slide={slide} lamina={lamina} ranura={ranura} onCambiarLamina={onCambiarLamina} />
          </>
        )}
        {seccion === "graficos" && (
          <SeccionGraficos slide={slide} slots={slots} ranura={ranura} onRanura={onRanura} onCambiarGrafico={onCambiarGrafico} />
        )}
        {seccion === "estado" && <SeccionEstado slide={slide} visor={visor} />}
      </div>
    </aside>
  );
}

function SeccionContenido({ slide, lamina }: { slide: Slide; lamina: LaminaEnEstructura }) {
  // Campos de texto de alto propio (una línea, varias líneas, con o sin ayuda): grupo intrínseco.
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const { slidesById } = useGraficosRegistry();
  const meta = leerSlideMeta(slide);
  const esIndice = slide.tipo === "p_slide_indice";
  const { variables } = useVariables();
  const argsDelTipo = slidesById[slide.tipo]?.args;
  // Los capítulos, subcapítulos e íconos del índice tienen su editor (A5 rebanada 2b), y las filas de la ficha técnica y
  // el ícono subido, el suyo (C38): no son campos de texto sueltos.
  const { contenido, especial } = useMemo(() => {
    const args = (argsDelTipo ?? []).filter((a) => !(esIndice && ARGS_DEL_INDICE.has(a.name)));
    return {
      contenido: contenidoDeLamina(args.filter((a) => !esArgEspecial(a)), SLIDE_GRAF_SLOTS[slide.tipo] ?? []),
      especial: contenidoEspecialDe(args),
    };
  }, [argsDelTipo, slide.tipo, esIndice]);
  const payload = slide.payload as Record<string, unknown>;
  // C35: sin título escrito sale el nombre de la pregunta del gráfico, como en el editor anterior y en el motor.
  const titulo = tituloPorDefecto(slide, variables, lamina.tipoLabel);
  const idAnte = useId();

  return (
    <div className="pulso-f6-pila" data-qa-geometry-group="graficos/f6-contenido-campos" data-qa-geometry-contract="intrinsic">
      {slide.tipo !== "p_slide_seccion" ? (
        <div className="pulso-f6-campo">
          <label htmlFor={idAnte}>Antetítulo</label>
          <input
            id={idAnte}
            data-campo="antetitulo"
            className="pulso-f6-input"
            value={meta.antetitulo ?? ""}
            placeholder={lamina.antetituloHeredado ?? "Sin antetítulo"}
            onChange={(e) => updatePayload(slide.id, { meta: conSlideMeta(slide, { antetitulo: e.target.value }).payload.meta })}
          />
          <span className="pulso-f6-ayuda">
            {lamina.antetituloHeredado
              ? `Vacío, hereda «${lamina.antetituloHeredado}» del separador.`
              : "Ningún separador lo precede: sin texto, la lámina sale sin antetítulo."}
          </span>
        </div>
      ) : (
        <p className="pulso-f6-candado">
          <Lock size={14} aria-hidden="true" />
          Este separador abre un capítulo: su título es el antetítulo de las láminas que le siguen.
        </p>
      )}

      {contenido.campos.map((c) => (
        <CampoTexto
          key={c.name}
          campo={{ ...c, ...(TEXTOS_CAMPO[c.name] ?? {}) }}
          valor={typeof payload[c.name] === "string" ? (payload[c.name] as string) : ""}
          placeholder={c.name === "titulo" ? titulo.placeholder : ""}
          ayuda={c.name === "titulo" ? titulo.ayuda : null}
          onCambio={(v) => updatePayload(slide.id, { [c.name]: v })}
        />
      ))}

      <ContenidoEspecialLamina slide={slide} especial={especial} />

      {esIndice && <EditorIndice slide={slide} />}

      {contenido.pendientes.length > 0 && (
        <p className="pulso-f6-pendiente">
          <History size={14} aria-hidden="true" />
          <span>
            {contenido.pendientes.join(" · ")}: este ajuste todavía no está en Láminas.
          </span>
        </p>
      )}
    </div>
  );
}

function CampoTexto({ campo, valor, placeholder, ayuda = null, onCambio }: {
  campo: { name: string; label: string; multilinea: boolean; descripcion: string };
  valor: string;
  placeholder: string;
  /** Ayuda que no viene del registro (qué sale si queda vacío). */
  ayuda?: string | null;
  onCambio: (v: string) => void;
}) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const textoAyuda = [campo.descripcion, ayuda].filter((t): t is string => !!t).join(" ");
  return (
    <div className="pulso-f6-campo">
      <label htmlFor={id}>{campo.label}</label>
      {campo.multilinea ? (
        <textarea id={id} data-campo={campo.name} className="pulso-f6-input" rows={3} value={valor} placeholder={placeholder}
          aria-describedby={textoAyuda ? idAyuda : undefined} onChange={(e) => onCambio(e.target.value)} />
      ) : (
        <input id={id} data-campo={campo.name} className="pulso-f6-input" value={valor} placeholder={placeholder}
          aria-describedby={textoAyuda ? idAyuda : undefined} onChange={(e) => onCambio(e.target.value)} />
      )}
      {textoAyuda && <span id={idAyuda} className="pulso-f6-ayuda">{textoAyuda}</span>}
    </div>
  );
}

function SeccionGraficos({ slide, slots, ranura, onRanura, onCambiarGrafico }: {
  slide: Slide;
  slots: string[];
  ranura: number | null;
  onRanura: (r: number | null) => void;
  onCambiarGrafico: (k: number) => void;
}) {
  const { graficadoresById, slidesById } = useGraficosRegistry();
  const { irA } = useSeccion("procesamiento");
  if (slots.length === 0) {
    return (
      <p className="pulso-f6-vacio-col">Esta lámina no lleva gráficos: su contenido se edita en Contenido.</p>
    );
  }
  const payload = slide.payload as Record<string, unknown>;
  // Un gráfico a la vez: el elegido en la maqueta o con el selector; los demás no se apilan debajo.
  const activo = ranura !== null && ranura >= 1 && ranura <= slots.length ? ranura : 1;
  return (
    <div className="pulso-f6-pila" data-qa-geometry-group="graficos/f6-graficos" data-qa-geometry-contract="intrinsic">
      {slots.length > 1 && (
        <div className="pulso-f6-selector-grafico" role="tablist" aria-label="Gráfico de la lámina">
          {slots.map((slot, i) => {
            const v = payload[slot] as GraficadorRef | undefined;
            return (
              <button key={slot} type="button" role="tab" aria-selected={activo === i + 1}
                className={`pulso-f6-selector-grafico-opcion${activo === i + 1 ? " is-activa" : ""}`} onClick={() => onRanura(i + 1)}>
                {v?.graficador ? <IconoTipo clase="grafico" tipo={v.graficador} size={16} /> : null}
                Gráfico {i + 1}
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
          const nombre = tecnico ? graficadorDisplayName(tecnico, graficadoresById[tecnico]) : "Sin gráfico";
          const abierta = true;
          const rotulo = `Gráfico ${k}${slots.length > 1 ? `, ${nombreSlot(slot, slidesById[slide.tipo]).toLowerCase()}` : ""}`;
          return (
            <li key={slot} className={`pulso-f6-ranura${abierta ? " is-abierta" : ""}`}>
              <div className="pulso-f6-ranura-fila">
                {/* El selector de arriba ya dice qué gráfico es: la cabecera sólo dice su tipo (y dónde va, si hay varios). */}
                <div className="pulso-f6-ranura-cabeza" aria-label={rotulo}>
                  {tecnico && <IconoTipo clase="grafico" tipo={tecnico} size={20} />}
                  <span className="pulso-f6-ranura-texto">
                    <strong>{nombre}</strong>
                    {slots.length > 1 && <span>{nombreSlot(slot, slidesById[slide.tipo])}</span>}
                  </span>
                </div>
                {abierta && (
                  <button
                    type="button"
                    className="pulso-f6-boton pulso-f6-ranura-cambiar"
                    aria-label={`${tecnico ? "Cambiar" : "Elegir"} el ${rotulo.toLowerCase()}`}
                    onClick={() => onCambiarGrafico(k)}
                  >
                    {tecnico ? "Cambiar" : "Elegir"}
                  </button>
                )}
              </div>
              {abierta && tecnico && valor && (
                <div className="pulso-f6-ranura-cuerpo-datos">
                  <DatosGrafico slideId={slide.id} slot={slot} valor={valor} />
                </div>
              )}
              {abierta && !tecnico && (
                <p className="pulso-f6-vacio-col">Esta ranura está vacía: elige el gráfico que va aquí.</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SeccionEstado({ slide, visor }: { slide: Slide; visor: LaminaVisor | null }) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const apagado = leerSlideMeta(slide).motor_nativo === false;
  const estado = visor ? estadoDeLamina(visor) : null;
  const idRuta = useId();
  return (
    <div className="pulso-f6-pila" data-qa-geometry-group="graficos/f6-estado" data-qa-geometry-contract="intrinsic">
      {estado === "ruta_anterior" && (
        <div className="pulso-f6-tarjeta is-ruta">
          <div>
            <strong>Sale como imagen</strong>
            <p>{motivoDeEstado(estado, apagado, (visor?.avisos.length ?? 0) > 0)}</p>
          </div>
        </div>
      )}
      {visor && visor.partes.length > 1 && (
        <ul className="pulso-f6-lista-partes">
          {visor.partes.map((p) => (
            <li key={p.indice}>
              Parte {p.indice}{p.continuacion ? " (cont.)" : ""}: {p.estado ? ETIQUETA_ESTADO[p.estado] : "sin dato"}
            </li>
          ))}
        </ul>
      )}
      <section aria-label="Avisos">
        <h3 className="pulso-f6-subtitulo">Avisos</h3>
        {visor && visor.avisos.length > 0 ? (
          <ul className="pulso-f6-avisos">
            {visor.avisos.map((a) => <li key={a}>{a}</li>)}
          </ul>
        ) : (
          <p className="pulso-f6-ayuda">{visor ? "Sin avisos." : "Aparecen al generar la vista."}</p>
        )}
      </section>
      <div className="pulso-f6-fila-switch">
        <span id={idRuta}>
          <strong>Insertar el gráfico como imagen</strong>
          <span className="pulso-f6-ayuda">Deja de ser editable en PowerPoint.</span>
        </span>
        <Switch
          checked={apagado}
          ariaLabel="Insertar el gráfico como imagen en esta lámina"
          onToggle={() => updatePayload(slide.id, { meta: conSlideMeta(slide, { motor_nativo: apagado ? undefined : false }).payload.meta })}
        />
      </div>
    </div>
  );
}
