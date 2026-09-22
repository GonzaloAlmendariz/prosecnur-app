import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasComposicionReferencial } from "./AulasComposicionReferencial";
import { AulasPestanaCuotas } from "./AulasPestanaCuotas";
import { composicionReferencial } from "./composicionReferencial";
import type { MonitoreoAulasAvanceCuota, MonitoreoAulasDashboard, MonitoreoRow } from "../../../../api/monitoreo";

/**
 * **El panel referencial de sexo y carrera** (decisión 8 del plan del eje
 * declarable), y la regla que lo gobierna: describe, no exige.
 *
 * El motor calcula `avance_cuota.composicion` desde el 2026-09-17 y **ninguna
 * pantalla lo consumía** — el mismo fallo mudo que las cuatro bolsas del
 * avance, encontrado en la misma sesión.
 *
 * Las cifras del fixture son las MEDIDAS en el simulacro de CCSS por nivel con
 * 64 respuestas: población F 421 / M 379 sobre 800, y 58 personas resueltas
 * contra el padrón (37 mujeres, 21 hombres).
 */

const COMPOSICION = {
  schema: "monitoreo_aulas_composicion_referencial_v1",
  caracter: "referencial",
  nota: "Sexo y carrera son referenciales: describen a quién se está alcanzando.",
  fuente: "padron",
  personas: 58,
  dimensiones: {
    sexo: {
      dimension: "sexo", etiqueta: "Sexo", poblacion_total: 800, obtenidas_total: 58,
      filas: [
        { categoria: "F", poblacion: 421, poblacion_pct: 52.6, obtenidas: 37, obtenidas_pct: 63.8 },
        { categoria: "M", poblacion: 379, poblacion_pct: 47.4, obtenidas: 21, obtenidas_pct: 36.2 },
      ],
    },
    carrera: {
      dimension: "carrera", etiqueta: "Carrera", poblacion_total: 800, obtenidas_total: 58,
      filas: [
        { categoria: "ECONOMÍA", poblacion: 358, poblacion_pct: 44.8, obtenidas: 26, obtenidas_pct: 44.8 },
        { categoria: "ANTROPOLOGÍA", poblacion: 23, poblacion_pct: 2.9, obtenidas: 0, obtenidas_pct: 0 },
      ],
    },
  },
};

const bloque = (composicion: unknown) => ({
  schema: "monitoreo_aulas_avance_cuota_v1",
  fuente: "design_targets", vigencia: "vigente", motivo: "",
  tasa_esperada: 0.5, tasa_fuente: "tau_disenio",
  composicion,
  facultades: [], total: { cuota: 400, respuestas_validas: 58, brecha: 342, avance_pct: 14.5 },
}) as unknown as MonitoreoAulasAvanceCuota;

describe("composicionReferencial: el view-model", () => {
  it("dice el sexo en palabras y la carrera tal como la publica el motor", () => {
    const v = composicionReferencial(bloque(COMPOSICION));
    expect(v.vacio).toBeNull();
    expect(v.personas).toBe(58);
    // `F` → «Mujeres» reusando `sexoEnPalabra`, que es la del perfil. Hay seis
    // traducciones de F/M en este directorio y el plan prohíbe escribir otra.
    expect(v.dimensiones[0]?.filas[0]?.etiqueta).toBe("Mujeres");
    expect(v.dimensiones[1]?.filas[0]?.etiqueta).toBe("ECONOMÍA");
  });

  it("la escala es POR dimensión, no del panel", () => {
    // Sexo llega al 63,8 % y la carrera más pequeña al 2,9 %: con un tope
    // compartido las seis carreras quedarían en un hilo y no habría nada que
    // comparar. El tope de cada una sale de su propio máximo.
    const v = composicionReferencial(bloque(COMPOSICION));
    expect(v.dimensiones[0]?.tope).toBe(63.8);
    expect(v.dimensiones[1]?.tope).toBe(44.8);
  });

  it("`sin_cruce` se declara, NO se pinta como ceros", () => {
    // El motor lo publica cuando ninguna respuesta resolvió contra el padrón
    // —sin respuestas, o purgado—. Seis carreras al 0 % harían creer que se
    // midió y salió cero.
    const v = composicionReferencial(bloque({ ...COMPOSICION, fuente: "sin_cruce", personas: 0 }));
    expect(v.vacio).toContain("ninguna respuesta resuelve contra el padrón");
    // Y las dimensiones siguen ahí: la POBLACIÓN sí se conoce.
    expect(v.dimensiones.length).toBe(2);
  });

  it("sin composición en el payload dice por qué, no un cero", () => {
    expect(composicionReferencial(bloque(null)).vacio).toContain("no publica la composición");
    expect(composicionReferencial(null).vacio).toContain("no publica la composición");
  });
});

describe("AulasComposicionReferencial: lo que NO hace", () => {
  const html = renderToStaticMarkup(
    <AulasComposicionReferencial avanceCuota={bloque(COMPOSICION)} />,
  );

  it("enseña los dos repartos con sus cifras", () => {
    expect(html).toContain("Mujeres");
    expect(html).toContain("63.8 %");
    // La población de cada categoría viaja en el `title` del segmento y en su
    // renglón de la leyenda; el «de la población» de la cabecera es el total.
    expect(html).toContain("421");
    expect(html).toContain("58 de 800 de la población");
  });

  /**
   * **PRUEBA DE AUSENCIA.** Gonzalo: «Recuerda que la meta no es por sexo y
   * nivel sino sólo nivel». Sexo y carrera se describen; pintar un desvío en
   * rojo convertiría en incumplimiento algo que el estudio no prometió. El
   * motor tiene la suya y ésta la defiende en la pantalla.
   */
  it("no juzga: ni desvío, ni umbral, ni tono de alarma", () => {
    for (const palabra of ["desvi", "sobrerrepresent", "subrepresent", "umbral", "alerta", "incumpl"]) {
      expect(html.toLowerCase()).not.toContain(palabra);
    }
    expect(html).not.toContain("es-alerta");
    expect(html).not.toContain("--pulso-danger");
    expect(html).not.toContain("--pulso-warn");
  });

  it("un cero medido no dibuja astilla, y se dice en la leyenda sin un numero", () => {
    // ANTROPOLOGÍA tiene 23 personas en la población y 0 recogidas, y esa
    // diferencia ES el dato: sin segmento en la barra de lo recogido, pero con
    // su renglón. Desde que las cifras viven en el hover, el cero se dice con
    // el color hueco y dos palabras: un «0» suelto en una leyenda sin números
    // se leería como un error de la pantalla.
    expect(html).toContain("ANTROPOLOGÍA");
    expect(html).toContain('data-cero="si"');
    expect(html).toContain("sin ninguna");
    // Su segmento existe en población y no en lo recogido.
    expect(html).toContain("ANTROPOLOGÍA · 2.9 % · 23");
    expect(html).not.toContain("ANTROPOLOGÍA · 0.0 %");
  });

  /**
   * **Las cifras viven en el hover, no en la leyenda.** Gonzalo: «la leyenda no
   * necesita datos, porque las barras deben permitir hover elegante». Una
   * leyenda con números es una tabla pequeña debajo del gráfico, y entonces el
   * gráfico sobra.
   */
  it("la leyenda dice quien es cada color y nada mas", () => {
    const leyendas = html.match(/<ul class="aulas-comp-leyenda-cats">.*?<\/ul>/gs) ?? [];
    expect(leyendas.length).toBeGreaterThan(0);
    for (const l of leyendas) {
      expect(l).not.toMatch(/\d+\.\d+ %/);
    }
  });

  it("cada segmento lleva su cifra en el hover, y sale tambien con el teclado", () => {
    // Un dato que sólo existe bajo el ratón no existe para quien no lo usa.
    expect(html).toContain('data-info="Mujeres · 63.8 % · 37"');
    expect(html).toContain('tabindex="0"');
    // Y no queda el `title` del navegador: dos globos para el mismo dato.
    expect(html).not.toContain("title=");
  });

  /**
   * **La barra y su leyenda dicen el MISMO número.** El primer apilado
   * normalizaba cada segmento sobre la suma de las filas de su dimensión, y con
   * categorías que no cubren toda la población publicaba «ECONOMÍA 94 %» junto
   * a un «44,8 %» en su propio renglón: dos lecturas del mismo dato en cuatro
   * centímetros.
   */
  it("el segmento usa el porcentaje del modelo, no uno recalculado", () => {
    expect(html).toContain("ECONOMÍA · 44.8 %");
    expect(html).not.toContain("ECONOMÍA · 94.0 %");
    expect(html).not.toContain("ECONOMÍA · 100.0 %");
  });

  it("lo que falta para el 100 % se declara, no se reparte", () => {
    // En la fixture las dos carreras cubren 47,7 % de la población: el resto es
    // gente de categorías que el bloque no lista, y repartirlo entre las dos
    // sería inventar a quién pertenece.
    expect(html).toContain("es-resto");
    expect(html).toContain("Otras categorías o sin dato");
  });

  it("no repite la nota del motor sobre su propio título", () => {
    // El encabezado del panel ya dice «A quién se está alcanzando» y «no como
    // cuota»: la nota decía lo mismo por tercera vez en cuatro centímetros.
    expect(html).not.toContain("son referenciales");
  });
});

describe("el panel llega a la pestaña que lo pinta", () => {
  it("la pestaña «cuotas» lo monta", () => {
    // La misma guarda que las bolsas: el fixture NO trae `proyeccion_metas`,
    // que es la forma real de CCSS, así que el panel no puede colgar de un
    // bloque que ese estudio no monta.
    const html = renderToStaticMarkup(
      <AulasPestanaCuotas
        dashboard={{
          avance_cuota: bloque(COMPOSICION),
          proyeccion_metas: null, quotas_sex_faculty: [], aulas_por_facultad: [],
          reserva_dirigida: [], avance_sexo_facultad: [],
        } as unknown as MonitoreoAulasDashboard}
        pestana="cuotas"
        foco={null}
        facultadEnFoco={undefined}
        onFoco={() => {}}
        tabla={{} as never}
        diasDeCampoDelCorte={(_partes: ReadonlyArray<MonitoreoRow>) => 1}
      />,
    );
    expect(html).toContain("A quién se está alcanzando");
    expect(html).toContain("Mujeres");
    expect(html).toContain("63.8 %");
  });
});
