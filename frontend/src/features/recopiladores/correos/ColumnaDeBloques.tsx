import { useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { MAIL_BLOCK_TYPES, type MailPreset, type MailTemplate } from "../../../api/materialMail";
import { AlertCircle, GripVertical, Plus, X } from "../../../vendor/lucide-react";
import { ARRASTRE_DE_BLOQUE } from "./BibliotecaDeBloques";
import { esMovible, tipoDisponible } from "./estructuraCorreo";
import { ICONO_DE_BLOQUE, ICONO_DE_PSEUDO, iconoDeBloque } from "./iconos";
import {
  CABECERA,
  ROTULO_DE_BLOQUE,
  SOBRE,
  origenDePreset,
  resumenDeBloque,
  rotuloDeBloque,
  rotuloDeCabecera,
  textoPlano,
  type ProblemasPorDestino,
} from "./modeloCorreo";
import type { MailBlockType } from "../../../api/materialMail";

type Props = {
  presets: readonly MailPreset[];
  miniaturas: Record<string, string | null>;
  template: MailTemplate;
  seleccion: string;
  problemas: ProblemasPorDestino;
  /** Preset por confirmar: el borrador tiene cambios que se perderían. */
  presetPendiente: string | null;
  onElegirPreset: (preset: MailPreset) => void;
  onConfirmarPreset: () => void;
  onCancelarPreset: () => void;
  onSeleccionar: (id: string) => void;
  onAgregar: (type: MailBlockType) => void;
  onInsertarCampo: (key: string) => void;
  hayDestino: boolean;
  /** Mover un bloque a su índice final (arrastre o teclado en la lista). */
  onMover?: (blockId: string, indice: number) => void;
};

/** Todos los tipos del registro se agregan desde aquí; la imagen abre su panel al elegirla. */
const SE_AGREGAN_AQUI: ReadonlySet<MailBlockType> = new Set(MAIL_BLOCK_TYPES);

function Miniatura({ html, titulo }: { html: string | null | undefined; titulo: string }) {
  if (!html) return <span className="rec-mail-mini rec-mail-mini--vacia" aria-hidden />;
  return (
    <span className="rec-mail-mini" aria-hidden>
      <iframe
        title={`Miniatura de ${titulo}`}
        tabIndex={-1}
        sandbox="allow-same-origin"
        srcDoc={html}
        scrolling="no"
      />
    </span>
  );
}

type PropsDeFila = {
  id: string;
  icono: typeof AlertCircle;
  titulo: string;
  resumen: string;
  elegido: boolean;
  conProblemas: number;
  onSeleccionar: (id: string) => void;
};

/** Fila que se arrastra: la manija es la única que inicia el arrastre (y su teclado). */
function FilaOrdenable(props: PropsDeFila) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });
  const estilo: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  return (
    <Fila
      {...props}
      refDeFila={setNodeRef}
      estilo={estilo}
      arrastrando={isDragging}
      manija={(
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="rec-capa-lista-manija"
          aria-label={`Mover ${props.titulo}`}
          title="Arrastra para mover (o espacio y flechas)"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} aria-hidden />
        </button>
      )}
    />
  );
}

function Fila({
  id,
  icono: Icono,
  titulo,
  resumen,
  elegido,
  conProblemas,
  onSeleccionar,
  manija,
  refDeFila,
  estilo,
  arrastrando,
}: PropsDeFila & {
  manija?: ReactNode;
  refDeFila?: (node: HTMLElement | null) => void;
  estilo?: CSSProperties;
  arrastrando?: boolean;
}) {
  return (
    <li ref={refDeFila} style={estilo} className={`rec-capa-lista-fila${manija ? " is-movible" : ""}${arrastrando ? " is-arrastrando" : ""}`}>
      {manija}
      <button
        type="button"
        className={`rec-mail-bloque${elegido ? " is-active" : ""}`}
        aria-pressed={elegido}
        onClick={() => onSeleccionar(id)}
        data-bloque={id}
      >
        <span className="rec-mail-bloque-icono"><Icono size={13} aria-hidden /></span>
        <span className="rec-mail-bloque-texto">
          <span className="rec-mail-bloque-titulo">{titulo}</span>
          {resumen ? <span className="rec-mail-bloque-resumen">{resumen}</span> : null}
        </span>
        {conProblemas ? (
          <span className="rec-mail-bloque-alerta" title={`${conProblemas} por corregir`}>
            <AlertCircle size={14} aria-hidden />
            <span className="pulso-sr-only">{conProblemas} por corregir</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** Columna izquierda: plantillas reales, bloques del correo y campos de cada persona. */
export function ColumnaDeBloques({
  presets,
  miniaturas,
  template,
  seleccion,
  problemas,
  presetPendiente,
  onElegirPreset,
  onConfirmarPreset,
  onCancelarPreset,
  onSeleccionar,
  onAgregar,
  onInsertarCampo,
  hayDestino,
  onMover,
}: Props) {
  const [agregando, setAgregando] = useState(false);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const movibles = template.blocks.filter((b) => esMovible(template, b.block_id)).map((b) => b.block_id);
  const soltar = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onMover) return;
    const destino = template.blocks.findIndex((b) => b.block_id === over.id);
    if (destino >= 0) onMover(String(active.id), destino);
  };
  const campos = [{ key: "nombre", label: "Nombre" }, ...template.fields.map((f) => ({ key: f.key, label: f.label }))];
  return (
    <aside className="rec-mail-col rec-mail-col--bloques" aria-label="Plantillas y bloques del correo">
      <div className="rec-mail-col-grupo">
        <span className="xfk-over">Plantillas reales</span>
        <ul className="rec-mail-presets" data-qa-geometry-group="material-campo/catalogo/correos-plantillas" data-qa-geometry-contract="equal">
          {presets.map((preset) => {
            const activo = template.preset_id === preset.preset_id;
            const origen = origenDePreset(preset.preset_id);
            return (
              <li key={preset.preset_id}>
                <button
                  type="button"
                  className={`rec-mail-preset${activo ? " is-active" : ""}`}
                  aria-pressed={activo}
                  onClick={() => onElegirPreset(preset)}
                >
                  <Miniatura html={miniaturas[preset.preset_id]} titulo={preset.title} />
                  <span className="rec-mail-preset-texto">
                    <b>{preset.title}</b>
                    {origen ? <span>{origen}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {presetPendiente ? (
          <div className="rec-mail-confirmar" role="alertdialog" aria-label="Cambiar de plantilla">
            <span>Los cambios sin guardar de este correo se pierden.</span>
            <span className="rec-mail-confirmar-acciones">
              <button type="button" className="rec-mail-link" onClick={onConfirmarPreset}>Cambiar igual</button>
              <button type="button" className="rec-mail-link rec-mail-link--quieto" onClick={onCancelarPreset}>Conservar</button>
            </span>
          </div>
        ) : null}
      </div>

      <div className="rec-mail-col-grupo rec-mail-col-grupo--lista">
        <span className="rec-mail-col-titulo">
          <span className="xfk-over">Bloques del correo</span>
          <button
            type="button"
            className="rec-mail-icono-btn"
            aria-expanded={agregando}
            aria-controls="rec-mail-agregar"
            aria-label={agregando ? "Cerrar la lista de bloques" : "Agregar un bloque"}
            title={agregando ? "Cerrar" : "Agregar un bloque"}
            onClick={() => setAgregando((v) => !v)}
          >
            {agregando ? <X size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
          </button>
        </span>
        {agregando ? (
          <div id="rec-mail-agregar" className="rec-mail-agregar" role="group" aria-label="Tipo de bloque a agregar">
            {MAIL_BLOCK_TYPES.filter((t) => SE_AGREGAN_AQUI.has(t) && tipoDisponible(template, t)).map((type) => {
              const Icono = ICONO_DE_BLOQUE[type];
              return (
                <button
                  key={type}
                  type="button"
                  className="rec-mail-agregar-tipo"
                  draggable
                  title="Clic para agregar, o arrástralo al correo"
                  onDragStart={(event) => {
                    event.dataTransfer.setData(ARRASTRE_DE_BLOQUE, type);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => { onAgregar(type); setAgregando(false); }}
                >
                  <Icono size={13} aria-hidden /> {ROTULO_DE_BLOQUE[type]}
                </button>
              );
            })}
          </div>
        ) : null}
        {/* C1: filas independientes de la lista (cada una con su resumen), alto intrínseco. */}
        <ul
          className="rec-mail-bloques"
          data-qa-geometry-capacity="owned"
          data-qa-geometry-group="material-campo/catalogo/correos-bloques"
          data-qa-geometry-contract="intrinsic"
        >
          <Fila
            id={SOBRE}
            icono={ICONO_DE_PSEUDO[SOBRE]}
            titulo="Asunto y vista previa"
            resumen={textoPlano(template.subject)}
            elegido={seleccion === SOBRE}
            conProblemas={problemas.sobre.length}
            onSeleccionar={onSeleccionar}
          />
          <Fila
            id={CABECERA}
            icono={ICONO_DE_PSEUDO[CABECERA]}
            titulo={rotuloDeCabecera(template.header)}
            resumen={template.header.kind === "banner" ? "1200 × 600" : `${template.header.logo_ids.length} ${template.header.logo_ids.length === 1 ? "logo" : "logos"}`}
            elegido={seleccion === CABECERA}
            conProblemas={problemas.cabecera.length}
            onSeleccionar={onSeleccionar}
          />
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
            <SortableContext items={movibles} strategy={verticalListSortingStrategy}>
              {template.blocks.map((block) => {
                const props: PropsDeFila = {
                  id: block.block_id,
                  icono: iconoDeBloque(block),
                  titulo: rotuloDeBloque(block),
                  resumen: resumenDeBloque(block),
                  elegido: seleccion === block.block_id,
                  conProblemas: problemas.porBloque[block.block_id]?.length ?? 0,
                  onSeleccionar,
                };
                // El pie queda fijo al final, como lo dibuja el render.
                return onMover && esMovible(template, block.block_id)
                  ? <FilaOrdenable key={block.block_id} {...props} />
                  : <Fila key={block.block_id} {...props} />;
              })}
            </SortableContext>
          </DndContext>
        </ul>
      </div>

      <div className="rec-mail-col-grupo rec-mail-col-grupo--campos">
        <span className="xfk-over">Campos de cada persona</span>
        <span className="rec-mail-campos" role="group" aria-label="Insertar un campo en el texto elegido">
          {campos.map((campo) => (
            <button
              key={campo.key}
              type="button"
              className="rec-mail-campo"
              title={hayDestino ? `Insertar {{${campo.key}}}` : `${campo.label}: elige primero un texto del bloque`}
              aria-label={`Insertar el campo ${campo.label}`}
              disabled={!hayDestino}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onInsertarCampo(campo.key)}
            >
              {`{{${campo.key}}}`}
            </button>
          ))}
        </span>
      </div>
    </aside>
  );
}
