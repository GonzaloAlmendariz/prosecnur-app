import { useId, useState, type CSSProperties, type ReactNode } from "react";
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

import type { MailPreset, MailTemplate } from "../../../api/materialMail";
import { AlertCircle, ChevronRight, GripVertical, Plus, X } from "../../../vendor/lucide-react";
import * as Popover from "@radix-ui/react-popover";

import { BibliotecaDeBloques } from "./BibliotecaDeBloques";
import { esMovible } from "./estructuraCorreo";
import { ICONO_DE_PSEUDO, iconoDeBloque } from "./iconos";
import {
  CABECERA,
  SOBRE,
  origenDePreset,
  resumenDeBloque,
  rotuloDeBloque,
  rotuloDeCabecera,
  textoPlano,
  type ProblemasPorDestino,
} from "./modeloCorreo";
import type { TipoInsertable } from "./piezasGraficas";
import { rotuloDeClave } from "./camposDeclarados";
import "./correosColumna.css";

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
  onAgregar: (type: TipoInsertable) => void;
  onInsertarCampo: (key: string) => void;
  hayDestino: boolean;
  /** Mover un bloque a su índice final (arrastre o teclado en la lista). */
  onMover?: (blockId: string, indice: number) => void;
  /** Nombre de la persona que se mira, para el ejemplo de los campos. */
  ejemploDeNombre?: string;
};


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

/** El resumen de la lista dice «Nombre» donde el texto guarda {{nombre}}: la llave es del motor, no del equipo. */
function conRotulos(resumen: string, campos: readonly { key: string; label: string }[]): string {
  return resumen.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (marca, key: string) => {
    const campo = campos.find((c) => c.key === key);
    // N5: un campo no declarado tampoco muestra su llave.
    return campo ? `«${campo.label}»` : /^[a-z][a-z0-9_]*$/.test(key) ? `«${rotuloDeClave(key)}»` : marca;
  });
}

/** El ejemplo de «Campos de cada persona» con el primer nombre: un nombre largo no estira la columna. */
function primerNombre(nombre: string | undefined): string {
  return (nombre ?? "").trim().split(/\s+/)[0] ?? "";
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
  ejemploDeNombre,
}: Props) {
  const [agregando, setAgregando] = useState(false);
  // #3: con bloques en el correo las plantillas se pliegan (un clic las abre)
  // y la lista de bloques gana el alto. `null`: nadie la tocó todavía.
  const [plantillasAbiertas, setPlantillasAbiertas] = useState<boolean | null>(null);
  const idPlantillas = useId();
  const verPlantillas = plantillasAbiertas ?? (template.blocks.length === 0 || presetPendiente !== null);
  const presetActivo = presets.find((preset) => preset.preset_id === template.preset_id) ?? null;
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
      <div className={`rec-mail-col-grupo rec-mail-col-grupo--plantillas${verPlantillas ? " is-abierto" : ""}`}>
        <button
          type="button"
          className="rec-mail-plegable"
          aria-expanded={verPlantillas}
          aria-controls={idPlantillas}
          onClick={() => setPlantillasAbiertas(!verPlantillas)}
        >
          <span className="xfk-over">Plantillas reales</span>
          {!verPlantillas && presetActivo ? <span className="rec-mail-plegable-resumen" title={presetActivo.title}>{presetActivo.title}</span> : null}
          <ChevronRight size={14} aria-hidden className="rec-mail-plegable-flecha" />
        </button>
        <ul
          id={idPlantillas}
          hidden={!verPlantillas}
          className="rec-mail-presets"
          data-qa-geometry-group={verPlantillas ? "material-campo/correo/plantillas" : undefined}
          data-qa-geometry-contract={verPlantillas ? "equal" : undefined}
        >
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
          {/* La MISMA biblioteca que abre el «+» entre bloques del correo: una sola forma de insertar. */}
          <Popover.Root open={agregando} onOpenChange={setAgregando}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="rec-mail-icono-btn"
                aria-label={agregando ? "Cerrar la biblioteca de bloques" : "Agregar un bloque después del elegido"}
                title={agregando ? "Cerrar" : "Agregar un bloque"}
              >
                {agregando ? <X size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content side="right" align="start" sideOffset={8} collisionPadding={12} className="rec-mail-bib-pop" aria-label="Biblioteca de bloques">
                <BibliotecaDeBloques
                  template={template}
                  titulo="Agregar después del bloque elegido"
                  estilo={{ position: "static", width: "min(560px, calc(100vw - 24px))" }}
                  onElegir={(type) => { onAgregar(type); setAgregando(false); }}
                  onCerrar={() => setAgregando(false)}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </span>
        {/* C1: filas independientes de la lista (cada una con su resumen), alto intrínseco. */}
        <ul
          className="rec-mail-bloques"
          data-qa-geometry-capacity="owned"
          data-qa-geometry-group="material-campo/correo/bloques"
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
            resumen={template.header.kind === "banner" ? "banner" : `${template.header.logo_ids.length} ${template.header.logo_ids.length === 1 ? "logo" : "logos"}`}
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
                  resumen: conRotulos(resumenDeBloque(block), campos),
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
        <span className="rec-mail-ayuda rec-mail-campos-ejemplo" title={`Cambian con cada persona: Nombre dice «${ejemploDeNombre || "Ana"}».`}>
          Cambian con cada persona: Nombre dice «{primerNombre(ejemploDeNombre) || "Ana"}».
          {hayDestino ? " Pulsa uno para ponerlo en el texto." : " Elige un texto del correo para ponerlo ahí."}
        </span>
        <span className="rec-mail-campos" role="group" aria-label="Insertar un campo en el texto elegido">
          {campos.map((campo) => (
            <button
              key={campo.key}
              type="button"
              className="rec-mail-campo"
              title={hayDestino ? `Insertar ${campo.label} en el texto` : `${campo.label}: elige primero un texto del bloque`}
              aria-label={`Insertar el campo ${campo.label}`}
              disabled={!hayDestino}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onInsertarCampo(campo.key)}
            >
              {campo.label}
            </button>
          ))}
        </span>
      </div>
    </aside>
  );
}
