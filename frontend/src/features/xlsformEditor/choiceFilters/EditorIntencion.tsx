// Editor del filtro elegido, por intención (E5, 2026-10-20). Barra fija «Editando el filtro de <código> <pregunta>»,
// las cuatro formas y la configuración de la elegida. Cambiar de forma avisa que reemplaza el filtro. Escape cierra.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { conExpresion, escribirIntento, expresionCascada, intentoCompleto, quitarFiltro, type Intento } from "./escrituraFiltros";
import { ConfigIntento, TarjetasIntencion, intentoInicial } from "./IntencionFiltro";
import type { AnalisisFiltro, TipoFiltro } from "./modeloFiltros";
import type { PreguntaElegible } from "./SelectorPreguntaFiltro";
import { PulsoButton } from "../../../components/PulsoButton";

type Props = {
  analisis: AnalisisFiltro;
  workbook: XlsformEditorWorkbook;
  candidatas: readonly PreguntaElegible[];
  onGuardar: (wb: XlsformEditorWorkbook) => void;
  onCancelar: () => void;
};

/** El workbook que resulta de guardar. null si no hay nada que escribir. */
function escribir(wb: XlsformEditorWorkbook, a: AnalisisFiltro, i: Intento): XlsformEditorWorkbook | null {
  if (!intentoCompleto(i)) return null;
  if (i.forma !== a.tipo) return escribirIntento(wb, a.fila, a.lista, i);
  if (i.forma === "cascada" && a.cascada) {
    if (i.madre === a.cascada.madre && i.columna === a.cascada.columna) return null;
    const base = wb.choices.columns.includes(i.columna) ? wb : escribirIntento(wb, a.fila, a.lista, i);
    return conExpresion(base, a.fila, expresionCascada({ ...a.cascada, madre: i.madre, columna: i.columna }));
  }
  if (i.forma === "fijo" && a.fijo?.forma === "columna") {
    if (i.columna === a.fijo.columna && i.valor.trim() === a.fijo.valor) return null;
    return escribirIntento(wb, a.fila, a.lista, i);
  }
  if (i.forma === "expresion") return i.texto.trim() === a.expresion ? null : conExpresion(wb, a.fila, i.texto.trim());
  return null;
}

export function EditorIntencion({ analisis, workbook, candidatas, onGuardar, onCancelar }: Props) {
  const [forma, setForma] = useState<TipoFiltro>(analisis.tipo);
  const [intentos, setIntentos] = useState<Partial<Record<TipoFiltro, Intento>>>({});
  const raiz = useRef<HTMLDivElement>(null);
  const intento = intentos[forma] ?? intentoInicial(forma, analisis, analisis.pregunta, workbook.choices);
  const cambia = forma !== analisis.tipo;
  const resultado = escribir(workbook, analisis, intento);
  const mismaPorOpcion = !cambia && forma === "opcion";

  useEffect(() => {
    raiz.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus();
  }, []);
  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.stopPropagation(); onCancelar(); }
  };

  return (
    <div ref={raiz} className="xcf-editor" role="group" aria-label={`Editando el filtro de ${analisis.pregunta}`} onKeyDown={tecla}>
      <div className="xcf-editor__barra">
        <span>Editando el filtro de</span>
        <code>{analisis.pregunta}</code>
        <strong title={analisis.etiqueta}>{analisis.etiqueta}</strong>
        <span className="xcf-esp" />
        <PulsoButton variant="danger" size="sm" onClick={() => onGuardar(quitarFiltro(workbook, analisis.fila))}>Quitar filtro</PulsoButton>
        <PulsoButton variant="secondary" size="sm" onClick={onCancelar}>Cancelar</PulsoButton>
        <PulsoButton variant="primary" size="sm" disabled={!resultado} onClick={() => resultado && onGuardar(resultado)}>Guardar</PulsoButton>
      </div>
      <div className="xcf-editor__cuerpo">
        <TarjetasIntencion valor={forma} onCambio={setForma} />
        {cambia ? <p className="xcf-aviso" role="status">Cambiar la forma reemplaza el filtro actual al guardar.</p> : null}
        {mismaPorOpcion
          ? <p className="xcf-nota">Cada opción se asigna en la matriz. Para sumar una pregunta usa «Agregar pregunta» en la matriz.</p>
          : <ConfigIntento intento={intento} onCambio={(i) => setIntentos((p) => ({ ...p, [i.forma]: i }))} candidatas={candidatas} choices={workbook.choices} />}
      </div>
    </div>
  );
}
