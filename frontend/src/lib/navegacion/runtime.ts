// Puente de introspección para el inspector visual: `window.__pulsoNav`.
//
// Sin esto, un runner de QA solo puede hacer dos cosas: hacer click sobre una
// etiqueta visible y esperar a ciegas. Las dos fallan por la misma razón —
// dependen de que la UI ya esté pintada y de que el copy no haya cambiado—, y
// entre las dos explican por qué el recorrido se caía a mitad de camino.
//
// Con este puente el runner:
//   1. pide `manifiesto` y sabe TODAS las vistas que existen,
//   2. llama `ir("monitoreo/territorial/avance")` y navega por dirección,
//   3. consulta `listo()` para saber cuándo terminó el warm start de verdad,
//   4. lee `paneles()` para alcanzar overlays que antes no eran enlazables.
//
// Se instala en dev y bajo QA visual. En producción no se expone.

import {
  describirDireccion,
  parsearDireccion,
  serializarDireccion,
  type DireccionProsecnur,
} from "./direccion";
import {
  MANIFIESTO_NAVEGACION,
  PANELES_POR_MODULO,
  hijosDe,
  nodoPorClave,
  recorridoCompleto,
  type NodoNavegacion,
} from "./manifiesto";
import { panelesMontados } from "./paneles";

export type EstadoListo = {
  listo: boolean;
  /** Motivo del "todavía no", para que el runner reporte en vez de adivinar. */
  motivo?: "warm-start" | "sin-marca-de-readiness" | "marca-en-false";
  marca?: string;
};

const SELECTOR_WARMUP = ".pulso-module-warmup";
const SELECTOR_READY = "[data-audit-ready]";

/**
 * Readiness real de la vista actual.
 *
 * La pantalla de warm start es la trampa histórica: capturar mientras está
 * arriba produce una vista que parece rota sin estarlo (contadores en cero,
 * "Pendiente" en el header). Aquí se distingue explícitamente de una vista que
 * simplemente no declara readiness.
 */
export function estadoListo(): EstadoListo {
  if (typeof document === "undefined") return { listo: false };
  if (document.querySelector(SELECTOR_WARMUP)) {
    return { listo: false, motivo: "warm-start" };
  }
  const marca = document.querySelector(SELECTOR_READY);
  if (!marca) return { listo: false, motivo: "sin-marca-de-readiness" };
  const valor = marca.getAttribute("data-audit-ready") ?? "";
  if (valor === "false") {
    return { listo: false, motivo: "marca-en-false", marca: valor };
  }
  return { listo: true, marca: valor };
}

// ---------------------------------------------------------------------------
// Pestañas declaradas en runtime
// ---------------------------------------------------------------------------
//
// El manifiesto enumera todas las pestañas posibles sin montar los perfiles.
// La vista activa registra el SUBCONJUNTO visible en el estado actual; por
// ejemplo, Telefónico > Consultas solo publica «Salvedades» cuando hay casos
// que la necesitan. Runtime sustituye al catálogo estático mientras la sección
// está montada, nunca agrega claves que el contrato no declare.

const PESTANAS_EN_RUNTIME = new Map<string, NodoNavegacion[]>();

function pestanasDeclaradasDeSeccion(claveSeccion: string): NodoNavegacion[] {
  return hijosDe(claveSeccion).filter((nodo) => nodo.nivel === "pestana");
}

/** Catálogo posible o, si la vista está montada, su subconjunto visible. */
export function pestanasDisponiblesDeSeccion(claveSeccion: string): NodoNavegacion[] {
  if (PESTANAS_EN_RUNTIME.has(claveSeccion)) {
    return PESTANAS_EN_RUNTIME.get(claveSeccion) ?? [];
  }
  return pestanasDeclaradasDeSeccion(claveSeccion);
}

export function registrarPestanasDeSeccion(
  claveSeccion: string,
  direccionSeccion: DireccionProsecnur,
  pestanas: ReadonlyArray<{ key: string; label: string }>,
): void {
  const claveDireccion = describirDireccion(direccionSeccion);
  if (claveDireccion !== claveSeccion) {
    throw new Error(
      `Registro runtime desalineado: ${claveSeccion} != ${claveDireccion}`,
    );
  }
  const declaradas = pestanasDeclaradasDeSeccion(claveSeccion);
  const porId = new Map(
    declaradas.map((nodo) => [nodo.direccion.pestana, nodo] as const),
  );
  const desconocidas = pestanas
    .map((pestana) => pestana.key)
    .filter((key) => !porId.has(key));

  if (desconocidas.length > 0) {
    throw new Error(
      `Pestañas runtime fuera del contrato en ${claveSeccion}: ${desconocidas.join(", ")}`,
    );
  }

  // Reutiliza los nodos estáticos: labels, hrefs e ids siguen teniendo un solo
  // dueño aunque la página enriquezca el rail con badges o readiness.
  PESTANAS_EN_RUNTIME.set(
    claveSeccion,
    pestanas.flatMap((pestana) => {
      const declarada = porId.get(pestana.key);
      return declarada ? [declarada] : [];
    }),
  );
}

export function olvidarPestanasDeSeccion(claveSeccion: string): void {
  PESTANAS_EN_RUNTIME.delete(claveSeccion);
}

export type NavegadorRuntime = (href: string) => void;

export type PuenteNavegacion = {
  version: 3;
  gramatica: "modulo/modo/seccion/pestana/panel";
  manifiesto: readonly NodoNavegacion[];
  recorrido: typeof recorridoCompleto;
  /** Dirección de la vista actual, o `null` si está fuera de la jerarquía. */
  direccion: () => DireccionProsecnur | null;
  describir: () => string | null;
  /** Nodos alcanzables desde la vista actual (manifiesto + runtime). */
  hijos: () => NodoNavegacion[];
  /** Pestañas de la sección actual, las declare quien las declare. */
  pestanasDeLaSeccion: () => NodoNavegacion[];
  /** Paneles declarados y los efectivamente montados ahora mismo. */
  paneles: () => {
    declarados: readonly unknown[];
    montados: ReturnType<typeof panelesMontados>;
  };
  listo: () => EstadoListo;
  /** Navega por clave (`monitoreo/territorial/avance`) o por dirección. */
  ir: (destino: string | DireccionProsecnur) => boolean;
};

declare global {
  interface Window {
    __pulsoNav?: PuenteNavegacion;
  }
}

function direccionActual(): DireccionProsecnur | null {
  if (typeof window === "undefined") return null;
  return parsearDireccion(window.location.pathname, window.location.search);
}

/**
 * Instala el puente. Devuelve la función de limpieza.
 *
 * `navegar` viene del router para que `ir()` haga una navegación real de la
 * SPA y no un reload: recargar perdería la sesión del proyecto y volvería a
 * pagar el warm start completo en cada salto del recorrido.
 */
export function instalarPuenteNavegacion(navegar: NavegadorRuntime): () => void {
  if (typeof window === "undefined") return () => undefined;

  const puente: PuenteNavegacion = {
    version: 3,
    gramatica: "modulo/modo/seccion/pestana/panel",
    manifiesto: MANIFIESTO_NAVEGACION,
    recorrido: recorridoCompleto,
    direccion: direccionActual,
    describir: () => {
      const direccion = direccionActual();
      return direccion ? describirDireccion(direccion) : null;
    },
    hijos: () => {
      const direccion = direccionActual();
      if (!direccion) return [];
      const clave = describirDireccion(direccion);
      return PESTANAS_EN_RUNTIME.has(clave)
        ? pestanasDisponiblesDeSeccion(clave)
        : hijosDe(clave);
    },
    // Hijas de la sección en la que estamos parados, aunque la dirección
    // apunte a una pestaña: es lo que el inspector necesita para recorrer las
    // hermanas sin volver a subir un nivel a mano.
    pestanasDeLaSeccion: () => {
      const direccion = direccionActual();
      if (!direccion) return [];
      const { pestana: _ignorada, panel: _tampoco, ...seccion } = direccion;
      return pestanasDisponiblesDeSeccion(describirDireccion(seccion));
    },
    paneles: () => ({
      declarados: Object.values(PANELES_POR_MODULO).flatMap(
        (lista) => lista ?? [],
      ),
      montados: panelesMontados(),
    }),
    listo: estadoListo,
    ir: (destino) => {
      const clave = typeof destino === "string"
        ? destino
        : describirDireccion(destino);
      const nodoDestino = nodoPorClave(clave) ??
        // Compatibilidad defensiva para contribuciones runtime antiguas.
        [...PESTANAS_EN_RUNTIME.values()]
          .flat()
          .find((nodo) => nodo.clave === clave) ??
        null;
      // Un nodo documental sin URL publicada puede existir en el árbol y en
      // la bóveda, pero el puente no debe fabricar el deep-link que la página
      // todavía no entiende. La regla aplica igual a claves y a objetos.
      if (nodoDestino && !nodoDestino.direccionPublicada) return false;
      const direccion = typeof destino === "string"
        ? nodoDestino?.direccion ?? null
        : destino;
      if (!direccion) return false;
      // Conserva el proyecto abierto: el `?pulso=` de dev no debe perderse al
      // saltar entre vistas durante un recorrido.
      const actual = direccionActual();
      navegar(
        serializarDireccion({
          ...direccion,
          proyecto: direccion.proyecto ?? actual?.proyecto,
        }),
      );
      return true;
    },
  };

  window.__pulsoNav = puente;
  return () => {
    if (window.__pulsoNav === puente) delete window.__pulsoNav;
  };
}
