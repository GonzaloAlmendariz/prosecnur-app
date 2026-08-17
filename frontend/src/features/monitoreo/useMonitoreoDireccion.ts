// Monitoreo ↔ dirección canónica.
//
// Monitoreo es el módulo con la jerarquía completa —modo, sección y pestaña—
// y era el único donde el tercer nivel no existía en la URL: la pestaña activa
// ("Resumen", "Mapa", "UMP"…) solo se podía alcanzar con un click sobre su
// etiqueta. Eso es lo que hacía imposible enlazar una vista profunda y lo que
// tumbaba al inspector visual a mitad de recorrido.
//
// Ahora los tres niveles viven en la URL:
//   /monitoreo?modo=territorial&seccion=avance&pestana=ump
//
// El modo se escribe, pero es DESCRIPTIVO, no una orden: lo determina el
// estudio del proyecto, no la navegación. Aparece en la URL para que la
// dirección sea completa —un enlace dice en qué modo esperaba aterrizar, y el
// inspector puede ubicarla en el manifiesto—. Abrir un enlace con un modo que
// no corresponde al proyecto aterriza igual en el modo real: el param informa,
// no manda.

import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PARAMS_DIRECCION, PARAMS_PROYECTO } from "../../lib/navegacion/direccion";
import type { MonitoreoSeccion } from "./core/monitoreoRegistry";

const SECCIONES: readonly MonitoreoSeccion[] = [
  "avance",
  "ocurrencias",
  "consultas",
  "modelo",
  "fuentes",
  "telefonico",
  "calidad",
];

// Alias por etiqueta visible. Sobreviven porque hay enlaces guardados y
// corridas de QA que los usan; la app nunca los escribe.
const ALIAS_SECCION: Record<string, MonitoreoSeccion> = {
  fuente: "fuentes",
  agenda: "modelo",
  "agenda de aulas": "modelo",
  umps: "modelo",
  ump: "modelo",
  "modelo operativo": "modelo",
  validacion: "calidad",
  consulta: "consultas",
  "consultas internas": "consultas",
  "avance territorial": "avance",
  "ocurrencias de campo": "ocurrencias",
  ocurrencia: "ocurrencias",
  "monitoreo telefonico": "telefonico",
  telefono: "telefonico",
  phone: "telefonico",
};

function normalizarToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Lee la sección pedida, aceptando el `?tab=` legacy. */
export function monitoreoSeccionDesdeParams(search: string): MonitoreoSeccion | null {
  const params = new URLSearchParams(search);
  const raw = params.get(PARAMS_DIRECCION.seccion) ?? params.get("tab");
  if (!raw) return null;
  const token = normalizarToken(raw);
  if ((SECCIONES as readonly string[]).includes(token)) {
    return token as MonitoreoSeccion;
  }
  return ALIAS_SECCION[token] ?? null;
}

/** Lee la pestaña pedida dentro de la sección. Sin alias: no los tuvo nunca. */
export function monitoreoPestanaDesdeParams(search: string): string | null {
  const raw = new URLSearchParams(search).get(PARAMS_DIRECCION.pestana);
  return raw ? normalizarToken(raw) : null;
}

/**
 * Sección inicial: la pedida por la URL si es válida en el modo actual, si no
 * el default del modo.
 */
export function seccionInicialMonitoreo(
  porDefecto: MonitoreoSeccion,
  secciones?: ReadonlyArray<{ key: MonitoreoSeccion }>,
): MonitoreoSeccion {
  if (typeof window === "undefined") return porDefecto;
  const pedida = monitoreoSeccionDesdeParams(window.location.search);
  if (!pedida) return porDefecto;
  if (secciones && !secciones.some((seccion) => seccion.key === pedida)) {
    return porDefecto;
  }
  return pedida;
}

/**
 * Pestaña inicial dentro de una sección.
 *
 * `disponibles` viene del catálogo de pestañas de la sección activa: pedir una
 * pestaña que no existe en esta sección cae al default en vez de dejar la
 * sección en un estado sin pestaña seleccionada.
 */
export function pestanaInicialMonitoreo(
  porDefecto: string,
  disponibles?: readonly string[],
): string {
  if (typeof window === "undefined") return porDefecto;
  const pedida = monitoreoPestanaDesdeParams(window.location.search);
  if (!pedida) return porDefecto;
  if (disponibles && !disponibles.includes(pedida)) return porDefecto;
  return pedida;
}

/**
 * Pestaña inicial de UNA sección concreta, cuando el módulo guarda la pestaña
 * de cada sección en un estado separado.
 *
 * `?pestana=` se refiere siempre a la sección con la que se aterriza: pedir
 * `seccion=avance&pestana=ritmo` no debe reescribir la pestaña recordada de
 * Fuentes ni de Calidad, que el usuario no pidió.
 */
export function pestanaInicialDeSeccion<T extends string>(
  seccionDeLaPestana: MonitoreoSeccion,
  seccionInicial: MonitoreoSeccion,
  porDefecto: T,
  disponibles: readonly string[],
): T {
  if (seccionDeLaPestana !== seccionInicial) return porDefecto;
  const pedida = pestanaInicialMonitoreo(porDefecto, disponibles);
  return pedida as T;
}

/** Callbacks con los que la vista sigue lo que pide la URL. */
export type SeguidoresDeUrl = {
  onSeccionPedida?: (seccion: MonitoreoSeccion) => void;
  onPestanaPedida?: (pestana: string, seccion: MonitoreoSeccion) => void;
};

export type AccionDeSeguimiento =
  | { tipo: "nada" }
  | { tipo: "ir-a-seccion"; seccion: MonitoreoSeccion }
  | { tipo: "ir-a-pestana"; pestana: string; seccion: MonitoreoSeccion };

/**
 * Qué hacer cuando cambia el `search`: seguir a la URL o quedarse quieto.
 *
 * Vive fuera del hook porque acá es donde estuvo el bug que rebotaba la vista.
 * `ultimaEscrita` es la URL que escribió esta misma vista; si la que llega es
 * esa, no hay nada que seguir. El rebote aparecía cuando lectura y escritura
 * miraban fuentes distintas —`useLocation` contra `history.replaceState`— y el
 * `search` del router quedaba viejo: se leía como una petición externa y
 * devolvía al usuario a la sección anterior, con el ciclo de renders que
 * traba clicks y scroll. Con las dos mitades sobre el router, esta función
 * decide bien.
 */
export function decidirSeguimiento(input: {
  search: string;
  ultimaEscrita: string | null;
  seccionActiva: MonitoreoSeccion;
  pestanaActiva?: string;
}): AccionDeSeguimiento {
  if (input.search === input.ultimaEscrita) return { tipo: "nada" };

  const seccionPedida = monitoreoSeccionDesdeParams(input.search);
  if (seccionPedida && seccionPedida !== input.seccionActiva) {
    // La pestaña de la URL pertenece a la sección pedida, no a la actual:
    // aplicarla ahora la metería en la sección equivocada. Llega en el
    // siguiente paso, ya con la sección correcta activa.
    return { tipo: "ir-a-seccion", seccion: seccionPedida };
  }

  const pestanaPedida = monitoreoPestanaDesdeParams(input.search);
  if (pestanaPedida && pestanaPedida !== input.pestanaActiva) {
    return {
      tipo: "ir-a-pestana",
      pestana: pestanaPedida,
      seccion: seccionPedida ?? input.seccionActiva,
    };
  }

  return { tipo: "nada" };
}

/**
 * Sincroniza en las dos direcciones la dirección canónica de Monitoreo.
 *
 * La vista sigue lo que pide la URL y la URL refleja la vista, las dos por el
 * router y con `replace` (sin ensuciar el historial). Escribe siempre la forma
 * canónica y limpia el `?tab=` legacy para que no queden dos params
 * compitiendo por decir lo mismo.
 */
export function useMonitoreoDireccion(
  seccionActiva: MonitoreoSeccion,
  pestanaActiva?: string,
  modoActivo?: string,
  seguirUrl?: SeguidoresDeUrl,
): void {
  const location = useLocation();
  const navigate = useNavigate();
  // Última URL que escribimos nosotros. Sirve para distinguir "la vista movió
  // la URL" de "alguien movió la URL" — sin eso, cada escritura propia se
  // leería como una petición externa y el efecto entraría en bucle.
  const ultimaEscrita = useRef<string | null>(null);

  // Las páginas de perfil pasan los callbacks inline, así que su identidad
  // cambia en cada render. Guardarlos en una ref mantiene el efecto atado a lo
  // único que debe dispararlo —la URL y la vista activa— en vez de correr en
  // cada render.
  const seguidores = useRef(seguirUrl);
  seguidores.current = seguirUrl;

  // La URL manda: `window.__pulsoNav.ir(...)`, un enlace pegado o el botón
  // Atrás cambian el `search`, y la vista tiene que seguirlo. Antes la página
  // solo leía la URL al montarse, así que navegar por dirección reescribía la
  // barra sin mover la vista: la URL quedaba mintiendo.
  useEffect(() => {
    const { onSeccionPedida, onPestanaPedida } = seguidores.current ?? {};
    if (!onSeccionPedida && !onPestanaPedida) return;

    const accion = decidirSeguimiento({
      search: location.search,
      ultimaEscrita: ultimaEscrita.current,
      seccionActiva,
      pestanaActiva,
    });

    if (accion.tipo === "ir-a-seccion") onSeccionPedida?.(accion.seccion);
    else if (accion.tipo === "ir-a-pestana") {
      onPestanaPedida?.(accion.pestana, accion.seccion);
    }
  }, [location.search, seccionActiva, pestanaActiva]);

  // La escritura va POR EL ROUTER, no por `history.replaceState`.
  //
  // `replaceState` cambia la barra de direcciones a espaldas de React Router:
  // el `useLocation` de arriba se queda con el `search` viejo, lo lee como una
  // petición externa y devuelve la vista a la sección anterior. Ese rebote
  // —además del ciclo de renders que dispara, que traba clicks y scroll— es
  // exactamente lo que pasa si las dos mitades de esta sincronización no miran
  // la misma fuente. Las dos miran el router.
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const modoYa = modoActivo
      ? params.get(PARAMS_DIRECCION.modo) === modoActivo
      : true;
    const seccionYa = params.get(PARAMS_DIRECCION.seccion) === seccionActiva;
    const pestanaYa = pestanaActiva
      ? params.get(PARAMS_DIRECCION.pestana) === pestanaActiva
      : !params.has(PARAMS_DIRECCION.pestana);
    if (modoYa && seccionYa && pestanaYa && !params.has("tab")) return;

    if (modoActivo) params.set(PARAMS_DIRECCION.modo, modoActivo);
    params.set(PARAMS_DIRECCION.seccion, seccionActiva);
    if (pestanaActiva) params.set(PARAMS_DIRECCION.pestana, pestanaActiva);
    else params.delete(PARAMS_DIRECCION.pestana);
    params.delete("tab");
    // BootGate ya sacó el `?pulso=` con `replaceState`, a espaldas del router:
    // su `location.search` todavía lo trae. Sin esta línea, la primera
    // escritura por router lo devolvería a la barra de direcciones.
    for (const param of PARAMS_PROYECTO) params.delete(param);

    const query = params.toString();
    const search = query ? `?${query}` : "";
    ultimaEscrita.current = search;
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [
    modoActivo,
    seccionActiva,
    pestanaActiva,
    location.pathname,
    location.search,
    navigate,
  ]);
}

/**
 * El `foco` de la dirección: qué entidad está seleccionada dentro de la vista.
 *
 * Vive aquí y no en la página por el contrato de `lectoresDeDireccion`: leer la
 * dirección a mano —`useSearchParams` incluido— está reservado a los seis
 * lectores heredados, y este archivo es uno de ellos. La página de aulas lo
 * hacía por su cuenta desde que el foco de cuotas pasó a la URL, y eso la
 * convertía en el séptimo lector, que es justo lo que el contrato existe para
 * impedir.
 *
 * `foco` es ortogonal a los cinco niveles —no lo escribe `irA`, que sólo mueve
 * modo, sección, pestaña y panel— y por eso necesita su propio par de accesos.
 * Se escribe con `replace`: elegir un corte no es navegar, y no debe llenar el
 * historial con un paso por cada click.
 */
export function useFocoMonitoreo(): [string | null, (valor: string | null) => void] {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const foco = params.get(PARAMS_DIRECCION.foco);

  const escribir = useCallback((valor: string | null) => {
    const siguientes = new URLSearchParams(location.search);
    if (valor) siguientes.set(PARAMS_DIRECCION.foco, valor);
    else siguientes.delete(PARAMS_DIRECCION.foco);
    const query = siguientes.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ""}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return [foco && foco.trim() ? foco : null, escribir];
}
