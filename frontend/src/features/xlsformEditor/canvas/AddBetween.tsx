// =============================================================================
// canvas/AddBetween.tsx — botón "+" entre cards para agregar pregunta o sección
// =============================================================================
// Pequeña pill que aparece en hover entre dos cards del lienzo. Click abre
// un menú flotante con opciones: pregunta de texto, selección única,
// número, fecha, sección, etc. Para preguntas de selección, hay un
// segundo paso que ofrece reusar una lista existente o crear una nueva.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { MaquetaTipo } from "../kit";
import {
  Plus,
  Type as TypeIcon,
  CircleDot,
  ListChecks,
  Hash,
  Calendar as CalendarIcon,
  MessageSquare,
  Calculator,
  FolderPlus,
  FolderMinus,
  ChevronLeft,
  ImagePlus,
  Mic,
  Video,
  File,
  QrCode,
  MapPin,
} from "lucide-react";

export type AddBetweenKind =
  | "section"
  | "section_end"
  | "text"
  | "select_one"
  | "select_multiple"
  | "integer"
  | "decimal"
  | "date"
  | "image"
  | "audio"
  | "video"
  | "file"
  | "barcode"
  | "geopoint"
  | "note"
  | "calculate";

export type ExistingList = {
  listName: string;
  choicesCount: number;
  /** Cuántas preguntas la usan (para mostrar "ya usado en N preguntas"). */
  usageCount: number;
};

export type AddBetweenProps = {
  /** Llamado al elegir un tipo. `reuseListName` solo aplica para
   *  select_one/select_multiple — si está, la pregunta nueva queda
   *  vinculada a esa lista existente en lugar de crear una. */
  onAdd: (kind: AddBetweenKind, reuseListName?: string) => void;
  /** Listas existentes que el usuario puede reusar al crear un select.
   *  Si está vacío, el flujo de "reusar lista" se omite. */
  existingLists?: ExistingList[];
  /** Si true, se renderiza siempre visible (no solo en hover). Útil al
   *  final del scroll donde no hay siguiente card. */
  alwaysVisible?: boolean;
  /** Variante de estilo. */
  variant?: "between" | "trailing";
};

const TYPES: Array<{
  kind: AddBetweenKind;
  label: string;
  icon: typeof TypeIcon;
  hint: string;
  group: "capture" | "choices" | "evidence" | "logic";
}> = [
  { kind: "text", label: "Texto", icon: TypeIcon, hint: "Respuesta escrita libre", group: "capture" },
  { kind: "integer", label: "Número entero", icon: Hash, hint: "Edad, cantidad o puntaje", group: "capture" },
  { kind: "decimal", label: "Número decimal", icon: Hash, hint: "Monto, proporción o medida", group: "capture" },
  { kind: "date", label: "Fecha", icon: CalendarIcon, hint: "Día, mes y año", group: "capture" },
  { kind: "select_one", label: "Selección única", icon: CircleDot, hint: "Una opción de una lista", group: "choices" },
  { kind: "select_multiple", label: "Selección múltiple", icon: ListChecks, hint: "Varias opciones de una lista", group: "choices" },
  { kind: "image", label: "Foto o imagen", icon: ImagePlus, hint: "Foto desde la cámara o la galería", group: "evidence" },
  { kind: "audio", label: "Audio", icon: Mic, hint: "Grabación de voz", group: "evidence" },
  { kind: "video", label: "Video", icon: Video, hint: "Clip de video", group: "evidence" },
  { kind: "file", label: "Archivo", icon: File, hint: "Documento adjunto", group: "evidence" },
  { kind: "barcode", label: "Código de barras", icon: QrCode, hint: "Escaneo de código o QR", group: "evidence" },
  { kind: "geopoint", label: "Punto GPS", icon: MapPin, hint: "Coordenadas GPS", group: "evidence" },
  { kind: "note", label: "Nota informativa", icon: MessageSquare, hint: "Texto visible sin respuesta", group: "logic" },
  { kind: "calculate", label: "Campo automático", icon: Calculator, hint: "Valor calculado con una fórmula", group: "logic" },
  { kind: "section", label: "Sección", icon: FolderPlus, hint: "Grupo de preguntas con inicio y cierre", group: "logic" },
  { kind: "section_end", label: "Cerrar sección", icon: FolderMinus, hint: "Termina una sección en este punto", group: "logic" },
];

const GROUPS: Array<{ id: (typeof TYPES)[number]["group"]; label: string }> = [
  { id: "capture", label: "Texto y captura" },
  { id: "choices", label: "Con opciones" },
  { id: "evidence", label: "Evidencia y ubicación" },
  { id: "logic", label: "Estructura y lógica" },
];

type Stage =
  | { kind: "type" }
  | { kind: "list-pick"; selectKind: "select_one" | "select_multiple" };

export function AddBetween({
  onAdd,
  existingLists = [],
  alwaysVisible,
  variant = "between",
}: AddBetweenProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "type" });
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setStage({ kind: "type" });
      return;
    }
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const handleTypeClick = (kind: AddBetweenKind) => {
    // Para selects: si hay listas existentes, abrimos el sub-paso para
    // que el usuario elija reusar o crear nueva. Sin listas existentes
    // el sub-paso aporta poco — vamos directo a crear.
    if ((kind === "select_one" || kind === "select_multiple") && existingLists.length > 0) {
      setStage({ kind: "list-pick", selectKind: kind });
      return;
    }
    onAdd(kind);
    setOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className={`pulso-canvas-addbetween pulso-canvas-addbetween-${variant}${alwaysVisible ? " is-always" : ""}${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className="pulso-canvas-addbetween-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Agregar pregunta o sección"
        aria-label="Agregar pregunta o sección"
        aria-expanded={open}
      >
        <Plus size={14} />
        {variant === "trailing" && <span>Agregar elemento</span>}
      </button>

      {open && stage.kind === "type" && (
        <div className="pulso-canvas-addbetween-menu" role="menu">
          <span className="pulso-canvas-addbetween-menu-eyebrow">Insertar</span>
          {GROUPS.map((group) => (
            <div key={group.id} className="pulso-canvas-addbetween-group">
              <span className="pulso-canvas-addbetween-group-title">{group.label}</span>
              {TYPES.filter((type) => type.group === group.id).map(({ kind, label, hint }) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  className="pulso-canvas-addbetween-menu-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTypeClick(kind);
                  }}
                >
                  {/* M8: la maqueta del catálogo único del kit, igual que en «Añadir pieza». */}
                  <span className="pulso-canvas-addbetween-menu-icon is-maqueta">
                    <MaquetaTipo baseType={kind === "section" ? "begin_group" : kind === "section_end" ? "end_group" : kind} ancho={46} />
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <em>{hint}</em>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {open && stage.kind === "list-pick" && (
        <div className="pulso-canvas-addbetween-menu pulso-canvas-addbetween-listpick" role="menu">
          <button
            type="button"
            className="pulso-canvas-addbetween-back"
            onClick={(e) => {
              e.stopPropagation();
              setStage({ kind: "type" });
            }}
          >
            <ChevronLeft size={12} /> Volver
          </button>
          <span className="pulso-canvas-addbetween-menu-eyebrow">
            Lista de opciones para esta pregunta
          </span>
          <button
            type="button"
            role="menuitem"
            className="pulso-canvas-addbetween-menu-item is-primary"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(stage.selectKind);
              setOpen(false);
            }}
          >
            <span className="pulso-canvas-addbetween-menu-icon">
              <Plus size={14} />
            </span>
            <span>
              <strong>Crear lista nueva</strong>
              <em>Empieza de cero con una lista vacía</em>
            </span>
          </button>
          <span className="pulso-canvas-addbetween-listpick-divider">
            o reusar una lista que ya tienes
          </span>
          {existingLists.map((list) => (
            <button
              key={list.listName}
              type="button"
              role="menuitem"
              className="pulso-canvas-addbetween-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                onAdd(stage.selectKind, list.listName);
                setOpen(false);
              }}
            >
              <span className="pulso-canvas-addbetween-menu-icon">
                <ListChecks size={14} />
              </span>
              <span>
                <strong>{list.listName}</strong>
                <em>
                  {list.choicesCount} {list.choicesCount === 1 ? "opción" : "opciones"}
                  {" · "}
                  {list.usageCount === 0
                    ? "sin usar todavía"
                    : list.usageCount === 1
                      ? "usada en 1 pregunta"
                      : `usada en ${list.usageCount} preguntas`}
                </em>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
