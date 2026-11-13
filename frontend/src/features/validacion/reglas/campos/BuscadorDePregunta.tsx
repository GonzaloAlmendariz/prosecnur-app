/**
 * El selector de pregunta del panel de regla, con búsqueda (ítem 9 del
 * checklist del practicante): con 228 preguntas, el desplegable del kit no
 * dejaba buscar y teclear no saltaba a ninguna.
 *
 * Patrón combobox de ARIA, como `carga/PreguntaCombobox.tsx` (ADR 0104): el
 * disparador abre un campo `role="combobox"` que controla un `role="listbox"`;
 * flechas, Inicio/Fin, Enter elige y Escape cierra devolviendo el foco al
 * disparador. Escribir con el disparador enfocado abre la lista con esa letra.
 *
 * A diferencia del de Carga, la lista no va en portal: vive dentro del panel
 * de regla (un `Sideover`), y fuera de él la trampa de foco del panel le
 * quitaría el foco al campo. Escape se atiende en la fase de captura de
 * `window`, antes que el panel, para que cierre la lista y no el panel.
 *
 * La lista es fija (`position: fixed`): las cajas del panel recortan lo que
 * sobresale (`overflow: clip`) y una lista absoluta quedaba cortada. Mide como
 * mucho 36rem, como el desplegable del kit (037c6a4fc), y nunca más que el
 * espacio que deja la ventana; si abajo no cabe, abre hacia arriba.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { ChevronDown, Search } from "../../../../vendor/lucide-react";
import type { ExploradorVariable } from "../../types";
import { filtrarPreguntas, normalizarBusqueda, partesDePreguntas, type PartesDePregunta } from "./modeloPregunta";
import { tipoDeFicha } from "./tipoDeFicha";
import "./buscadorDePregunta.css";

/** Tope de la lista, el del desplegable del kit (36rem). */
const ANCHO_MAXIMO = 576;
const ANCHO_MINIMO = 360;
const ALTO_MAXIMO = 360;
const MARGEN = 16;
/** Alto del campo de búsqueda con su borde. */
const CAMPO = 42;

type Opcion = { variable: ExploradorVariable; partes: PartesDePregunta; fueraDeLaBase: boolean };

export type BuscadorDePreguntaProps = {
  variables: readonly ExploradorVariable[];
  valor: string;
  onCambio: (variable: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
};

export function BuscadorDePregunta({
  variables,
  valor,
  onCambio,
  ariaLabel,
  placeholder = "Elegir pregunta",
  className,
}: BuscadorDePreguntaProps) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [cursor, setCursor] = useState(0);
  const [estilo, setEstilo] = useState<{ caja: CSSProperties; lista: CSSProperties } | null>(null);
  const raiz = useRef<HTMLDivElement | null>(null);
  const disparador = useRef<HTMLButtonElement | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);
  const lista = useRef<HTMLUListElement | null>(null);
  const origenRef = useRef<HTMLSpanElement | null>(null);
  const id = useId();
  const listaId = `${id}-lista`;
  const opcionId = (i: number) => `${id}-op-${i}`;

  const partes = useMemo(() => partesDePreguntas(variables), [variables]);
  const elegida = variables.find((v) => v.name === valor);
  const partesElegida = elegida ? partes.get(elegida.name) : undefined;

  const opciones = useMemo<Opcion[]>(() => {
    const halladas = filtrarPreguntas(variables, consulta).map((v) => ({
      variable: v,
      partes: partes.get(v.name) ?? { texto: v.label ?? "", enunciado: null },
      fueraDeLaBase: false,
    }));
    // Una pregunta guardada que ya no está en la base se sigue viendo: no se pierde al abrir la regla.
    if (valor && !elegida && !consulta.trim()) {
      const fantasma: ExploradorVariable = { name: valor, label: "", tipo: "mixto", n_validos: 0, n_nulos: 0 };
      return [{ variable: fantasma, partes: { texto: "No está en esta base", enunciado: null }, fueraDeLaBase: true }, ...halladas];
    }
    return halladas;
  }, [consulta, elegida, partes, valor, variables]);

  const colocar = useCallback(() => {
    const el = raiz.current;
    const origen = origenRef.current;
    if (!el || !origen) return;
    const r = el.getBoundingClientRect();
    // El origen del bloque que contiene a la lista fija: la ventana, o el panel
    // si está transformado (la animación de entrada del Sideover).
    const o = origen.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ancho = Math.max(Math.min(ANCHO_MAXIMO, vw - 2 * MARGEN, Math.max(ANCHO_MINIMO, r.width)), Math.min(r.width, vw - 2 * MARGEN));
    // Se corre a la izquierda lo justo para no salirse de la ventana.
    const izquierda = Math.max(MARGEN, Math.min(r.left, vw - MARGEN - ancho));
    const abajo = vh - r.bottom - MARGEN;
    const arriba = r.top - MARGEN;
    const haciaArriba = abajo < 240 && arriba > abajo;
    const alto = Math.max(160, Math.min(ALTO_MAXIMO, haciaArriba ? arriba : abajo));
    const maxLista = alto - CAMPO;
    // Alto real de la caja: el campo más la lista, hasta su tope.
    const altoCaja = CAMPO + Math.min(lista.current?.scrollHeight ?? maxLista, maxLista);
    setEstilo({
      caja: {
        width: ancho,
        left: izquierda - o.left,
        top: (haciaArriba ? r.top - 4 - altoCaja : r.bottom + 4) - o.top,
      },
      lista: { maxHeight: maxLista },
    });
  }, []);

  const abrir = (inicial = "") => {
    setConsulta(inicial);
    const i = inicial ? 0 : opcionesSinConsulta(variables, valor, elegida).findIndex((v) => v === valor);
    setCursor(Math.max(0, i));
    setAbierto(true);
  };

  const cerrar = useCallback((devolverFoco: boolean) => {
    setAbierto(false);
    setEstilo(null);
    if (devolverFoco) disparador.current?.focus();
  }, []);

  const elegir = (nombre: string) => {
    if (nombre !== valor) onCambio(nombre);
    cerrar(true);
  };

  // Se vuelve a colocar cuando la lista cambia de largo (abre hacia arriba según su alto).
  useLayoutEffect(() => {
    if (abierto) colocar();
  }, [abierto, colocar, opciones.length]);

  const colocado = estilo !== null;
  useEffect(() => {
    if (abierto && colocado) campo.current?.focus();
  }, [abierto, colocado]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (e.target instanceof Node && raiz.current?.contains(e.target)) return;
      cerrar(false);
    };
    // Captura en `window`: llega antes que el Escape del panel (que escucha en `document`).
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      cerrar(true);
    };
    const alRedimensionar = () => colocar();
    // La lista es fija: si el panel se desplaza, se cierra en vez de quedar suelta (como en Carga).
    const alDesplazar = (e: Event) => {
      if (e.target instanceof Node && raiz.current?.contains(e.target)) return;
      cerrar(false);
    };
    document.addEventListener("pointerdown", fuera, true);
    window.addEventListener("keydown", escape, true);
    window.addEventListener("resize", alRedimensionar);
    window.addEventListener("scroll", alDesplazar, true);
    return () => {
      document.removeEventListener("pointerdown", fuera, true);
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", alRedimensionar);
      window.removeEventListener("scroll", alDesplazar, true);
    };
  }, [abierto, cerrar, colocar]);

  useEffect(() => {
    if (!abierto) return;
    const activa = lista.current?.querySelector<HTMLElement>(`[data-indice="${cursor}"]`);
    activa?.scrollIntoView?.({ block: "nearest" });
  }, [abierto, cursor]);

  const alTeclearEnElCampo = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = opciones.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (n) setCursor((c) => (c + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      if (n) setCursor(e.key === "Home" ? 0 : n - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = opciones[cursor];
      if (o) elegir(o.variable.name);
    } else if (e.key === "Tab") {
      cerrar(false);
    }
  };

  const alTeclearEnElDisparador = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (abierto) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      abrir();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ") {
      // Escribir sobre el disparador abre la búsqueda con esa letra.
      e.preventDefault();
      abrir(e.key);
    }
  };

  const textoElegida = partesElegida?.texto || (elegida ? "" : valor ? "No está en esta base" : "");
  // Sin texto, o con el mismo texto que otra pregunta, el código es lo único que la distingue: no se esconde
  // aunque el panel sea angosto, y el texto repetido lleva el enunciado de su batería o grupo.
  const repetida = !!textoElegida && textoRepetido(partes, valor, textoElegida);
  const codigoALaVista = !textoElegida || repetida;
  const textoDelDisparador = repetida && partesElegida?.enunciado ? `${textoElegida} (${partesElegida.enunciado})` : textoElegida;
  const titulo = elegida ? [elegida.name, elegida.label && elegida.label !== elegida.name ? elegida.label : ""].filter(Boolean).join(" ") : valor || undefined;

  return (
    <div ref={raiz} className="pulso-regla-buscador">
      <button
        ref={disparador}
        type="button"
        className={["pulso-select-trigger", "pulso-regla-buscador-disparador", className].filter(Boolean).join(" ")}
        data-state={abierto ? "open" : "closed"}
        data-placeholder={valor ? undefined : ""}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={ariaLabel}
        title={titulo}
        onClick={() => (abierto ? cerrar(false) : abrir())}
        onKeyDown={alTeclearEnElDisparador}
      >
        {valor ? (
          <span className="pulso-regla-pregunta-opcion">
            <i className="pulso-regla-punto" data-tipo={elegida ? tipoDeFicha(elegida.tipo) : undefined} aria-hidden="true" />
            <code className={codigoALaVista ? "is-a-la-vista" : undefined}>{valor}</code>
            {textoDelDisparador ? <span>{textoDelDisparador}</span> : null}
          </span>
        ) : (
          <span>{placeholder}</span>
        )}
        <span className="pulso-select-icon" aria-hidden="true">
          <ChevronDown size={15} />
        </span>
      </button>
      {abierto ? (
        <span ref={origenRef} className="pulso-regla-buscador-origen" aria-hidden="true" />
      ) : null}
      {abierto ? (
        <div className="pulso-regla-buscador-caja" style={estilo?.caja ?? { visibility: "hidden" }}>
          <label className="pulso-regla-buscador-campo">
            <Search size={14} aria-hidden="true" />
            <input
              ref={campo}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listaId}
              aria-autocomplete="list"
              aria-activedescendant={opciones[cursor] ? opcionId(cursor) : undefined}
              aria-label={`Buscar ${ariaLabel.toLowerCase()} por código o texto`}
              placeholder="Código o texto de la pregunta"
              value={consulta}
              onChange={(e) => {
                setConsulta(e.target.value);
                setCursor(0);
              }}
              onKeyDown={alTeclearEnElCampo}
            />
          </label>
          <ul ref={lista} id={listaId} role="listbox" aria-label={ariaLabel} className="pulso-regla-buscador-lista" style={estilo?.lista}>
            {opciones.map((o, i) => (
              <li
                key={`${o.variable.name}-${o.fueraDeLaBase ? "fuera" : "base"}`}
                id={opcionId(i)}
                role="option"
                aria-selected={o.variable.name === valor}
                data-indice={i}
                data-activa={i === cursor ? "" : undefined}
                className="pulso-regla-buscador-opcion"
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => {
                  if (i !== cursor) setCursor(i);
                }}
                onClick={() => elegir(o.variable.name)}
              >
                <i className="pulso-regla-punto" data-tipo={o.fueraDeLaBase ? undefined : tipoDeFicha(o.variable.tipo)} aria-hidden="true" />
                <code>{o.variable.name}</code>
                <span className="pulso-regla-buscador-textos">
                  {o.partes.texto ? <span className="pulso-regla-buscador-item">{o.partes.texto}</span> : null}
                  {o.partes.enunciado ? <span className="pulso-regla-buscador-enunciado">{o.partes.enunciado}</span> : null}
                </span>
              </li>
            ))}
            {!opciones.length ? (
              <li className="pulso-regla-buscador-vacio" role="presentation">
                Ninguna pregunta coincide con "{consulta.trim()}"
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** El orden de las opciones sin consulta, para arrancar el cursor sobre la elegida. */
function opcionesSinConsulta(variables: readonly ExploradorVariable[], valor: string, elegida: ExploradorVariable | undefined): string[] {
  const nombres = variables.map((v) => v.name);
  return valor && !elegida ? [valor, ...nombres] : nombres;
}

/** `true` si otra pregunta de la base se ve con el mismo texto (dos "distrito"). */
function textoRepetido(partes: ReadonlyMap<string, PartesDePregunta>, codigo: string, texto: string): boolean {
  const clave = normalizarBusqueda(texto.trim());
  for (const [otra, p] of partes) {
    // El texto de una pregunta sin etiqueta es su código: "distrito" se parece a la columna "distrito".
    const otroTexto = normalizarBusqueda((p.texto || otra).trim());
    if (otra !== codigo && otroTexto === clave) return true;
  }
  return false;
}
