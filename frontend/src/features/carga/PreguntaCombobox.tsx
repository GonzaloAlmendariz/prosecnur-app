// Selector de la pregunta de una base, con búsqueda por texto (ADR 0104).
//
// Reemplaza al `<select>` de la tabla: con 78 opciones «p12_1 · Servicio de…»
// recortadas a 132 px, encontrar la pregunta equivalente era leer códigos. Aquí
// se escribe lo que dice la pregunta y la lista se filtra por etiqueta, código
// y sección; cada opción muestra la etiqueta entera y el código aparte.
//
// Patrón combobox de ARIA: el disparador abre un popover con un campo
// `role="combobox"` que controla un `role="listbox"`; flechas, Inicio/Fin,
// Enter elige y Escape cierra devolviendo el foco al disparador. El popover va
// en portal y en `position: fixed`: la tabla vive dentro de un marco con
// `overflow-x: auto` que recortaría cualquier hijo posicionado. Como en
// `EscalaChip`, si la página se desplaza el popover se cierra en vez de
// perseguir a su disparador.
//
// La lógica de filtrado vive en `preguntaEquivalenteModel`.

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "../../vendor/lucide-react";
import type { VariableDeBase } from "../../api/equivalencias";
import { etiquetaLegible, filtrarPreguntas } from "./preguntaEquivalenteModel";
import "./PreguntaCombobox.css";

export type PreguntaComboboxProps = {
  base: string;
  opciones: readonly VariableDeBase[];
  /** Nombre de la variable elegida; `""` si la base todavía no tiene pregunta en esta fila. */
  valor: string;
  onElegir: (nombre: string) => void;
  /** De qué fila se trata, para el nombre accesible («Satisfacción general» o «la fila 3»). */
  contexto: string;
  /** Variables de esta base ya elegidas en OTRA fila: elegirlas aquí las mueve. */
  tomadasEnOtraFila?: ReadonlySet<string>;
};

/** Una opción de la lista: `""` es «esta base no tiene la pregunta». */
type Opcion = { nombre: string; etiqueta: string; seccion: string };

const ANCHO_POPOVER = 380;
const ALTO_POPOVER = 340;

export function PreguntaCombobox({
  base,
  opciones,
  valor,
  onElegir,
  contexto,
  tomadasEnOtraFila,
}: PreguntaComboboxProps) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [cursor, setCursor] = useState(0);
  const [estilo, setEstilo] = useState<CSSProperties | null>(null);
  const disparador = useRef<HTMLButtonElement | null>(null);
  const popover = useRef<HTMLDivElement | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);
  const lista = useRef<HTMLUListElement | null>(null);
  const id = useId();
  const listaId = `${id}-lista`;

  const elegida = valor ? opciones.find((o) => o.name === valor) : undefined;

  const visibles = useMemo<Opcion[]>(() => {
    const filtradas = filtrarPreguntas(opciones, consulta).map((o) => ({
      nombre: o.name,
      etiqueta: etiquetaLegible(o.label),
      seccion: o.seccion,
    }));
    // Quitar la pregunta es una opción más, arriba y sólo si hay algo que quitar
    // y no se está buscando: buscar es querer elegir.
    return valor && !consulta.trim()
      ? [{ nombre: "", etiqueta: "Ninguna: esta base no tiene la pregunta", seccion: "" }, ...filtradas]
      : filtradas;
  }, [consulta, opciones, valor]);

  const colocar = useCallback(() => {
    const el = disparador.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ancho = Math.min(Math.max(ANCHO_POPOVER, r.width), window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - ancho - 8);
    // Abre hacia abajo si cabe; si no, hacia arriba. En 1024x600 la última fila
    // de la tabla no deja sitio debajo.
    const abajo = window.innerHeight - r.bottom - 8;
    const arriba = r.top - 8;
    const haciaArriba = abajo < ALTO_POPOVER && arriba > abajo;
    const alto = Math.min(ALTO_POPOVER, haciaArriba ? arriba : abajo);
    setEstilo(
      haciaArriba
        ? { left, width: ancho, bottom: window.innerHeight - r.top + 4, maxHeight: alto }
        : { left, width: ancho, top: r.bottom + 4, maxHeight: alto },
    );
  }, []);

  const abrir = () => {
    setConsulta("");
    // Arranca sobre la elegida (detrás de «Ninguna», que va primero) para que
    // Enter sin moverse no cambie nada.
    const i = valor ? opciones.findIndex((o) => o.name === valor) : -1;
    setCursor(i >= 0 ? i + 1 : 0);
    setAbierto(true);
  };

  const cerrar = useCallback((devolverFoco: boolean) => {
    setAbierto(false);
    setEstilo(null);
    if (devolverFoco) disparador.current?.focus();
  }, []);

  const elegir = (nombre: string) => {
    onElegir(nombre);
    cerrar(true);
  };

  useLayoutEffect(() => {
    if (abierto) colocar();
  }, [abierto, colocar]);

  // El campo existe cuando el popover ya tiene posición.
  const posicionado = estilo !== null;
  useEffect(() => {
    if (abierto && posicionado) campo.current?.focus();
  }, [abierto, posicionado]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popover.current?.contains(t) && !disparador.current?.contains(t)) cerrar(false);
    };
    const alDesplazar = (e: Event) => {
      // Desplazar la lista misma no cierra; desplazar la página sí.
      if (e.target instanceof Node && popover.current?.contains(e.target)) return;
      cerrar(false);
    };
    const alRedimensionar = () => cerrar(false);
    document.addEventListener("mousedown", fuera);
    window.addEventListener("scroll", alDesplazar, true);
    window.addEventListener("resize", alRedimensionar);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("scroll", alDesplazar, true);
      window.removeEventListener("resize", alRedimensionar);
    };
  }, [abierto, cerrar]);

  useEffect(() => {
    if (!abierto) return;
    lista.current?.querySelector<HTMLElement>(`[data-indice="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [abierto, cursor]);

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = visibles.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (n === 0) return;
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setCursor((c) => (c + paso + n) % n);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      if (n > 0) setCursor(e.key === "Home" ? 0 : n - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = visibles[cursor];
      if (o) elegir(o.nombre);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cerrar(true);
    } else if (e.key === "Tab") {
      cerrar(false);
    }
  };

  const textoElegida = elegida ? etiquetaLegible(elegida.label) || elegida.name : valor;
  const nombreAccesible = `Pregunta de ${base} en ${contexto}: ${valor ? `${textoElegida} (${valor})` : "sin elegir"}`;
  const activa = visibles[cursor];

  return (
    <>
      <button
        ref={disparador}
        type="button"
        className={valor ? "pulso-preg-disparador" : "pulso-preg-disparador is-vacio"}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={nombreAccesible}
        title={valor ? `${textoElegida} · ${valor}` : undefined}
        onClick={() => (abierto ? cerrar(false) : abrir())}
      >
        <span className="pulso-preg-disparador-texto">
          {valor ? (
            <>
              <span className="pulso-preg-etiqueta">{textoElegida}</span>
              <code className="pulso-preg-codigo">{valor}</code>
            </>
          ) : (
            <span className="pulso-preg-placeholder">Buscar pregunta…</span>
          )}
        </span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {abierto && estilo && createPortal(
        <div
          ref={popover}
          className="pulso-preg-popover"
          style={estilo}
          role="dialog"
          aria-label={`Elegir la pregunta de ${base}`}
        >
          <label className="pulso-preg-busqueda">
            <Search size={13} aria-hidden="true" />
            <input
              ref={campo}
              role="combobox"
              aria-expanded="true"
              aria-controls={listaId}
              aria-autocomplete="list"
              aria-activedescendant={activa ? `${id}-op-${cursor}` : undefined}
              aria-label={`Buscar la pregunta de ${base} por su texto o su código`}
              placeholder="Escribe parte de la pregunta…"
              value={consulta}
              onChange={(e) => {
                setConsulta(e.target.value);
                setCursor(0);
              }}
              onKeyDown={alTeclear}
            />
          </label>
          {visibles.length === 0 ? (
            <p className="pulso-preg-sin-resultados" role="status">
              Ninguna pregunta de {base} contiene «{consulta.trim()}».
            </p>
          ) : (
            <ul
              ref={lista}
              id={listaId}
              className="pulso-preg-lista"
              role="listbox"
              aria-label={`Preguntas de ${base}`}
            >
              {visibles.map((o, i) => {
                const enOtra = o.nombre !== "" && o.nombre !== valor && tomadasEnOtraFila?.has(o.nombre);
                const clases = [
                  "pulso-preg-opcion",
                  i === cursor ? "is-activa" : "",
                  o.nombre === "" ? "is-quitar" : "",
                ].filter(Boolean).join(" ");
                return (
                  <li
                    key={o.nombre || "__ninguna"}
                    id={`${id}-op-${i}`}
                    data-indice={i}
                    role="option"
                    aria-selected={o.nombre === valor}
                    className={clases}
                    // `mousedown` evita que el campo pierda el foco antes del clic.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => elegir(o.nombre)}
                  >
                    <span className="pulso-preg-opcion-etiqueta">{o.etiqueta || o.nombre}</span>
                    {o.nombre !== "" && (
                      <span className="pulso-preg-opcion-meta">
                        <code>{o.nombre}</code>
                        {o.seccion ? <span>{o.seccion}</span> : null}
                        {enOtra ? <span className="pulso-preg-opcion-aviso">ya está en otra fila</span> : null}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
