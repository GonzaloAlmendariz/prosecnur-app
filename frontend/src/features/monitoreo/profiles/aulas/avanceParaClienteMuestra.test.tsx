import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasAvanceCuota, MonitoreoRow } from "../../../../api/monitoreo";
import { AulasAvanceParaCliente } from "./AulasAvanceParaCliente";

/**
 * La muestra del estudio no es la suma de las cuotas por facultad.
 *
 * Medido el 2026-08-29 sobre HSVG2026: el diseño declara `n_objetivo = 2500`,
 * las quince filas suman 3.491 —una cuota por celda no se netea entre celdas,
 * ADR 0079— y este panel, que se llama «El avance que ve el cliente», abría
 * diciendo «De una muestra de 3.491 alumnos». Ni el objetivo (2.500) ni el
 * operativo (3.750). El motor publica el total en `avance_cuota$total$cuota` y
 * el panel lo resumaba en vez de leerlo.
 */

const cuota = (total: number | null, filas: Array<[string, number, number]>) => ({
  schema: "monitoreo_aulas_avance_cuota_v1",
  fuente: "design_targets",
  vigencia: "vigente",
  motivo: "",
  tasa_esperada: 0.53,
  tasa_fuente: "tau_disenio",
  total: {
    cuota: total,
    respuestas_validas: filas.reduce((s, f) => s + f[2], 0),
    brecha: 0,
    avance_pct: 0,
    fuera_universo: 0,
    huerfanas: 0,
  },
  facultades: filas.map(([facultad, c, v]) => ({
    facultad,
    faculty_key: facultad.toLowerCase(),
    cuota: c,
    respuestas_validas: v,
  })),
}) as unknown as MonitoreoAulasAvanceCuota;

// El separador de miles depende del ICU del runner —sin él `toLocaleString`
// degrada a inglés y sale «2,500» donde la app pinta «2 500»—, así que se
// compara sobre los dígitos pelados. Afirmar la coma o el espacio da rojos
// falsos que no dicen nada del componente.
const pinta = (c: MonitoreoAulasAvanceCuota) =>
  renderToStaticMarkup(<AulasAvanceParaCliente avanceCuota={c} />)
    .replace(/(\d)[\s,.\u00a0\u202f](?=\d{3}\b)/g, "$1");

describe("la muestra que enseña el panel del cliente", () => {
  // Dos facultades cuyas cuotas suman 3.400 con un objetivo declarado de 2.500:
  // el reparto con mínimos por celda sobrepasa el objetivo, que es justo lo que
  // pasa en el estudio real.
  const filas: Array<[string, number, number]> = [["Derecho", 2000, 400], ["Gestion", 1400, 267]];

  // OJO: que el motor publique 2.500 es una hipótesis del test, no lo que pasa
  // hoy. `metas_diseno.R:117` define `total_cuota` como la suma de las cuotas
  // por facultad, así que en HSVG2026 vale 3.491 igual que la suma. El test fija
  // que la fuente sea UNA —la del motor— para que el día que ese total cambie,
  // el panel lo siga.
  it("usa el total del motor, no la suma de sus filas", () => {
    const html = pinta(cuota(2500, filas));
    expect(html).toContain("2500");
    expect(html).not.toContain("3400");
  });

  it("cuando el motor no puede afirmar un total, cae a la suma y no inventa", () => {
    // `cuota: null` es el caso declarado del contrato («NA»). Ahí la suma de
    // filas es lo mejor que hay y callarla sería peor.
    const html = pinta(cuota(null, filas));
    expect(html).toContain("3400");
  });

  it("los faltantes SIGUEN sumándose sin netear", () => {
    // El control del arreglo: si alguien «armonizara» también los faltantes con
    // `total.brecha`, que viene neteada, se perdería el ADR 0079. Con 2.500 de
    // objetivo y 667 conseguidas, la resta neta daría 1.833; lo correcto es la
    // suma por facultad: (2000−400) + (1400−267) = 2.733.
    expect(pinta(cuota(2500, filas))).toContain("2733");
  });
});

describe("la cuota no se compensa entre sexos dentro de una facultad", () => {
  /**
   * El norte de Gonzalo: «lo que me interesa es que TODAS LAS FACULTADES
   * CUMPLAN CON SU CUOTA DE SEXO».
   *
   * `faltan` restaba los totales de la facultad, así que un excedente de
   * hombres tapaba un déficit de mujeres. Aplicaba el ADR 0079 entre facultades
   * y se lo saltaba un nivel más abajo, que es donde vive la meta. Por eso la
   * tabla decía «Faltan 2.825» y la tarjeta de arriba «Cuota por recoger
   * 2.824», que sí suma celda a celda: no era un redondeo, eran dos cantidades
   * distintas con el mismo nombre.
   */
  const celda = (facultad: string, sex: string, target: number, observed: number) =>
    ({ faculty: facultad, sex, target, observed }) as unknown as MonitoreoRow;

  // Derecho: mujeres 100/40 (faltan 60), hombres 100/130 (sobran 30).
  // Neteando da 100+100−170 = 30. Sin netear, 60. La segunda es la que hay que
  // salir a buscar; la primera manda un equipo a menos de la mitad.
  const celdas = [
    celda("Derecho", "Mujer", 100, 40),
    celda("Derecho", "Hombre", 100, 130),
  ];

  const conCeldas = () => renderToStaticMarkup(
    <AulasAvanceParaCliente
      avanceCuota={cuota(200, [["Derecho", 200, 170]])}
      celdasSexo={celdas}
    />,
  ).replace(/(\d)[\s,.  ](?=\d{3}\b)/g, "$1");

  it("suma el déficit de cada sexo en vez de restar los totales", () => {
    const html = conCeldas();
    expect(html).toContain(">60<");
    expect(html).not.toContain(">30<");
  });

  it("sin el sexo trazado cae a la resta de la facultad y no inventa un reparto", () => {
    const html = renderToStaticMarkup(
      <AulasAvanceParaCliente avanceCuota={cuota(200, [["Derecho", 200, 170]])} />,
    );
    expect(html).toContain(">30<");
  });
});

describe("«Mujer» no es un hombre", () => {
  /**
   * El `sex` de `quotas_sex_faculty` sale de la columna del estudio tal cual
   * (`monitoreo_aulas_universitarias.R:1586`). `audit_reference.R:231` mapea
   * `"1" = "Mujer"`, así que ese literal es un valor real y no una hipótesis.
   *
   * Tres superficies del perfil lo trataban mal, cada una a su manera:
   *   · `avanceParaCliente` probaba `/^(f|fem)/` y luego `/^(m|masc|varon|hombre)/`
   *     y contaba las mujeres como HOMBRES;
   *   · `brechaDeLaFacultad` recortaba a la inicial —«Mujer» → «M»— igual;
   *   · `celdasPorFacultad` comparaba contra `"F"`/`"M"` y las DESCARTABA,
   *     dejando el gráfico vacío sin decir por qué.
   * Las tres usan ahora `sexSeriesKind`, el clasificador de la casa.
   */
  const conEtiquetas = (mujer: string, hombre: string) => renderToStaticMarkup(
    <AulasAvanceParaCliente
      avanceCuota={cuota(200, [["Derecho", 200, 170]])}
      celdasSexo={[
        { faculty: "Derecho", sex: mujer, target: 100, observed: 40 },
        { faculty: "Derecho", sex: hombre, target: 100, observed: 130 },
      ] as unknown as MonitoreoRow[]}
    />,
  ).replace(/(\d)[\s,.  ](?=\d{3}\b)/g, "$1");

  it("las etiquetas en palabra dan lo mismo que los códigos", () => {
    expect(conEtiquetas("Mujer", "Hombre")).toBe(conEtiquetas("F", "M"));
  });

  it("y no invierten las columnas: la de mujeres lleva 40, no 130", () => {
    // El mutante que importa. Si «Mujer» volviera a caer en la rama de hombres
    // el HTML seguiría teniendo un 40 y un 130 —sólo que cambiados de sitio—,
    // así que se mira el ORDEN de las celdas: muestra M, muestra H, lleva M,
    // lleva H.
    const cifras = [...conEtiquetas("Mujer", "Hombre")
      .matchAll(/aulas-cliente-cifra[^>]*">(\d+)</g)].map((m) => m[1]);
    expect(cifras.slice(0, 4)).toEqual(["200", "100", "100", "170"]);
    expect(cifras.slice(4, 6)).toEqual(["40", "130"]);
  });
});

describe("el veredicto no da por cerrada una facultad a la que le faltan mujeres", () => {
  /**
   * **«Cerrada» y «Faltan 17» en la misma fila.**
   *
   * El chip se decidía con `avance >= 1`, el cociente de los TOTALES de la
   * facultad, que compensa un sexo con el otro; la columna «Faltan», en cambio,
   * ya sumaba el déficit de cada sexo por separado. Con las dos reglas
   * conviviendo, la tabla que va al cliente —y al PDF, y al libro— daba tres
   * facultades por cerradas teniéndolas abiertas.
   *
   * El caso es el real, medido en pantalla el 2026-08-29 con `como_2025`:
   * Arquitectura tiene cuota 125 (85 mujeres / 40 hombres), lleva 126 (68 / 58)
   * y le faltan 17 mujeres. El total sale a 100.8 %.
   *
   * Va contra el encargo, que es explícito: «lo que me interesa es que TODAS LAS
   * FACULTADES CUMPLAN CON SU CUOTA DE SEXO. Ese es lo fundamental de todo
   * esto».
   */
  const arquitectura = renderToStaticMarkup(
    <AulasAvanceParaCliente
      avanceCuota={cuota(125, [["Arquitectura", 125, 126]])}
      celdasSexo={[
        { faculty: "Arquitectura", sex: "Mujer", target: 85, observed: 68 },
        { faculty: "Arquitectura", sex: "Hombre", target: 40, observed: 58 },
      ] as unknown as MonitoreoRow[]}
    />,
  );

  it("con 17 mujeres de menos no dice que la cuota está cumplida", () => {
    expect(arquitectura).not.toContain("Cuota cumplida");
  });

  it("y lo que falta sigue siendo 17, no la resta de los totales", () => {
    // 126 − 125 daría 0 y es lo que hacía parecer cerrada la fila.
    expect(arquitectura).toContain(">17<");
  });

  it("una facultad sin déficit en ningún sexo sí cierra", () => {
    const cerrada = renderToStaticMarkup(
      <AulasAvanceParaCliente
        avanceCuota={cuota(125, [["Arquitectura", 125, 130]])}
        celdasSexo={[
          { faculty: "Arquitectura", sex: "Mujer", target: 85, observed: 85 },
          { faculty: "Arquitectura", sex: "Hombre", target: 40, observed: 45 },
        ] as unknown as MonitoreoRow[]}
      />,
    );
    // El control de que el test distingue: sin él, «no contiene Cuota cumplida»
    // pasaría también con un chip que no se pintara nunca.
    expect(cerrada).toContain("Cuota cumplida");
  });
});

describe("la sobremuestra, cuando el diseño la declara", () => {
  // Gonzalo, 2026-08-31: el operativo compara contra DOS cifras, «cuánto es la
  // meta de la muestra, cuánto es la meta de la sobremuestra, y cuánto íbamos».
  // La segunda no llegaba a Monitoreo y el pie de esta tabla lo declaraba.
  const conDiseno = {
    schema: "monitoreo_aulas_avance_cuota_v1",
    fuente: "design_targets",
    vigencia: "vigente",
    motivo: "",
    tasa_esperada: null,
    tasa_fuente: "tau_disenio",
    meta_diseno: 2500,
    sobremuestra: 1250,
    meta_operativa: 3750,
    total: { cuota: 2500, respuestas_validas: 2616, brecha: 0, avance_pct: 104 },
    facultades: [
      { facultad: "Derecho", cuota: 2500, respuestas_validas: 2616, brecha: 0, avance_pct: 104 },
    ],
  } as unknown as MonitoreoAulasAvanceCuota;

  /**
   * La sobremuestra dejó de ser un párrafo y es una FILA de cierre (2026-09-08):
   * Gonzalo cortó el texto de encima de la tabla y fijó que muestra y
   * sobremuestra son las dos metas del estudio, medidas igual. Ya no se dice
   * «1.250 sobre la meta» —esa resta era la que la degradaba a margen—; se dice
   * la meta entera, lo conseguido contra ella y lo que falta.
   */
  it("la sobremuestra cierra la tabla como la otra meta, no como un margen", () => {
    const html = renderToStaticMarkup(
      <AulasAvanceParaCliente avanceCuota={conDiseno} diseno={conDiseno} />,
    );
    expect(html).toContain("Sobremuestra");
    expect(html).toContain("3,750");
    // 2.616 de 3.750 es el 69,8 %. Con un decimal, como el resto de la tabla:
    // el párrafo retirado redondeaba a entero y era la única cifra del panel
    // que lo hacía.
    expect(html).toMatch(/69[.,]8 %/);
    // Y NO la resta que la presentaba como un extra sobre la muestra.
    expect(html).not.toContain("sobre la meta");
  });

  it("se calla entera si el estudio no la declara", () => {
    // Inventar un techo sería peor que no tenerlo: la mayoría de los estudios
    // no publican sobremuestra y la tabla no debe suponerla.
    const html = renderToStaticMarkup(
      <AulasAvanceParaCliente avanceCuota={conDiseno} diseno={null} />,
    );
    expect(html).not.toContain("el techo es");
  });

  /**
   * El pie decía «la sobremuestra es hasta dónde se compró aforo, NO una segunda
   * meta». Dejó de ser cierto el 2026-09-08: Gonzalo fijó que son las dos metas
   * del estudio, con el mismo trato y sin llamar referencial a ninguna. Hay un
   * test hermano en el libro (`.calaf_nota_metas`) que prohíbe «referencial»,
   * «margen», «segunda meta» y «techo»; este guard es su gemelo en la app, para
   * que la pantalla y la hoja no digan cosas distintas del mismo número.
   */
  it("el pie no degrada ninguna de las dos metas", () => {
    const html = renderToStaticMarkup(
      <AulasAvanceParaCliente avanceCuota={conDiseno} diseno={conDiseno} />,
    );
    expect(html).not.toContain("no la compara");
    for (const prohibida of ["no una segunda meta", "referencial", "no una meta"]) {
      expect(html, `el pie llama «${prohibida}» a una de las dos metas`).not.toContain(prohibida);
    }
    // Y sí dice lo que hay que saber para leer la tabla: que las dos se miden igual.
    expect(html).toContain("las dos se miden igual");
  });
});
