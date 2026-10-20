// Tabla del Editor XLSForm (E10, 2026-10-20): ventana de filas (sólo las visibles más un margen), filas memoizadas por
// contenido, columnas identificadoras fijas tras # y llegada a una fila (la recién agregada) con el foco en su celda.

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { XlsformEditorSheet } from "../types";
import { COLUMN_HELP, EXPRESSION_COLUMNS } from "./hojasModel";
import type { TabKey } from "./hojasModel";
import { CeldaHoja } from "./HojaCeldas";
import { calcularVentana, incluirFilas, offsetsDeFilas } from "./ventanaFilas";

const ALTURA_ESTIMADA = 38;
const MARGEN = 12;

export type TablaHojaProps = {
  hoja: XlsformEditorSheet;
  hojaClave: TabKey;
  /** Columnas visibles, con las fijas primero. Identidad estable entre renders. */
  columnas: string[];
  fijas: number;
  contenedor: RefObject<HTMLDivElement | null>;
  elegida: { fila: number; columna: string } | null;
  borrador: string | null;
  onElegir: (fila: number, columna: string) => void;
  onEditar: (fila: number, columna: string, valor: string) => void;
  onConfirmar: () => void;
  onDescartar: () => void;
  onMoveRow: (hoja: TabKey, fila: number, direccion: "up" | "down") => void;
  onDeleteRow: (hoja: TabKey, fila: number) => void;
  /** Fila a la que hay que llevar al usuario (scroll + foco); se avisa con `onLlegada`. */
  irAFila: number | null;
  onLlegada: () => void;
};

export function TablaHoja(props: TablaHojaProps) {
  const { hoja, hojaClave, columnas, fijas, contenedor, elegida, borrador, irAFila, onLlegada } = props;
  const tablaRef = useRef<HTMLTableElement>(null);
  const alturas = useRef(new Map<number, number>());
  const cabecera = useRef(0);
  const [vista, setVista] = useState({ top: 0, alto: 800 });
  const [, setVersion] = useState(0);
  const repintar = useRef(0);

  // Las alturas medidas pertenecen a una hoja y a un juego de columnas.
  useEffect(() => { alturas.current = new Map(); }, [hojaClave, columnas]);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    let cuadro = 0;
    const leer = () => {
      cuadro = 0;
      setVista((v) => (v.top === el.scrollTop && v.alto === el.clientHeight ? v : { top: el.scrollTop, alto: el.clientHeight }));
      el.toggleAttribute("data-desplazada-h", el.scrollLeft > 0);
    };
    const alDesplazar = () => { if (!cuadro) cuadro = requestAnimationFrame(leer); };
    leer();
    el.addEventListener("scroll", alDesplazar, { passive: true });
    const obs = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(alDesplazar);
    obs?.observe(el);
    return () => { el.removeEventListener("scroll", alDesplazar); obs?.disconnect(); if (cuadro) cancelAnimationFrame(cuadro); };
  }, [contenedor, hojaClave]);

  const total = hoja.rows.length;
  const offsets = offsetsDeFilas(total, alturas.current, ALTURA_ESTIMADA);
  // La fila en edición (o la que se está por enfocar) no sale del DOM por un desfase de la ventana: perdería el foco.
  const ventana = incluirFilas(
    calcularVentana({ offsets, desde: vista.top - cabecera.current, alto: vista.alto, margen: MARGEN }),
    offsets,
    [elegida?.fila ?? null, irAFila],
  );
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;

  // Medir lo montado: alturas de fila, cabecera y el `left` de cada columna fija.
  useLayoutEffect(() => {
    const tabla = tablaRef.current;
    if (!tabla) return;
    cabecera.current = tabla.tHead?.offsetHeight ?? 0;
    let cambio = false;
    tabla.querySelectorAll<HTMLTableRowElement>("tbody tr[data-fila]").forEach((tr) => {
      const i = Number(tr.dataset.fila);
      const h = tr.offsetHeight;
      if (Math.abs((alturas.current.get(i) ?? ALTURA_ESTIMADA) - h) > 1) { alturas.current.set(i, h); cambio = true; }
    });
    const ths = tabla.querySelectorAll<HTMLTableCellElement>("thead th");
    let izquierda = ths[0]?.offsetWidth ?? 0;
    for (let i = 0; i < fijas; i += 1) {
      tabla.style.setProperty(`--xfx-izq-${i}`, `${izquierda}px`);
      izquierda += ths[i + 1]?.offsetWidth ?? 0;
    }
    // Fuera del commit: repintar en el mismo ciclo encadena medidas y agota la profundidad de React.
    if (cambio && !repintar.current) {
      repintar.current = requestAnimationFrame(() => { repintar.current = 0; setVersion((v) => v + 1); });
    }
  });
  useEffect(() => () => { if (repintar.current) cancelAnimationFrame(repintar.current); }, []);

  // Llegar a una fila: primero desplazar para que entre en la ventana, después (ya montada) enfocar su primera celda.
  useEffect(() => {
    const el = contenedor.current;
    if (irAFila === null || irAFila >= total || !el) return;
    const destino = cabecera.current + (offsetsRef.current[irAFila] ?? 0) - el.clientHeight / 2;
    el.scrollTop = Math.max(0, destino);
    setVista({ top: el.scrollTop, alto: el.clientHeight });
  }, [irAFila, total, contenedor]);
  useLayoutEffect(() => {
    if (irAFila === null) return;
    const celda = tablaRef.current?.querySelector<HTMLElement>(`tbody tr[data-fila="${irAFila}"] .pulso-xfs-cell`);
    if (!celda) return;
    celda.closest("tr")?.scrollIntoView({ block: "nearest" });
    celda.focus({ preventScroll: true });
    const el = contenedor.current;
    if (el) setVista({ top: el.scrollTop, alto: el.clientHeight });
    onLlegada();
  });

  const filas = [];
  for (let i = ventana.inicio; i < ventana.fin; i += 1) {
    const row = hoja.rows[i] ?? [];
    const valores = columnas.map((c) => {
      const idx = hoja.columns.indexOf(c);
      return idx >= 0 ? row[idx] ?? "" : "";
    });
    const esElegida = elegida?.fila === i;
    filas.push(
      <FilaHoja
        key={i}
        fila={i}
        valores={valores}
        columnas={columnas}
        fijas={fijas}
        hojaClave={hojaClave}
        esUltima={i === total - 1}
        columnaElegida={esElegida ? elegida.columna : null}
        borrador={esElegida ? borrador : null}
        onElegir={props.onElegir}
        onEditar={props.onEditar}
        onConfirmar={props.onConfirmar}
        onDescartar={props.onDescartar}
        onMoveRow={props.onMoveRow}
        onDeleteRow={props.onDeleteRow}
      />,
    );
  }

  return (
    <table className="pulso-xfs-table" ref={tablaRef}>
      <thead>
        <tr>
          <th aria-label="Acciones" className="pulso-xfs-actions-col">
            <span className="pulso-xfs-colcode">#</span>
          </th>
          {columnas.map((col, i) => {
            const help = COLUMN_HELP[col];
            return (
              <th key={col} title={help ? `${help.label} — ${help.detail}` : col} {...fija(i, fijas)}>
                <ColumnHeader columnName={col} />
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {ventana.arriba > 0 ? <tr aria-hidden className="xfx-espaciador"><td colSpan={columnas.length + 1} style={{ height: ventana.arriba }} /></tr> : null}
        {filas}
        {ventana.abajo > 0 ? <tr aria-hidden className="xfx-espaciador"><td colSpan={columnas.length + 1} style={{ height: ventana.abajo }} /></tr> : null}
      </tbody>
    </table>
  );
}

/** Clase y `left` de una columna fija (la medida la escribe la tabla en `--xfx-izq-N`). */
function fija(i: number, fijas: number): { className?: string; style?: CSSProperties } {
  if (i >= fijas) return {};
  return {
    className: `xfx-fija${i === fijas - 1 ? " xfx-fija--ultima" : ""}`,
    style: { left: `var(--xfx-izq-${i})` },
  };
}

type FilaHojaProps = {
  fila: number;
  valores: string[];
  columnas: string[];
  fijas: number;
  hojaClave: TabKey;
  esUltima: boolean;
  columnaElegida: string | null;
  borrador: string | null;
  onElegir: TablaHojaProps["onElegir"];
  onEditar: TablaHojaProps["onEditar"];
  onConfirmar: TablaHojaProps["onConfirmar"];
  onDescartar: TablaHojaProps["onDescartar"];
  onMoveRow: TablaHojaProps["onMoveRow"];
  onDeleteRow: TablaHojaProps["onDeleteRow"];
};

/** Una edición confirmada clona el workbook entero: comparar por contenido evita repintar las filas que no cambiaron. */
function mismaFila(a: FilaHojaProps, b: FilaHojaProps): boolean {
  if (a.valores.length !== b.valores.length) return false;
  for (let i = 0; i < a.valores.length; i += 1) if (a.valores[i] !== b.valores[i]) return false;
  return a.fila === b.fila && a.columnas === b.columnas && a.fijas === b.fijas && a.hojaClave === b.hojaClave
    && a.esUltima === b.esUltima && a.columnaElegida === b.columnaElegida && a.borrador === b.borrador
    && a.onElegir === b.onElegir && a.onEditar === b.onEditar && a.onConfirmar === b.onConfirmar
    && a.onDescartar === b.onDescartar && a.onMoveRow === b.onMoveRow && a.onDeleteRow === b.onDeleteRow;
}

const FilaHoja = memo(function FilaHoja(p: FilaHojaProps) {
  const { fila, valores, columnas, fijas, hojaClave, columnaElegida, borrador } = p;
  return (
    <tr data-fila={fila} className={fila % 2 === 1 ? "is-par" : undefined}>
      <td className="pulso-xfs-actions-col">
        <div className="pulso-xfs-row-actions">
          <span className="pulso-xfs-row-num">{fila + 1}</span>
          <div className="pulso-xfs-row-btns">
            <button type="button" className="pulso-xfs-iconbtn" onClick={() => p.onMoveRow(hojaClave, fila, "up")}
              disabled={fila === 0} title="Subir fila" aria-label="Subir fila">
              <ChevronUp size={13} />
            </button>
            <button type="button" className="pulso-xfs-iconbtn" onClick={() => p.onMoveRow(hojaClave, fila, "down")}
              disabled={p.esUltima} title="Bajar fila" aria-label="Bajar fila">
              <ChevronDown size={13} />
            </button>
            <BotonEliminar fila={fila} onEliminar={() => p.onDeleteRow(hojaClave, fila)} />
          </div>
        </div>
      </td>
      {columnas.map((col, i) => {
        const guardado = valores[i] ?? "";
        const elegida = columnaElegida === col;
        const f = fija(i, fijas);
        return (
          <td key={col} className={[f.className, elegida ? "is-elegida" : ""].filter(Boolean).join(" ") || undefined}
            style={f.style} onFocusCapture={() => p.onElegir(fila, col)}>
            <CeldaHoja
              fila={fila}
              columna={col}
              valor={elegida && borrador !== null ? borrador : guardado}
              guardado={guardado}
              esExpresion={col === "name" || col === "list_name" || EXPRESSION_COLUMNS.has(col)}
              onEditar={p.onEditar}
              onConfirmar={p.onConfirmar}
              onDescartar={p.onDescartar}
            />
          </td>
        );
      })}
    </tr>
  );
}, mismaFila);

/** Eliminar en dos pasos: el primer clic pregunta «¿Eliminar?» en el propio botón; salir de él lo devuelve a su estado. */
function BotonEliminar({ fila, onEliminar }: { fila: number; onEliminar: () => void }) {
  const [armado, setArmado] = useState(false);
  const desarmar = useCallback(() => setArmado(false), []);
  return (
    <button
      type="button"
      className={`pulso-xfs-iconbtn pulso-xfs-iconbtn--danger${armado ? " xfx-eliminar--armado" : ""}`}
      onClick={() => {
        if (!armado) { setArmado(true); return; }
        setArmado(false);
        onEliminar();
      }}
      onBlur={desarmar}
      onMouseLeave={desarmar}
      onKeyDown={(e) => { if (e.key === "Escape" && armado) { e.stopPropagation(); desarmar(); } }}
      title={armado ? "Vuelve a pulsar para eliminar la fila" : "Eliminar fila"}
      aria-label={armado ? `Confirmar: eliminar la fila ${fila + 1}` : "Eliminar fila"}
    >
      <Trash2 size={13} />
      {armado ? <span>¿Eliminar?</span> : null}
    </button>
  );
}

/** Encabezado de columna: nombre técnico en mono suave; la explicación en español vive en el `title` del `<th>`. */
function ColumnHeader({ columnName }: { columnName: string }) {
  const help = COLUMN_HELP[columnName];
  return (
    <span className={`pulso-xfs-colhead${help?.badge ? " is-extension" : ""}`}>
      <span className="pulso-xfs-colcode">{columnName}</span>
      {help?.badge && <em className="pulso-xfs-col-badge">{help.badge}</em>}
      {help ? <span className="xfx-colayuda">{help.label}</span> : null}
    </span>
  );
}
