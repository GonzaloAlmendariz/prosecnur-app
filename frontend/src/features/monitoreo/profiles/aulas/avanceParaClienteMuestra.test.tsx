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
