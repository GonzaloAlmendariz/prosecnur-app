import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Flag,
  BookOpenText,
  Search,
  X,
} from "../../../vendor/lucide-react";

import type { BitacoraEstado } from "../../../api/bitacora";
import type { BitacoraTipoDestino } from "../../../api/planTrabajo";
import { aplanarArbol, arbolReferenciable, resolverDestino, type NodoApp } from "../arbolDeLaApp";
import "./canvas.css";

export type ReferenciaElegida = {
  target_type: Extract<BitacoraTipoDestino, "modulo" | "tarea" | "entrada">;
  target_id: string;
  /**
   * Título al momento de insertar. No se usa para pintar el nodo —eso lo hace
   * `resumenVivo` en cada render— sino como respaldo: si borran el destino, el
   * nodo puede decir «apuntaba a Campo» en vez de escupir un uuid.
   */
  titulo: string;
};

/**
 * Explorador de lo que se puede referenciar en el lienzo (ADR 0047).
 *
 * Se RECORRE, no se busca a ciegas: eliges un módulo y ves sus ramificaciones
 * —sus modos y sus secciones—, entras en una y ves sus pestañas. Es la misma
 * jerarquía del ADR 0044, que es la que el usuario ya tiene en la cabeza porque
 * es la que usa todos los días.
 *
 * La primera versión era una lista plana de 25 entradas. Perdía dos niveles
 * enteros: las 34 secciones de los 9 modos y las 14 pestañas quedaban fuera, así
 * que Monitoreo territorial o Procesamiento · Carga · Fuentes no se podían
 * poner en el mapa.
 *
 * SELECCIÓN MÚLTIPLE. Armar una ramificación es traer varias piezas juntas, no
 * abrir el panel seis veces. Lo marcado se acumula al bajar y subir por el
 * árbol, y al insertar el lienzo dibuja también las aristas que las unen: eso
 * es lo que convierte un puñado de tarjetas en una ramificación.
 *
 * La búsqueda sigue estando, pero como atajo: cuando ya sabes el nombre, no
 * tienes por qué recorrer.
 */
export function ExploradorDeReferencias({
  estado,
  onElegir,
  onCerrar,
}: {
  estado: BitacoraEstado;
  onElegir: (refs: ReferenciaElegida[]) => void;
  onCerrar: () => void;
}) {
  const [rama, setRama] = useState<NodoApp[]>([]);
  const [marcadas, setMarcadas] = useState<Map<string, ReferenciaElegida>>(new Map());
  const [texto, setTexto] = useState("");
  const [cursor, setCursor] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);

  const actual = rama[rama.length - 1] ?? null;
  const buscando = texto.trim().length > 0;

  /** Lo que se ve ahora: el resultado de la búsqueda o el nivel actual. */
  const filas = useMemo<Fila[]>(() => {
    if (buscando) {
      const q = normalizar(texto);
      const piezas = aplanarArbol()
        .filter((n) => normalizar(n.ruta).includes(q))
        .slice(0, 40)
        .map(filaDePieza);
      return [...piezas, ...filasDelProyecto(estado, q)].slice(0, 60);
    }
    if (!actual) {
      // Raíz: los módulos, más el material del proyecto como dos ramas propias.
      return [
        ...arbolReferenciable().map(filaDePieza),
        ramaDelProyecto("hitos", "Hitos del cronograma", estado.plan.tasks.filter((t) => !t.archived_at).length),
        ramaDelProyecto("entradas", "Entradas de bitácora", estado.bitacora.filter((e) => !e.archived_at).length),
      ];
    }
    if (actual.clave === "@hitos") {
      return estado.plan.tasks
        .filter((t) => !t.archived_at)
        .map((t) => filaSuelta("tarea", t.id, t.activity, t.start_date || "sin fecha"));
    }
    if (actual.clave === "@entradas") {
      return estado.bitacora
        .filter((e) => !e.archived_at)
        .map((e) => filaSuelta("entrada", e.id, e.title, e.tone));
    }
    return actual.hijos.map(filaDePieza);
  }, [actual, buscando, estado, texto]);

  useEffect(() => {
    setCursor(0);
  }, [texto, rama]);

  useEffect(() => {
    listaRef.current?.querySelector('[data-activo="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor, filas]);

  const alternar = useCallback((fila: Fila) => {
    setMarcadas((previas) => {
      const siguiente = new Map(previas);
      if (siguiente.has(fila.clave)) siguiente.delete(fila.clave);
      else siguiente.set(fila.clave, { target_type: fila.tipo, target_id: fila.destino, titulo: fila.label });
      return siguiente;
    });
  }, []);

  const entrar = useCallback(
    (fila: Fila) => {
      if (!fila.tieneHijos) return;
      const nodo =
        fila.clave.startsWith("@")
          ? ({ clave: fila.clave, nivel: "modulo", label: fila.label, ruta: fila.label, icono: null, href: "", moduloSlug: "", vars: undefined, hijos: [] } as NodoApp)
          : resolverDestino(fila.destino);
      if (nodo) setRama((r) => [...r, nodo]);
      setTexto("");
    },
    [],
  );

  function alTeclear(event: React.KeyboardEvent) {
    if (event.key === "Escape") return onCerrar();
    const fila = filas[Math.min(cursor, filas.length - 1)];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const paso = event.key === "ArrowDown" ? 1 : -1;
      setCursor((c) => (c + paso + filas.length) % Math.max(filas.length, 1));
    } else if (event.key === "ArrowRight" && fila?.tieneHijos) {
      event.preventDefault();
      entrar(fila);
    } else if (event.key === "ArrowLeft" && rama.length) {
      event.preventDefault();
      setRama((r) => r.slice(0, -1));
    } else if (event.key === " " && fila) {
      event.preventDefault();
      alternar(fila);
    } else if (event.key === "Enter" && fila) {
      event.preventDefault();
      // Enter sobre una rama entra; sobre una hoja, inserta lo marcado más ella.
      if (fila.tieneHijos && !marcadas.has(fila.clave)) entrar(fila);
      else insertar(fila);
    }
  }

  function insertar(extra?: Fila) {
    const salida = [...marcadas.values()];
    if (extra && !marcadas.has(extra.clave)) {
      salida.push({ target_type: extra.tipo, target_id: extra.destino, titulo: extra.label });
    }
    if (salida.length) onElegir(salida);
  }

  return (
    <div className="bcanvas-explorador" role="dialog" aria-label="Referenciar en el lienzo">
      <div className="bcanvas-explorador-cabecera">
        <button
          type="button"
          className="bcanvas-explorador-atras"
          onClick={() => setRama((r) => r.slice(0, -1))}
          disabled={!rama.length || buscando}
          aria-label="Volver al nivel anterior"
        >
          <ChevronLeft size={15} />
        </button>
        <label className="bcanvas-selector-busqueda">
          <Search size={13} aria-hidden="true" />
          <span className="pulso-sr-only">Buscar en toda la app, los hitos y las entradas</span>
          <input
            autoFocus
            type="search"
            value={texto}
            placeholder={actual ? `Buscar en toda la app…` : "Módulo, sección, pestaña, hito o entrada"}
            role="combobox"
            aria-expanded
            aria-controls="bcanvas-explorador-lista"
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={(event) => {
              // El lienzo escucha teclas sueltas (N, C, flechas): sin esto,
              // buscar «nota» crearía nodos mientras se escribe.
              event.stopPropagation();
              alTeclear(event);
            }}
          />
        </label>
        <button type="button" onClick={onCerrar} aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>

      {/* Migas: dónde estoy y cómo vuelvo. Sin esto, tres niveles adentro no se
          sabe si «Avance» es el de territorial o el de telefónico. */}
      <nav className="bcanvas-migas" aria-label="Ruta en el árbol de la app">
        <button type="button" onClick={() => setRama([])} disabled={!rama.length}>
          Toda la app
        </button>
        {rama.map((n, i) => (
          <span key={n.clave}>
            <ChevronRight size={11} aria-hidden="true" />
            <button type="button" onClick={() => setRama((r) => r.slice(0, i + 1))}>
              {n.label}
            </button>
          </span>
        ))}
      </nav>

      {filas.length === 0 ? (
        <p className="bcanvas-selector-vacio">
          {buscando ? "Nada calza con esa búsqueda." : "Esta rama no tiene nada debajo."}
        </p>
      ) : (
        <ul
          className="bcanvas-explorador-lista"
          id="bcanvas-explorador-lista"
          ref={listaRef}
          role="listbox"
          aria-multiselectable
        >
          {filas.map((f, i) => {
            const Icono = f.icono;
            const marcada = marcadas.has(f.clave);
            return (
              <li key={f.clave} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={marcada}
                  data-activo={i === Math.min(cursor, filas.length - 1)}
                  className={marcada ? "is-marcada" : undefined}
                  style={f.vars}
                  onClick={() => (f.tieneHijos ? entrar(f) : alternar(f))}
                >
                  <span
                    className="bcanvas-explorador-marca"
                    role="checkbox"
                    aria-checked={marcada}
                    aria-label={`Marcar ${f.label}`}
                    tabIndex={-1}
                    onClick={(event) => {
                      // Marcar una rama sin entrar en ella: se puede querer el
                      // módulo entero y además dos de sus secciones.
                      event.stopPropagation();
                      alternar(f);
                    }}
                  >
                    {marcada ? <Check size={11} /> : null}
                  </span>
                  <span className="bcanvas-selector-sello" aria-hidden="true">
                    {Icono ? <Icono size={13} /> : null}
                  </span>
                  <span className="bcanvas-selector-titulo">{f.label}</span>
                  <small>{buscando ? f.contexto : f.nota}</small>
                  {f.tieneHijos ? <ChevronRight size={12} aria-hidden="true" /> : <span />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="bcanvas-explorador-pie">
        <span>
          {marcadas.size === 0
            ? "Marca las piezas que quieres traer"
            : `${marcadas.size} ${marcadas.size === 1 ? "pieza marcada" : "piezas marcadas"}`}
        </span>
        <button
          type="button"
          className="is-primario"
          disabled={marcadas.size === 0}
          onClick={() => insertar()}
        >
          Insertar
        </button>
      </footer>
    </div>
  );
}

type Fila = {
  clave: string;
  tipo: ReferenciaElegida["target_type"];
  destino: string;
  label: string;
  /** Ruta completa, para desambiguar en los resultados de búsqueda. */
  contexto: string;
  /** Qué hay debajo, en el recorrido normal. */
  nota: string;
  icono: LucideIconONull;
  vars: NodoApp["vars"];
  tieneHijos: boolean;
};

type LucideIconONull = NodoApp["icono"];

function filaDePieza(n: NodoApp): Fila {
  return {
    clave: n.clave,
    tipo: "modulo",
    destino: n.clave,
    label: n.label,
    contexto: n.ruta,
    nota: n.hijos.length ? `${n.hijos.length} ${etiquetaNivelHijo(n)}` : etiquetaNivel(n.nivel),
    icono: n.icono,
    vars: n.vars,
    tieneHijos: n.hijos.length > 0,
  };
}

function ramaDelProyecto(id: string, label: string, cuantos: number): Fila {
  return {
    clave: `@${id}`,
    tipo: "modulo",
    destino: `@${id}`,
    label,
    contexto: label,
    nota: `${cuantos}`,
    icono: id === "hitos" ? Flag : BookOpenText,
    vars: undefined,
    tieneHijos: cuantos > 0,
  };
}

function filaSuelta(
  tipo: "tarea" | "entrada",
  id: string,
  label: string,
  nota: string,
): Fila {
  return {
    clave: `${tipo}:${id}`,
    tipo,
    destino: id,
    label: label || "(sin título)",
    contexto: tipo === "tarea" ? "Hito del cronograma" : "Entrada de bitácora",
    nota,
    icono: tipo === "tarea" ? Flag : BookOpenText,
    vars: undefined,
    tieneHijos: false,
  };
}

function filasDelProyecto(estado: BitacoraEstado, q: string): Fila[] {
  const hitos = estado.plan.tasks
    .filter((t) => !t.archived_at && normalizar(t.activity).includes(q))
    .map((t) => filaSuelta("tarea", t.id, t.activity, t.start_date || "sin fecha"));
  const entradas = estado.bitacora
    .filter((e) => !e.archived_at && normalizar(e.title).includes(q))
    .map((e) => filaSuelta("entrada", e.id, e.title, e.tone));
  return [...hitos, ...entradas];
}

function etiquetaNivel(nivel: NodoApp["nivel"]): string {
  if (nivel === "modulo") return "módulo";
  if (nivel === "modo") return "modo";
  if (nivel === "seccion") return "sección";
  return "pestaña";
}

function etiquetaNivelHijo(n: NodoApp): string {
  const hijo = n.hijos[0]?.nivel;
  const plural = n.hijos.length !== 1;
  if (hijo === "modo") return plural ? "ramas" : "rama";
  if (hijo === "seccion") return plural ? "secciones" : "sección";
  if (hijo === "pestana") return plural ? "pestañas" : "pestaña";
  return plural ? "piezas" : "pieza";
}

function normalizar(v: string): string {
  return (v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
