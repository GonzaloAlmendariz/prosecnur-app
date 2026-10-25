/**
 * Traducción entre la dirección pública de un modo de Monitoreo y las vistas
 * que su página monta por dentro.
 *
 * Por qué existe. El revamp de Monitoreo (2026-10-23) reordenó cada modo en el
 * esqueleto común de cuatro secciones —Insumos, Modelo, Control y Avance—. Las
 * páginas de los perfiles están congeladas a crecimiento y saben montar sus
 * vistas por la clave histórica (`consultas/subsanacion`, `telefonico/dia`…).
 * Mientras una pestaña nueva no tiene contenido propio, monta la vista que
 * absorbe; así la navegación cambia sin perder ninguna capacidad.
 *
 * Es la forma general de `profiles/telefonico/navegacion/direccionTelefonica.ts`
 * (el primer modo que la necesitó): una tabla, no una cadena de `if`. Cada
 * vista interna tiene exactamente una dirección pública, y cada dirección
 * pública una vista. Cuando una pestaña absorbe más de una vista, las demás
 * cuelgan de ella como `panel`.
 *
 * Las claves históricas se LEEN como alias —hay enlaces guardados y corridas de
 * QA que las usan— y nunca se escriben.
 *
 * Las pestañas condicionales (las que existen solo si el estudio declara una
 * capacidad) se resuelven con `disponible`: una dirección a una pestaña que el
 * proyecto no tiene aterriza en la primera disponible de su sección.
 */

export type VistaInterna = {
  seccion: string;
  pestana: string;
};

export type DireccionPublica<S extends string> = {
  seccion: S;
  pestana: string;
  /** Sub-vista de una pestaña que absorbe varias; `null` es la principal. */
  panel: string | null;
};

/** Lo que la URL pide, ya normalizado; cualquiera de los tres puede faltar. */
export type DireccionPedida = {
  seccion: string | null;
  pestana: string | null;
  panel: string | null;
};

export type EntradaDeTabla<S extends string> = {
  publica: DireccionPublica<S>;
  interna: VistaInterna;
  /** Rótulo de la sub-vista, sólo cuando la pestaña tiene más de una. */
  vista?: string;
};

export function entradaDeTabla<S extends string>(
  seccion: S,
  pestana: string,
  panel: string | null,
  interna: VistaInterna,
  vista?: string,
): EntradaDeTabla<S> {
  return { publica: { seccion, pestana, panel }, interna, vista };
}

/** ¿Existe en este proyecto la pestaña pública? Sin predicado, todas existen. */
export type Disponible = (seccion: string, pestana: string) => boolean;

const SIEMPRE: Disponible = () => true;

export type ConfiguracionDeTabla<S extends string> = {
  /** Secciones públicas, en el orden de la barra. */
  secciones: readonly S[];
  /** Secciones que la página monta por dentro. */
  seccionesInternas: readonly string[];
  /** La tabla, en el orden del catálogo; dentro de una pestaña, la primera es la principal. */
  tabla: readonly EntradaDeTabla<S>[];
  /** Vistas internas que la página conserva sin dirección propia: se leen como su sustituta. */
  ocultas?: Readonly<Record<string, VistaInterna>>;
  /** Vista de cada sección interna cuando la dirección vieja no trae pestaña. */
  internaPorDefecto: Readonly<Record<string, VistaInterna>>;
  /** Donde aterriza el modo sin dirección. */
  aterrizaje: VistaInterna;
  /** Paneles superpuestos (`usePanelDireccionable`) de cada pestaña pública, por `seccion/pestana`. */
  superpuestos?: Readonly<Record<string, readonly string[]>>;
  /** Paneles de sub-vistas retiradas: se leen y la dirección se limpia al escribir. */
  panelesRetirados?: readonly string[];
};

function mismaVista(a: VistaInterna, b: VistaInterna) {
  return a.seccion === b.seccion && a.pestana === b.pestana;
}

const SIN_PANELES: readonly string[] = [];

export function crearTablaDeDirecciones<S extends string>(config: ConfiguracionDeTabla<S>) {
  const { secciones, seccionesInternas, tabla, aterrizaje } = config;
  const ocultas = config.ocultas ?? {};
  const superpuestos = config.superpuestos ?? {};

  const esSeccion = (valor: string | null): valor is S => (
    valor != null && (secciones as readonly string[]).includes(valor)
  );
  const esSeccionInterna = (valor: string | null): valor is string => (
    valor != null && seccionesInternas.includes(valor)
  );

  const panelesDeSubvista: readonly string[] = tabla
    .map((item) => item.publica.panel)
    .filter((panel): panel is string => Boolean(panel));

  function direccionDeVista(vista: VistaInterna): DireccionPublica<S> {
    const directa = tabla.find((item) => mismaVista(item.interna, vista));
    if (directa) return directa.publica;
    const oculta = ocultas[`${vista.seccion}/${vista.pestana}`];
    const sustituta = oculta ? tabla.find((item) => mismaVista(item.interna, oculta)) : null;
    if (sustituta) return sustituta.publica;
    const destino = tabla.find((item) => mismaVista(item.interna, aterrizaje));
    if (destino) return destino.publica;
    return tabla[0].publica;
  }

  function pestanasDeSeccion(seccion: S): string[] {
    return [...new Set(tabla.filter((item) => item.publica.seccion === seccion).map((item) => item.publica.pestana))];
  }

  function vistaPrincipal(seccion: S, pestana: string): VistaInterna | null {
    return tabla.find((item) => item.publica.seccion === seccion
      && item.publica.pestana === pestana
      && item.publica.panel == null)?.interna ?? null;
  }

  function vistaDeSeccion(seccion: S, disponible: Disponible = SIEMPRE): VistaInterna {
    const primera = pestanasDeSeccion(seccion).find((pestana) => disponible(seccion, pestana));
    return (primera ? vistaPrincipal(seccion, primera) : null) ?? aterrizaje;
  }

  function subvistasDePestana(seccion: S, pestana: string): Array<{ panel: string | null; etiqueta: string; interna: VistaInterna }> {
    const propias = tabla.filter((item) => item.publica.seccion === seccion && item.publica.pestana === pestana);
    if (propias.length < 2) return [];
    return propias.map((item) => ({
      panel: item.publica.panel,
      etiqueta: item.vista ?? item.publica.pestana,
      interna: item.interna,
    }));
  }

  /** La vista pedida sin mirar disponibilidad. */
  function vistaPedidaCruda(pedida: DireccionPedida): VistaInterna | null {
    const { seccion, pestana, panel } = pedida;
    if (!seccion) return null;

    if (esSeccion(seccion)) {
      if (pestana) {
        const exacta = tabla.find((item) => item.publica.seccion === seccion
          && item.publica.pestana === pestana
          && item.publica.panel === (panel && panelesDeSubvista.includes(panel) ? panel : null));
        if (exacta) return exacta.interna;
        const principal = vistaPrincipal(seccion, pestana);
        if (principal) return principal;
        // Sección nueva con una pestaña histórica: vale si esa vista vive en esta sección.
        const historica = tabla.find((item) => item.publica.seccion === seccion && item.interna.pestana === pestana);
        if (historica) return historica.interna;
      }
      // Una sección que existe en las dos arquitecturas resuelve su pestaña histórica abajo.
      if (!pestana || !esSeccionInterna(seccion)) return vistaDeSeccion(seccion);
    }

    if (esSeccionInterna(seccion)) {
      if (pestana) {
        const vista = { seccion, pestana };
        if (tabla.some((item) => mismaVista(item.interna, vista))) return vista;
        const oculta = ocultas[`${seccion}/${pestana}`];
        if (oculta) return oculta;
      }
      if (esSeccion(seccion)) return vistaDeSeccion(seccion);
      return config.internaPorDefecto[seccion] ?? aterrizaje;
    }

    return null;
  }

  /**
   * La vista que pide una dirección, aceptando la forma pública y las claves
   * históricas. `null` cuando la dirección no pide nada de este modo: quien
   * llama decide si aterriza. Una pestaña que el proyecto no tiene cede su
   * lugar a la primera disponible de su sección.
   */
  function vistaPedida(pedida: DireccionPedida, disponible: Disponible = SIEMPRE): VistaInterna | null {
    const vista = vistaPedidaCruda(pedida);
    if (!vista) return null;
    const publica = direccionDeVista(vista);
    if (disponible(publica.seccion, publica.pestana)) return vista;
    return vistaDeSeccion(publica.seccion, disponible);
  }

  function vistaInicial(pedida: DireccionPedida, disponible: Disponible = SIEMPRE): VistaInterna {
    return vistaPedida(pedida, disponible) ?? aterrizaje;
  }

  function pideOtraVista(pedida: DireccionPedida, activa: VistaInterna, disponible: Disponible = SIEMPRE): boolean {
    const vista = vistaPedida(pedida, disponible);
    return vista != null && !mismaVista(vista, activa);
  }

  function vistaDeSeccionPedida(seccion: string, disponible: Disponible = SIEMPRE): VistaInterna {
    return esSeccion(seccion) ? vistaDeSeccion(seccion, disponible) : aterrizaje;
  }

  function panelesSuperpuestos(seccion: string, pestana: string): readonly string[] {
    return superpuestos[`${seccion}/${pestana}`] ?? SIN_PANELES;
  }

  const panelesDelPerfil: readonly string[] = [
    ...panelesDeSubvista,
    ...(config.panelesRetirados ?? []),
    ...new Set(Object.values(superpuestos).flat()),
  ];

  return {
    secciones,
    aterrizaje,
    panelesDeSubvista,
    panelesDelPerfil,
    esSeccion,
    direccionDeVista,
    pestanasDeSeccion,
    vistaPrincipal,
    vistaDeSeccion,
    subvistasDePestana,
    vistaPedida,
    vistaInicial,
    pideOtraVista,
    vistaDeSeccionPedida,
    panelesSuperpuestos,
  };
}

/**
 * La pestaña interna con que arranca una sección de la página: la de la vista
 * de entrada si es de esa sección, si no la que la sección trae por defecto.
 */
export function pestanaDeEntrada<T extends string>(entrada: VistaInterna, seccion: string, porDefecto: T): T {
  return entrada.seccion === seccion ? entrada.pestana as T : porDefecto;
}
