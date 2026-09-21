import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import { filasAlfabeticas } from "./metasDeLaPestana";
import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";
import "./aulasMetas.css";
import { etiquetaDeValorEnGrafico, etiquetaDelEje, type EjeDeclarado } from "./etiquetaDelEje";

/** El ancho nominal de una columna, con las facultades de referencia en una fila. */
const GRUPO = 62;
/** Las quince facultades del estudio: el lienzo se dimensiona contra este caso. */
const FACULTADES_DE_REFERENCIA = 15;
/**
 * **Desde nueve facultades el gráfico se parte en dos filas.**
 *
 * Él, el 2026-09-10: «que sea robusto: eso no pasa siempre, pasa que haya más
 * de 8 facultades en adelante y se parte a la mitad a partir de allí». El
 * umbral es el conteo, no este estudio: un marco de seis facultades sigue
 * entrando en una sola fila y no paga el corte.
 */
const UMBRAL_DOS_FILAS = 8;
/** Alto de las barras de UNA fila, en unidades del viewBox. */
const UTIL_FILA = 158;
/** Cuánto puede engordar una columna cuando hay pocas facultades. */
const ENGORDE_MAXIMO = 4;
const MARGEN = { arriba: 22, abajo: 6, izq: 42, der: 8 };

/**
 * **El rótulo se reparte por ANCHO MEDIDO, no por número de caracteres.**
 *
 * Con el tope en trece caracteres las etiquetas se pisaban unas con otras en
 * pantalla: la columna mide 62 unidades del viewBox y «ARQUITECTURA» medía
 * 78,6 — un 27 % de más. Medido el 2026-09-10 con `getComputedTextLength()`
 * sobre el gráfico vivo de las quince facultades. Contar caracteres no podía
 * verlo porque una «I» y una «M» no ocupan lo mismo.
 *
 * La tabla son fracciones del tamaño de letra, de esa misma medición; lo que
 * no está listado usa el típico de una mayúscula. La estimación queda un pelo
 * por encima de la real (81,6 frente a 78,6 en el peor caso), que es el lado
 * correcto por el que equivocarse: sobra aire, no falta.
 */
const ANCHO_DE_GLIFO: Readonly<Record<string, number>> = {
  " ": 0.28, ",": 0.28, ".": 0.28, "·": 0.35, "-": 0.35,
  I: 0.3, J: 0.55, L: 0.62, M: 0.86, W: 0.9, Y: 0.68,
};
const ANCHO_TIPICO = 0.68;
/** El tamaño del rótulo, `--aulas-min`, en unidades del viewBox. */
const FUENTE_ROTULO = 10;
/** Aire entre el rótulo y el de al lado, para que no se toquen. */
const AIRE = 4;
/**
 * **Hasta CINCO filas, no dos** (Gonzalo, 2026-09-10: «el eje puede tener más
 * de dos filas hasta 5 con tal de que entre bien»).
 *
 * Se gastan en dos líneas por rótulo y dos alturas escalonadas: cuatro. La
 * quinta queda de margen. Escalonar es lo que compra el ancho — un rótulo
 * suelto no cabe en su columna ni partiendo palabras, porque «URBANISMO» y
 * «CONTABLES» ya se salen ellas solas.
 */
const MAX_LINEAS = 2;
/** Alto de cada línea del rótulo, en unidades del viewBox. */
const ALTO_LINEA = 11;

/** Lo que mide un texto, en unidades del viewBox, sin pintarlo. */
export function anchoDeTexto(texto: string, fuente = FUENTE_ROTULO): number {
  let unidades = 0;
  for (const c of String(texto ?? "")) unidades += ANCHO_DE_GLIFO[c] ?? ANCHO_TIPICO;
  return unidades * fuente;
}

/**
 * El nombre de una facultad repartido en líneas que caben en `disponible`.
 *
 * **Contraer antes de partir.** «CIENCIAS Y ARTES DE LA COMUN.» son veintiocho
 * caracteres; las palabras vacías —«Y», «E», «DE», «LA»— se van porque no distinguen
 * una facultad de otra, que es para lo que sirve el rótulo. Lo que aun así no
 * entra se corta con puntos suspensivos y el nombre entero queda en el `title`.
 */
export function enLineas(
  nombre: string, disponible: number, maxLineas = MAX_LINEAS, fuente = FUENTE_ROTULO,
): string[] {
  const palabras = String(nombre ?? "").trim().split(/\s+/)
    .filter((p) => p && !["Y", "E", "DE", "LA", "EL", "LAS", "LOS", "DEL"].includes(p.toUpperCase()));
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    if (!actual) actual = p;
    else if (anchoDeTexto(`${actual} ${p}`, fuente) <= disponible) actual = `${actual} ${p}`;
    else if (lineas.length + 1 < maxLineas) { lineas.push(actual); actual = p; }
    else { actual = `${actual} ${p}`; }
  }
  if (actual) lineas.push(actual);
  return lineas.slice(0, maxLineas).map((linea) => recortaAlAncho(linea, disponible, fuente));
}

/** Recorta con puntos suspensivos sólo lo que de verdad se sale. */
function recortaAlAncho(linea: string, disponible: number, fuente: number): string {
  if (anchoDeTexto(linea, fuente) <= disponible) return linea;
  let corte = linea;
  while (corte.length > 1 && anchoDeTexto(`${corte}…`, fuente) > disponible) {
    corte = corte.slice(0, -1);
  }
  return `${corte.trimEnd()}…`;
}

/** Si algún nombre no entra en el ancho de una sola columna, se escalona. */
function hayQueEscalonar(
  nombres: ReadonlyArray<string>, anchoDeColumna: number,
): boolean {
  return nombres.some((n) => enLineas(n, anchoDeColumna).some((l) => l.endsWith("…")));
}

/**
 * «Metas por facultad»: cada facultad, sus dos cuotas y lo que lleva de cada
 * una. El contorno es la meta; el relleno, lo conseguido.
 *
 * **Escala COMÚN, al revés que el gauge de «Metas y aulas», y a propósito.**
 * Aquí el alto compara el tamaño del trabajo ENTRE facultades —pedir 792
 * encuestas no es lo mismo que pedir 20— y eso sólo se ve si todas miden contra
 * la misma regla. El gauge contesta la otra pregunta —¿esta facultad llega?— y
 * para eso la escala tiene que ser suya. Dos gráficos porque son dos preguntas,
 * no por adorno.
 *
 * **En DOS filas desde nueve facultades** (Gonzalo, 2026-09-10: «que sea
 * robusto: siempre que haya más de 8 facultades en adelante se parte a la mitad
 * a partir de allí»). Con las quince en una sola fila cada columna medía 62
 * unidades y el rótulo más ancho, 78,6: las etiquetas se pisaban unas con otras
 * y el eje dejaba de decir qué facultad era cuál. Partir por la mitad duplica el
 * ancho de columna —116 unidades— y de paso gasta el hueco muerto que quedaba
 * bajo el gráfico. Las dos filas comparten techo y escala, que es lo que hace
 * que los altos se sigan pudiendo comparar entre filas.
 *
 * SVG y no una librería: son treinta rectángulos y una rejilla. Plotly entraría
 * al bundle por esto.
 */
export function AulasMetasBarras({ filas , eje}: {
  /**
   * La declaración del eje de cuotas (`avance_cuota.eje`). Sin ella el gráfico
   * se comporta igual que antes: el eje nace en facultad y su etiqueta es el
   * valor crudo, que es lo que HSVG tiene en pantalla.
   */
  eje?: EjeDeclarado;

  filas: ReadonlyArray<MonitoreoAulasProyeccionFila> | null;
}): ReactNode {
  const orden = filasAlfabeticas(filas);
  if (!orden.length) return null;

  // El techo lo fija la META más alta, no lo conseguido: la barra de contorno
  // es la que tiene que caber entera, y una escala sobre lo logrado recortaría
  // justo la facultad que más pide.
  const techo = Math.max(
    ...orden.map((f) => Math.max(f.meta_M, f.meta_F, f.obtenidas_M, f.obtenidas_F)),
    1,
  ) * 1.08;

  // El lienzo mide siempre lo mismo —el ancho que tendría lleno— para que el
  // texto no cambie de tamaño con el número de facultades: con el selector
  // puesto en una sola facultad, un viewBox de 112 se escalaba ×10 y el «33 %»
  // ocupaba media pantalla. Visto en pantalla el 2026-09-10 con DERECHO puesto.
  const anchoDeReferencia = MARGEN.izq + MARGEN.der + FACULTADES_DE_REFERENCIA * GRUPO;
  const cuantasFilas = orden.length > UMBRAL_DOS_FILAS ? 2 : 1;
  const porFila = Math.ceil(orden.length / cuantasFilas);
  // Con pocas facultades el grupo engorda —barras gruesas en vez de diminutas—
  // pero con tope, o dos facultades darían columnas de media pantalla. Y con
  // muchísimas no baja del ancho nominal: por debajo de ahí los rótulos se
  // vuelven a pisar, así que en ese extremo lo que cede es el lienzo —aparece
  // el scroll— y no la legibilidad del eje.
  const grupo = Math.min(
    GRUPO * ENGORDE_MAXIMO,
    Math.max(GRUPO, (anchoDeReferencia - MARGEN.izq - MARGEN.der) / porFila),
  );
  const ancho = Math.max(anchoDeReferencia, MARGEN.izq + MARGEN.der + porFila * grupo);
  const anchoUtil = ancho - MARGEN.izq - MARGEN.der;
  const barra = grupo * 0.3;
  const hueco = grupo * 0.07;
  /** Lo que sobra a los lados cuando los grupos no llenan el lienzo. */
  const sangria = (anchoUtil - porFila * grupo) / 2;
  /** Lo que le queda al rótulo antes de tocar al de al lado. */
  const disponible = grupo - AIRE;

  const lineasPorFacultad = orden.map((f) => enLineas(etiquetaDeValorEnGrafico(f.facultad, eje), disponible).length);
  const maxLineas = Math.max(1, ...lineasPorFacultad);
  /** Lo que ocupa el rotulado bajo cada fila de barras. */
  const pie = maxLineas * ALTO_LINEA + 8;
  const ALTO = MARGEN.arriba + cuantasFilas * (UTIL_FILA + pie) + MARGEN.abajo;

  /** El borde superior de la fila `r`. */
  const techoDeFila = (r: number) => MARGEN.arriba + r * (UTIL_FILA + pie);
  const y = (v: number, r: number) => techoDeFila(r) + UTIL_FILA * (1 - v / techo);
  const alto = (v: number) => Math.max(0, (UTIL_FILA * v) / techo);

  const bandas = Array.from({ length: cuantasFilas }, (_, r) => (
    orden.slice(r * porFila, (r + 1) * porFila)
  ));

  return (
    <div className="aulas-metas-scroll">
      <p className="aulas-metas-leyenda">
        <span><i className="aulas-metas-swatch" data-sexo="hombres" />Hombres</span>
        <span><i className="aulas-metas-swatch" data-sexo="mujeres" />Mujeres</span>
        <span><i className="aulas-metas-swatch" data-tramo="meta-contorno" />Meta</span>
      </p>
      {/* **Ocupa el ancho del panel.** Iba con `width` en píxeles y en pantallas
          anchas dejaba un vacío a la derecha; con el viewBox puesto, el 100 %
          escala sin deformar y el scroll horizontal sólo aparece cuando de
          verdad no caben las facultades de una fila. */}
      <svg
        viewBox={`0 0 ${ancho} ${ALTO}`}
        className="aulas-metas-lienzo"
        preserveAspectRatio="xMinYMid meet"
        style={{ minWidth: `${ancho}px` }}
        role="img"
        aria-label="Meta y conseguido de cada facultad, por sexo, en la misma escala"
      >
        {bandas.map((banda, r) => (
          <g key={`banda-${r}`}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const v = techo * t;
              return (
                <g key={t}>
                  <line
                    x1={MARGEN.izq} x2={ancho - MARGEN.der} y1={y(v, r)} y2={y(v, r)}
                    className="aulas-metas-rejilla"
                  />
                  <text
                    x={MARGEN.izq - 6} y={y(v, r) + 3.5} textAnchor="end"
                    className="aulas-metas-eje"
                  >
                    {Math.round(v)}
                  </text>
                </g>
              );
            })}
            {banda.map((f, i) => {
              const centro = MARGEN.izq + sangria + (i + 0.5) * grupo;
              const x0 = centro - (2 * barra + hueco) / 2;
              const carriles = [
                [f.meta_M, f.obtenidas_M, 0, "hombres"],
                [f.meta_F, f.obtenidas_F, barra + hueco, "mujeres"],
              ] as const;
              // **Horizontal y repartido en líneas, no en diagonal.** Él: «las
              // etiquetas del eje x pueden tener wrap y tener mayor contracción
              // para que no estén dispuestas de forma diagonal». Un nombre a 45°
              // obliga a girar la cabeza y se comía 96 px de pie.
              const lineas = enLineas(etiquetaDeValorEnGrafico(f.facultad, eje), disponible);
              return (
                <g key={f.facultad}>
                  {carriles.map(([meta, obtenidas, dx, tono]) => (
                    <g key={dx}>
                      <rect
                        x={x0 + dx} y={y(meta, r)} width={barra} height={alto(meta)}
                        className="aulas-metas-barra-meta"
                      />
                      {/* Cada sexo con su tono, el mismo de su chip en las tablas:
                          en verde las dos, el carril de hombres y el de mujeres
                          sólo se distinguían por la posición. */}
                      <rect
                        x={x0 + dx} y={y(obtenidas, r)} width={barra} height={alto(obtenidas)}
                        className="aulas-metas-barra-logro" data-sexo={tono}
                      >
                        <title>
                          {`${etiquetaDeValorEnGrafico(f.facultad, eje)} · ${tono === "hombres" ? "Hombres" : "Mujeres"}: `}
                          {fmt(Math.round(obtenidas))} de {fmt(Math.round(meta))}
                        </title>
                      </rect>
                      {/* **La cuota, cruzando la barra que la superó** (Gonzalo,
                          2026-09-21: «cuando una barra sobrepasa el 100 % debe
                          verse bien, igual que en el PDF»). El contorno de la
                          meta se dibuja ANTES que el relleno, así que en cuanto
                          se pasa queda tapado y el gráfico deja de decir por
                          cuánto: 115 % y 250 % se veían igual de llenas. Debajo
                          de la línea está la meta; encima, el exceso. */}
                      {meta > 0 && obtenidas > meta ? (
                        <line
                          x1={x0 + dx} x2={x0 + dx + barra}
                          y1={y(meta, r)} y2={y(meta, r)}
                          className="aulas-metas-marca-cuota"
                        />
                      ) : null}
                      {/* **El porcentaje encima, del color de su barra.** Él: «mostrar
                          mejor los porcentajes de cada barra en su parte superior con
                          el color de su coloreado». Sin él hay que estimar a ojo
                          dónde cae el relleno dentro del hueco de la meta, que es
                          justo la comparación que el gráfico existe para dar.

                          Va sobre lo MÁS ALTO que se dibuja, no sobre la meta:
                          anclado a la meta, el «250 %» de Educación quedaba
                          detrás de su propia barra, cortado por la mitad. */}
                      {meta > 0 ? (
                        <text
                          x={x0 + dx + barra / 2}
                          y={y(Math.max(meta, obtenidas), r) - 5} textAnchor="middle"
                          className="aulas-metas-pct" data-sexo={tono}
                        >
                          {Math.round((100 * obtenidas) / meta)}%
                        </text>
                      ) : null}
                    </g>
                  ))}
                  <text
                    x={centro} y={y(0, r) + 14}
                    textAnchor="middle" className="aulas-metas-etiqueta"
                  >
                    {lineas.map((linea, k) => (
                      <tspan key={linea} x={centro} dy={k === 0 ? 0 : ALTO_LINEA}>{linea}</tspan>
                    ))}
                    <title>{etiquetaDeValorEnGrafico(f.facultad, eje)}</title>
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
