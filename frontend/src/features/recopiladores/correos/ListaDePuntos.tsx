// Los puntos de un Recuadro o de una Lista, uno por fila (ítem 3 de
// docs/qa/checklist-inspector-correo-2026-10-23.md). Cada punto tiene su campo
// con formato (CampoConCampos: negrita, cursiva, chips de campos), y se sube,
// baja o quita con sus botones. Enter crea el siguiente debajo; Backspace en
// un punto vacío lo borra. Al bloque llega lo de siempre: `items`, un arreglo
// de textos sin vacíos (listaDePuntosModel.ts).

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import type { MailProblem } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "../../../vendor/lucide-react";
import { CampoConCampos } from "./CampoConCampos";
import {
  MAX_PUNTOS,
  agregar,
  alBorrarVacio,
  alPulsarEnter,
  conTextoDeFila,
  cursorEnLosPuntos,
  filasDe,
  mover,
  puedeAgregar,
  puedeMover,
  puedeQuitar,
  puntosDe,
  quitar,
  reconciliar,
  type FilaDePunto,
  type Paso,
  type Pendiente,
} from "./listaDePuntosModel";
import type { OpcionesDeTexto } from "./serializarTexto";
import "./correosListaDePuntos.css";

type Props = {
  label: string;
  items: readonly string[];
  /** Lista numerada: 1., 2., …; si no, viñeta. */
  numerada?: boolean;
  opciones: Pick<OpcionesDeTexto, "rotuloDeCampo" | "ayudaDeCampo" | "campoValido">;
  enlaces?: boolean;
  problemas?: readonly MailProblem[];
  onCambio: (items: string[]) => void;
  /** El cursor en el texto de la propiedad (los puntos unidos por saltos de línea). */
  onCursor?: (cursor: number | null) => void;
  onIrAPersonas?: () => void;
};

function crearContador(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `p${n}`;
  };
}

function cursorAlFinal(el: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

export function ListaDePuntos({ label, items, numerada = false, opciones, enlaces = false, problemas = [], onCambio, onCursor, onIrAPersonas }: Props) {
  const crearId = useRef(crearContador()).current;
  const [filas, setFilas] = useState<FilaDePunto[]>(() => filasDe(items, crearId));
  const filasRef = useRef(filas);
  filasRef.current = filas;
  const pendiente = useRef<Pendiente | null>(null);
  const enfocar = useRef<Paso["foco"]>(null);
  const raiz = useRef<HTMLDivElement | null>(null);
  const onCambioRef = useRef(onCambio);
  onCambioRef.current = onCambio;

  // Un cambio por fuera (deshacer, un campo desde la columna) se concilia con las filas.
  useEffect(() => {
    const out = reconciliar(filasRef.current, items, pendiente.current, crearId);
    pendiente.current = null;
    if (out.filas.length !== filasRef.current.length || out.filas.some((f, i) => f !== filasRef.current[i])) {
      setFilas(out.filas);
    }
    if (out.corregidos) onCambioRef.current(out.corregidos);
  }, [items, crearId]);

  useLayoutEffect(() => {
    const foco = enfocar.current;
    if (!foco || !raiz.current) return;
    enfocar.current = null;
    const caja = raiz.current.querySelector<HTMLElement>(`[data-fila="${foco.id}"] [role="textbox"]`);
    if (!caja) return;
    caja.focus({ preventScroll: false });
    if (foco.alFinal) cursorAlFinal(caja);
  }, [filas]);

  const aplicar = (paso: Paso | null) => {
    if (!paso) return;
    enfocar.current = paso.foco;
    setFilas(paso.filas);
    const antes = puntosDe(filas);
    const despues = puntosDe(paso.filas);
    if (antes.length !== despues.length || antes.some((t, i) => t !== despues[i])) onCambio(despues);
  };

  const escribir = (indice: number, texto: string) => {
    const nuevas = conTextoDeFila(filas, indice, texto);
    setFilas(nuevas);
    onCambio(puntosDe(nuevas));
  };

  const informarCursor = (indice: number, cursor: number | null) => {
    const actuales = filasRef.current;
    const enLosPuntos = cursorEnLosPuntos(actuales, indice, cursor);
    const fila = actuales[indice];
    pendiente.current = fila && !fila.texto.trim() && enLosPuntos !== null
      ? { filaId: fila.id, base: puntosDe(actuales).join("\n"), desplazamiento: enLosPuntos }
      : null;
    onCursor?.(enLosPuntos);
  };

  // Enter y Backspace se leen antes que el campo: Enter nunca parte el renglón.
  const alTeclear = (indice: number) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    const mod = event.metaKey || event.ctrlKey || event.altKey;
    if (event.key === "Enter" && !mod && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      aplicar(alPulsarEnter(filas, indice, crearId));
      return;
    }
    if (event.key === "Backspace" && !mod) {
      const paso = alBorrarVacio(filas, indice);
      if (paso) {
        event.preventDefault();
        event.stopPropagation();
        aplicar(paso);
      }
    }
  };

  const llena = !puedeAgregar(filas);

  return (
    <div className="rec-mail-puntos" ref={raiz} role="group" aria-label={label}>
      <span className="rec-mail-campo-rotulo">
        <span>{label}</span>
        <span className="rec-mail-contador">{filas.length} de {MAX_PUNTOS}</span>
      </span>
      <ol className={`rec-mail-puntos-lista${numerada ? " is-numerada" : ""}`}>
        {filas.map((fila, i) => (
          <li key={fila.id} className="rec-mail-puntos-fila" data-fila={fila.id}>
            <span className="rec-mail-puntos-marca" aria-hidden>{numerada ? `${i + 1}.` : "•"}</span>
            <div className="rec-mail-puntos-campo" onKeyDownCapture={alTeclear(i)}>
              <CampoConCampos
                label={`Punto ${i + 1}`}
                valor={fila.texto}
                opciones={opciones}
                enlaces={enlaces}
                onCambio={(texto) => escribir(i, texto)}
                onCursor={(cursor) => informarCursor(i, cursor)}
                onIrAPersonas={onIrAPersonas}
              />
            </div>
            <span className="rec-mail-puntos-acciones">
              <PulsoButton
                variant="icon"
                size="sm"
                aria-label={`Subir el punto ${i + 1}`}
                title="Subir"
                disabled={!puedeMover(filas, i, -1)}
                onClick={() => aplicar(mover(filas, i, -1))}
              >
                <ArrowUp size={14} aria-hidden />
              </PulsoButton>
              <PulsoButton
                variant="icon"
                size="sm"
                aria-label={`Bajar el punto ${i + 1}`}
                title="Bajar"
                disabled={!puedeMover(filas, i, 1)}
                onClick={() => aplicar(mover(filas, i, 1))}
              >
                <ArrowDown size={14} aria-hidden />
              </PulsoButton>
              <PulsoButton
                variant="icon"
                size="sm"
                aria-label={`Quitar el punto ${i + 1}`}
                title="Quitar"
                disabled={!puedeQuitar(filas)}
                onClick={() => aplicar(quitar(filas, i))}
              >
                <Trash2 size={14} aria-hidden />
              </PulsoButton>
            </span>
          </li>
        ))}
      </ol>
      <PulsoButton
        variant="ghost"
        size="sm"
        className="rec-mail-puntos-agregar"
        disabled={llena}
        title={llena ? `Como mucho ${MAX_PUNTOS} puntos` : undefined}
        onClick={() => aplicar(agregar(filas, filas.length - 1, crearId))}
      >
        <Plus size={14} aria-hidden /> Agregar punto
      </PulsoButton>
      {problemas.length ? (
        <ul className="rec-mail-problemas">
          {problemas.map((p, i) => <li key={`${p.path}-${i}`}>{p.detail}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
