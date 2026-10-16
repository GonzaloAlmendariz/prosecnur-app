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
  unidades: ["lista"],
  accesos: ["canales", "vinculacion"],
  catalogo: ["editor"],
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
};

/**
 * Secciones viejas → sección canónica. `paquete` cae en Paquetes: lo que hacía
 * era generar el PDF, que hoy es el armado del paquete.
 */
const ALIAS_SECCION: Record<string, RecopiladoresSeccion> = {
  // Secciones de Recopiladores (ADR 0046).
  "plan-recoleccion": "unidades",
  materiales: "catalogo",
  "entrega-campo": "entrega",
  // Secciones de Fichas QR.
  preparacion: "unidades",
  fichas: "catalogo",
  paquete: "paquetes",
  // El módulo se registraba con una única sección homónima.
  recopiladores: "unidades",
  // Nombre corto del ADR 0046, por si se escribe a mano.
  plan: "unidades",
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

  const seccion = seccionCanonica ?? seccionAlias;
  if (seccion) return { seccion, pestana: primeraPestana(seccion) };
  return DIRECCION_INICIAL;
}

/** `true` si la dirección de la URL ya está en forma canónica. */
export function esDireccionCanonica(
  seccionCruda?: string | null,
  pestanaCruda?: string | null,
): boolean {
  const seccion = (seccionCruda ?? "").trim().toLowerCase();
  const pestana = (pestanaCruda ?? "").trim().toLowerCase();
  if (!esSeccion(seccion)) return false;
  return (pestanasDe(seccion) as readonly string[]).includes(pestana);
}
