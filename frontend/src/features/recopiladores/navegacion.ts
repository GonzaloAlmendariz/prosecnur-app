// Navegación de Material de campo (ADR 0108 §5; antes Recopiladores, ADR 0046)
// y el puente desde las claves que el módulo usó con sus nombres anteriores.
//
// Vive fuera de la página por dos razones. La primera es que la navegación de un
// módulo es un contrato, no un detalle de render: se testea sin montar React. La
// segunda es la regla de la casa de que un page-file grande no crece — cada
// pieza que sale de la página es una que ya no vuelve.
//
// Las claves viejas se LEEN como alias y nunca se ESCRIBEN: un enlace guardado
// con `/recopiladores?seccion=materiales&pestana=paquetes` sigue aterrizando
// donde debe, pero la app reescribe la dirección a la forma canónica.
//
// La carpeta conserva el nombre `recopiladores`: el renombre es del módulo, no
// del código que lo implementa.

export const SECCIONES = [
  "unidades",
  "accesos",
  "catalogo",
  "paquetes",
  "entrega",
] as const;
export type RecopiladoresSeccion = (typeof SECCIONES)[number];

export const PESTANAS_POR_SECCION = {
  // Lista es el aterrizaje; Origen dice de qué fuente sale y qué cambió (E1e).
  unidades: ["lista", "origen"],
  accesos: ["canales", "vinculacion"],
  // Tipos primero: es el aterrizaje de Catálogo (ADR 0109 §3). Correos es el
  // material de canal digital: se compone aquí y sale para Mailchimp (ADR 0110 §2).
  catalogo: ["tipos", "editor", "correos"],
  paquetes: ["armado"],
  entrega: ["traspaso"],
} as const satisfies Record<RecopiladoresSeccion, readonly string[]>;

export type RecopiladoresPestana =
  (typeof PESTANAS_POR_SECCION)[RecopiladoresSeccion][number];

export type DireccionRecopiladores = {
  seccion: RecopiladoresSeccion;
  pestana: RecopiladoresPestana;
};

/** Dónde aterriza el módulo cuando la dirección no dice nada. */
export const DIRECCION_INICIAL: DireccionRecopiladores = {
  seccion: "unidades",
  pestana: "lista",
};

/**
 * Pestañas viejas → dirección canónica. Cada una nombra su sección porque el
 * reparto cambió dos veces: `listado` era una pestaña de Fichas y hoy es la
 * vinculación entre unidad y acceso; `paquetes` era pestaña de Materiales y hoy
 * es una sección.
 */
const ALIAS_PESTANA: Record<string, DireccionRecopiladores> = {
  // Pestañas de Recopiladores (ADR 0046).
  unidades: { seccion: "unidades", pestana: "lista" },
  vista: { seccion: "catalogo", pestana: "editor" },
  paquetes: { seccion: "paquetes", pestana: "armado" },
  // Pestañas de Fichas QR.
  agenda: { seccion: "unidades", pestana: "lista" },
  enlaces: { seccion: "accesos", pestana: "canales" },
  listado: { seccion: "accesos", pestana: "vinculacion" },
  salida: { seccion: "paquetes", pestana: "armado" },
  retorno: { seccion: "entrega", pestana: "traspaso" },
  // Nombres cortos que un humano escribiría a mano en la barra de direcciones.
  // `validacion` apunta al traspaso mientras Entrega no tenga su propia
  // pestaña de verificación: crearla sin contenido sería una superficie vacía
  // inventada (C5).
  validacion: { seccion: "entrega", pestana: "traspaso" },
  monitoreo: { seccion: "entrega", pestana: "traspaso" },
  // Nombres que alguien escribiría a mano para llegar a los correos.
  correo: { seccion: "catalogo", pestana: "correos" },
  mailchimp: { seccion: "catalogo", pestana: "correos" },
};

/**
 * Secciones viejas → sección canónica. `paquete` cae en Paquetes: lo que hacía
 * era generar el PDF, que hoy es el armado del paquete.
 *
 * Materiales y Fichas nombran también la pestaña: aterrizaban en el editor de
 * la ficha y un enlace guardado debe seguir llevando ahí, no a la galería de
 * Tipos que Catálogo ganó después (ADR 0109).
 */
const ALIAS_SECCION: Record<string, RecopiladoresSeccion | DireccionRecopiladores> = {
  // Secciones de Recopiladores (ADR 0046).
  "plan-recoleccion": "unidades",
  materiales: { seccion: "catalogo", pestana: "editor" },
  "entrega-campo": "entrega",
  // Secciones de Fichas QR.
  preparacion: "unidades",
  fichas: { seccion: "catalogo", pestana: "editor" },
  paquete: "paquetes",
  // El módulo se registraba con una única sección homónima.
  recopiladores: "unidades",
  // Nombre corto del ADR 0046, por si se escribe a mano.
  plan: "unidades",
};

/**
 * Paneles que viven en una pestaña concreta. `rehacer-plan` se abría sobre la
 * lista; desde E1e la acción vive sólo en Origen, así que un enlace guardado
 * `?seccion=unidades&panel=rehacer-plan` aterriza ahí con el diálogo abierto.
 */
const PESTANA_DEL_PANEL: Readonly<Record<string, DireccionRecopiladores>> = {
  "rehacer-plan": { seccion: "unidades", pestana: "origen" },
};

function esSeccion(valor: string): valor is RecopiladoresSeccion {
  return (SECCIONES as readonly string[]).includes(valor);
}

function pestanasDe(seccion: RecopiladoresSeccion): readonly string[] {
  return PESTANAS_POR_SECCION[seccion];
}

function primeraPestana(seccion: RecopiladoresSeccion): RecopiladoresPestana {
  return pestanasDe(seccion)[0] as RecopiladoresPestana;
}

/**
 * Resuelve la dirección a partir de lo que traiga la URL, en el orden en que la
 * información es confiable: primero una pestaña conocida (dice sección y
 * pestaña), después la sección, y al final el aterrizaje por defecto.
 */
export function resolverDireccion(
  seccionCruda?: string | null,
  pestanaCruda?: string | null,
  panelCrudo?: string | null,
): DireccionRecopiladores {
  const delPanel = PESTANA_DEL_PANEL[(panelCrudo ?? "").trim().toLowerCase()];
  if (delPanel) {
    const base = resolverSinPanel(seccionCruda, pestanaCruda);
    if (base.seccion === delPanel.seccion) return delPanel;
    return base;
  }
  return resolverSinPanel(seccionCruda, pestanaCruda);
}

function resolverSinPanel(
  seccionCruda?: string | null,
  pestanaCruda?: string | null,
): DireccionRecopiladores {
  const seccionPedida = (seccionCruda ?? "").trim().toLowerCase();
  const pestanaPedida = (pestanaCruda ?? "").trim().toLowerCase();

  // Una sección canónica es una afirmación de la app; una sección vieja es solo
  // un enlace guardado. Solo la primera puede vetar el alias de la pestaña.
  const seccionCanonica = esSeccion(seccionPedida) ? seccionPedida : null;
  const seccionAlias = seccionCanonica ? null : ALIAS_SECCION[seccionPedida] ?? null;

  if (pestanaPedida) {
    if (
      seccionCanonica &&
      (pestanasDe(seccionCanonica) as readonly string[]).includes(pestanaPedida)
    ) {
      return { seccion: seccionCanonica, pestana: pestanaPedida as RecopiladoresPestana };
    }
    const alias = ALIAS_PESTANA[pestanaPedida];
    // La pestaña vieja es más específica que la sección vieja —`enlaces` dice
    // más que `preparacion`— así que manda mientras la URL no haya nombrado una
    // sección canónica distinta.
    if (alias && (!seccionCanonica || seccionCanonica === alias.seccion)) return alias;
  }

  if (seccionCanonica) return { seccion: seccionCanonica, pestana: primeraPestana(seccionCanonica) };
  if (seccionAlias) {
    return typeof seccionAlias === "string"
      ? { seccion: seccionAlias, pestana: primeraPestana(seccionAlias) }
      : seccionAlias;
  }
  return DIRECCION_INICIAL;
}

/** `true` si la dirección de la URL ya está en forma canónica. */
export function esDireccionCanonica(
  seccionCruda?: string | null,
  pestanaCruda?: string | null,
  panelCrudo?: string | null,
): boolean {
  const seccion = (seccionCruda ?? "").trim().toLowerCase();
  const pestana = (pestanaCruda ?? "").trim().toLowerCase();
  if (!esSeccion(seccion)) return false;
  if (!(pestanasDe(seccion) as readonly string[]).includes(pestana)) return false;
  const delPanel = PESTANA_DEL_PANEL[(panelCrudo ?? "").trim().toLowerCase()];
  return !delPanel || delPanel.seccion !== seccion || delPanel.pestana === pestana;
}
