import { describe, expect, it, test } from "vitest";

import type {
  MonitoreoAulasAvanceCuota,
  MonitoreoAulasAvanceCuotaFacultad,
} from "../../../../api/monitoreo";
import { avanceCuota, numeroONulo } from "./avanceCuota";

function facultad(sobre: Partial<MonitoreoAulasAvanceCuotaFacultad> = {}): MonitoreoAulasAvanceCuotaFacultad {
  return {
    facultad: "Derecho",
    faculty_key: "derecho",
    cuota: 380,
    // La τ que dimensionó esta facultad (ADR 0082). El motor la publica por
    // fila desde que `tasa_esperada` dejó de alcanzar: queda en `null` justo
    // cuando las τ difieren entre facultades, que es siempre en HSVG2026.
    tau_prevista: 0.53,
    respuestas_validas: 182,
    brecha: 198,
    avance_pct: 47.9,
    fuente_fila: "diseno",
    estado: "ok",
    fuera_universo: 0,
    respuestas_sin_sexo: 0,
    ...sobre,
  };
}

function bloque(sobre: Partial<MonitoreoAulasAvanceCuota> = {}): MonitoreoAulasAvanceCuota {
  return {
    schema: "monitoreo_aulas_avance_cuota_v1",
    fuente: "design_targets",
    vigencia: "vigente",
    motivo: "",
    tasa_esperada: 0.53,
    tasa_fuente: "tau_disenio",
    total: {
      cuota: 1000,
      respuestas_validas: 480,
      brecha: 520,
      avance_pct: 48,
      fuera_universo: 0,
      huerfanas: 0,
    },
    facultades: [facultad()],
    ...sobre,
  };
}

describe("avanceCuota", () => {
  test("vigente: ordena por brecha descendente y el chip declara la τ del diseño", () => {
    const vista = avanceCuota(bloque({
      facultades: [
        facultad({ facultad: "Arte", faculty_key: "arte", brecha: 12, avance_pct: 96.8 }),
        facultad({ facultad: "Gestión", faculty_key: "gestion", brecha: 240, avance_pct: 36.8 }),
        facultad({ facultad: "Derecho", faculty_key: "derecho", brecha: 198, avance_pct: 47.9 }),
      ],
    }));
    // Primero la que más lejos está: la tasa sola pondría a Arte (96,8 %)
    // arriba de Gestión, a la que le faltan 240 personas.
    expect(vista.filas.map((f) => f.facultad)).toEqual(["Gestión", "Derecho", "Arte"]);
    // El chip dice contra QUÉ se mide y con qué tasa; sin él la barra de este
    // panel y la de «Cuota sexo por facultad» parecen medir lo mismo.
    // La letra griega no se publica: es la misma decisión que Cálculo de
    // muestra ya tomó para esta cifra, y en porcentaje se entiende sin
    // definición.
    expect(vista.procedencia.chip).toBe("cuota del diseño · tasa de efectividad 53.0 %");
    expect(vista.procedencia.degradada).toBe(false);
    expect(vista.vacio).toBeNull();
    // La CANTIDAD se llama igual salga de donde salga; el chip de arriba dice
    // de dónde. El otro caso lo comprueba con el denominador degradado.
    expect(vista.total?.etiqueta).toBe("Cuota del estudio");
    // Y quien no ve el chip lo oye: la procedencia entra en el aria.
    expect(vista.total?.aria).toContain("cuota del diseño · tasa de efectividad 53.0 %");
  });

  test("degradado a obsoleta: el chip cambia de denominador y el motivo viaja", () => {
    const vista = avanceCuota(bloque({
      fuente: "plan_expected",
      vigencia: "obsoleta",
      motivo: "El diseño se selló el 2026-03-01 y el plan se resorteó el 2026-04-12.",
    }));
    // Si el chip siguiera diciendo «cuota del diseño», el 100 % contra la meta
    // del plan se leería como cuota cerrada cuando el denominador ya es otro.
    expect(vista.procedencia.chip).toBe("contra la meta del plan");
    expect(vista.procedencia.degradada).toBe(true);
    // El porqué no se pierde en la degradación: va al title/aria del chip.
    expect(vista.procedencia.detalle).toContain("se resorteó el 2026-04-12");
    // **La etiqueta NO cambia con la procedencia**, que es lo que la hacía
    // duplicar al chip: en la misma cabecera decían «cuota del diseño» dos
    // veces. Lo que cambia es el chip, y ahora también el aria.
    expect(vista.total?.etiqueta).toBe("Cuota del estudio");
    expect(vista.total?.aria).toContain("contra la meta del plan");
  });

  test("sin_diseno también degrada, sin exigir el estado obsoleta", () => {
    // La degradación tiene DOS causas y comparar sólo contra una dejaría a
    // `sin_diseno` presumiendo una τ que no existe.
    const vista = avanceCuota(bloque({ fuente: "plan_expected", vigencia: "sin_diseno", motivo: "No hay diseño sellado." }));
    expect(vista.procedencia.chip).toBe("contra la meta del plan");
    expect(vista.procedencia.detalle).toBe("No hay diseño sellado.");
  });

  test("una fila sin cuota no recibe porcentaje ni entra a ningún total", () => {
    const vista = avanceCuota(bloque({
      facultades: [
        facultad({ facultad: "Derecho", faculty_key: "derecho", cuota: 380, brecha: 198 }),
        facultad({
          facultad: "Educación", faculty_key: "educacion", cuota: null,
          respuestas_validas: 44, brecha: 0, avance_pct: 0,
          fuente_fila: "sin_cuota", estado: "sin_cuota",
        }),
      ],
    }));
    const sinCuota = vista.filas.find((f) => f.facultad === "Educación");
    // Sin denominador no se inventa un avance: ni cifra ni «%», se dice.
    expect(sinCuota?.avance).toBeNull();
    expect(sinCuota?.lectura).toBe("sin cuota del diseño");
    expect(sinCuota?.lectura).not.toContain("%");
    expect(sinCuota?.cifra).toBeNull();
    // Tampoco carril: una barra proporcional a una cuota que no existe sería
    // un denominador inventado con otra ropa.
    expect(sinCuota?.carril).toBe(0);
    expect(sinCuota?.relleno).toBe(0);
    // Sus 44 recogidas quedan visibles bajo el nombre, no desaparecen.
    expect(sinCuota?.subtexto).toBe("44 recogidas");
    // El total del view-model es EL DEL MOTOR: la fila sin cuota no lo infla
    // ni entra a la cuenta de cumplidas.
    expect(vista.total?.cuota).toBe(1000);
    expect(vista.total?.validas).toBe(480);
    expect(vista.cumplidas).toBe(0);
    expect(vista.sinCuota).toBe(1);
    // Y no mueve la escala de las demás: Derecho sigue siendo la cuota más
    // alta y su carril ocupa el 100 %.
    expect(vista.filas.find((f) => f.facultad === "Derecho")?.carril).toBe(100);
  });

  test("sin aulas en el plan se lee como hueco del sorteo, no como retraso", () => {
    const vista = avanceCuota(bloque({
      facultades: [facultad({
        facultad: "Teología", faculty_key: "teologia", cuota: 60,
        respuestas_validas: 0, brecha: 60, avance_pct: 0, estado: "sin_aulas_en_plan",
      })],
    }));
    const hueco = vista.filas[0];
    // «faltan» diría que el equipo va lento; aquí no hay aulas de las que
    // recoger, y mandar gente a insistir no arregla un sorteo sin aulas.
    expect(hueco.lectura).toBe("sin cursos-horario sorteados");
    expect(hueco.lectura).not.toContain("faltan");
    // La brecha estructural sigue contada —son 60 de la cuota que el plan no
    // puede dar— y la explicación larga dice de quién es el hueco.
    expect(hueco.cifra).toBe("60");
    expect(hueco.titulo).toContain("sorteo");
    expect(hueco.titulo).toContain("no retraso");
  });

  test("el avance puede pasar de 100 sin cap; el que se capa es el ancho", () => {
    const vista = avanceCuota(bloque({
      total: { cuota: 1000, respuestas_validas: 1375, brecha: 0, avance_pct: 137.5, fuera_universo: 0, huerfanas: 0 },
      facultades: [facultad({ brecha: 0, respuestas_validas: 522, avance_pct: 137.5 })],
    }));
    // La cifra dice la verdad: capar el número escondería el sobremuestreo.
    expect(vista.total?.avance).toBe(137.5);
    // **Punto decimal: es la convención peruana, no un error de tipeo.**
    // `es-PE` escribe `2,668` con coma de millar y `137.5` con punto decimal.
    // Estas tres aserciones fijaban la coma española, que era lo que producía
    // un formateador local ya retirado, y por eso Cuotas publicaba dos
    // notaciones para la misma cifra.
    expect(vista.total?.avanceTexto).toBe("137.5 %");
    expect(vista.filas[0].avance).toBe(137.5);
    // El contrato anterior era `"cuota cumplida · 137.5 %"`, sin la fracción.
    // Se cambió a pedido de Gonzalo (2026-09-08): un porcentaje se publica con
    // la frecuencia que lo produce, y esta fila es justo la que lo necesita
    // —522 de 380 explica por qué el avance pasa de 100—.
    expect(vista.filas[0].lectura).toBe("cuota cumplida · 137.5 % (522 de 380)");
    // El ancho sí se capa: una barra al 137 % rompería el carril (C2).
    expect(vista.total?.relleno).toBe(100);
    expect(vista.filas[0].relleno).toBe(100);
  });

  test("sin bloque, el vacío queda clasificado en vez de reventar el panel", () => {
    // Un payload anterior al bloque no es una pantalla rota: el panel mantiene
    // su marco y dice por qué no hay barras (C3/C5).
    const vista = avanceCuota(undefined);
    expect(vista.vacio).toBe("El diseño no publicó metas para este estudio.");
    expect(vista.total).toBeNull();
    expect(vista.filas).toEqual([]);
    expect(vista.procedencia.chip).toBe("sin metas publicadas");
  });

  test("con bloque pero sin facultades, el vacío es del plan, no del diseño", () => {
    // Son dos ausencias distintas y nombrarlas igual mandaría a revisar el
    // diseño cuando lo que falta es importar el plan.
    const vista = avanceCuota(bloque({ facultades: [] }));
    expect(vista.vacio).toBe("Sin plan importado: no hay facultades contra las que medir la cuota.");
    expect(vista.total).toBeNull();
  });

  test("las mermas se dicen cuando existen y no ensucian cuando no", () => {
    const conMermas = avanceCuota(bloque({
      total: { cuota: 1000, respuestas_validas: 480, brecha: 520, avance_pct: 48, fuera_universo: 12, huerfanas: 3 },
      facultades: [facultad({ fuera_universo: 5, respuestas_sin_sexo: 2 })],
    }));
    // Ocultarlas haría que esta cifra y la de Procesamiento parecieran
    // contradecirse: las respuestas existieron, sólo que aquí no cuentan.
    expect(conMermas.total?.notas).toEqual(["12 fuera de universo", "3 sin curso-horario del plan"]);
    expect(conMermas.filas[0].subtexto).toContain("5 fuera de universo");
    expect(conMermas.filas[0].subtexto).toContain("2 sin sexo");

    const sinMermas = avanceCuota(bloque());
    // En cero no se muestran: «0 fuera de universo» en cada renglón es ruido
    // que entrena a no leer las mermas de verdad.
    expect(sinMermas.total?.notas).toEqual([]);
    expect(sinMermas.filas[0].subtexto).not.toContain("fuera de universo");
    expect(sinMermas.filas[0].subtexto).not.toContain("sin sexo");
  });

  test("τ nula se muestra como «τ —», más fiel que ocultar el término", () => {
    // La τ difiere por facultad: esconderla diría «aquí no hay tasa» cuando lo
    // cierto es «no hay UNA tasa».
    const vista = avanceCuota(bloque({ tasa_esperada: null }));
    // Sin una tasa única el motor deja NA para no promediar a escondidas; el
    // chip lo dice en vez de pintar un guion.
    expect(vista.procedencia.chip).toBe("cuota del diseño · tasa de efectividad sin valor único");
  });

  test("un sello sin verificar se declara en el chip, no se calla", () => {
    // `no_verificable` no degrada el denominador —sigue siendo la cuota del
    // diseño— pero leerlo como vigente a secas presume una verificación que no
    // ocurrió.
    const vista = avanceCuota(bloque({
      vigencia: "no_verificable",
      motivo: "El sello del diseño no se pudo verificar contra el marco.",
    }));
    expect(vista.procedencia.chip).toBe("cuota del diseño · tasa de efectividad 53.0 % (sello sin verificar)");
    expect(vista.procedencia.detalle).toContain("no se pudo verificar");
  });

  test("una fila cumplida no muestra resta y su avance queda dicho", () => {
    const vista = avanceCuota(bloque({
      facultades: [facultad({ brecha: 0, respuestas_validas: 390, avance_pct: 102.6 })],
    }));
    // «0 faltan» es una resta que nadie preguntó; lo que se lee es que cerró.
    expect(vista.filas[0].cifra).toBeNull();
    expect(vista.filas[0].cumplida).toBe(true);
    // Antes: `"cuota cumplida · 102.6 %"`. La fracción se le añadió con el
    // resto de las filas; la parte que este test fija —que una fila cerrada no
    // publica resta— sigue igual.
    expect(vista.filas[0].lectura).toBe("cuota cumplida · 102.6 % (390 de 380)");
    expect(vista.cumplidas).toBe(1);
  });
});

// La frontera del bloque `avance_cuota` para quien lo lea desde fuera: el JSON
// de R serializa sus campos a veces como string, y `meta_operativa` llegó como
// "NA" con «Todas las facultades» (A17, 2026-08-31). La regla es una sola:
// número finito o `null`.
describe("numeroONulo", () => {
  test("el \"NA\" de R y lo vacío son null, no NaN", () => {
    expect(numeroONulo("NA")).toBeNull();
    expect(numeroONulo("")).toBeNull();
    expect(numeroONulo(null)).toBeNull();
    expect(numeroONulo(undefined)).toBeNull();
    expect(numeroONulo("no es número")).toBeNull();
    expect(numeroONulo(Number.NaN)).toBeNull();
  });

  test("un número de verdad pasa, venga como venga", () => {
    expect(numeroONulo(3750)).toBe(3750);
    expect(numeroONulo("3750")).toBe(3750);
    expect(numeroONulo("0")).toBe(0);
    expect(numeroONulo(0)).toBe(0);
  });
});

describe("las bolsas del eje por persona llegan a la pantalla", () => {
  /**
   * **El motor las publicaba y ninguna pantalla las pintaba.** Comprobado con un
   * grep sobre `src/` entero el 2026-09-17: nada consumía `sin_eje`,
   * `duplicadas` ni `invariante`. Es el patrón del dato que muere camino a la
   * UI, y el defecto era mío: las añadí al motor y ahí se quedaron.
   */
  const bloque = (total: Record<string, unknown>, eje?: Record<string, unknown>) => ({
    schema: "monitoreo_aulas_avance_cuota_v1",
    fuente: "design_targets", vigencia: "vigente", motivo: "",
    tasa_esperada: 0.5, tasa_fuente: "tau_disenio",
    eje: eje ?? null,
    facultades: [{ facultad: "7", faculty_key: "7", cuota: 121, respuestas_validas: 10 }],
    total: { cuota: 400, respuestas_validas: 10, brecha: 390, avance_pct: 2.5, ...total },
  }) as never;

  it("las nombra con el rótulo del eje, y sólo cuando hay algo", () => {
    const con = avanceCuota(bloque({ sin_eje: 4, duplicadas: 2 },
      { clave: "nivel", etiqueta: "Nivel", etiqueta_sin: "Sin nivel" }));
    const notas = (con.total?.notas ?? []).join(" · ");
    expect(notas).toContain("4 sin nivel");
    // **Personas, no respuestas.** La cuota es de personas: llamarlo «respuestas
    // duplicadas» haría pensar que sobran encuestas cuando lo que hay es alguien
    // contado una sola vez a propósito.
    // Y concuerda: «personas que respondió» no es una frase, y esta nota se lee
    // en la pantalla más vista del perfil.
    expect(notas).toContain("2 personas que respondieron dos veces");
    expect(notas).not.toContain("respuestas duplicadas");
    // Con el eje en facultad las dos valen 0 y no se pintan: «0 sin nivel» es
    // ruido, y es el mismo trato que reciben sus hermanas.
    const sin = avanceCuota(bloque({ sin_eje: 0, duplicadas: 0 }));
    expect((sin.total?.notas ?? []).join(" · ")).not.toContain("sin nivel");
  });

  it("una sola persona repetida se dice en singular", () => {
    const uno = avanceCuota(bloque({ duplicadas: 1 }));
    expect((uno.total?.notas ?? []).join(" · ")).toContain("1 persona que respondió dos veces");
  });

  /**
   * **Cuántas no entran en ninguna celda, que es lo que le falta a «Efectivas
   * 58 de 400» para poder leerse.**
   *
   * Se SUMAN las cuatro bolsas del motor, no se resta `total − validas`: la
   * resta da el mismo número mientras el invariante cuadre y un número
   * inventado justo cuando no cuadra, que es cuando la cifra importa.
   */
  it("suma las cuatro bolsas y no las deriva de una resta", () => {
    const v = avanceCuota(bloque({
      respuestas_validas: 58, fuera_universo: 3, huerfanas: 1, sin_eje: 1, duplicadas: 1,
      // El invariante NO cuadra a propósito: si el conteo saliera de
      // `total − validas` este caso daría 6 por casualidad y el test pasaría
      // con el bug puesto.
      invariante: { ok: false, suma: 100, total: 64, solapadas: 0 },
    }, { clave: "nivel", etiqueta: "Nivel", etiqueta_sin: "Sin nivel" }));
    expect(v.total?.fueraDeCelda).toBe(6);
    const cero = avanceCuota(bloque({}));
    expect(cero.total?.fueraDeCelda).toBe(0);
  });

  it("el descuadre del invariante habla SÓLO cuando no cuadra", () => {
    // Al revés que las notas: un «las partes suman» permanente es ruido, y un
    // bloque cuyas partes no suman su total no se puede leer.
    const cuadra = avanceCuota(bloque({ invariante: { ok: true, suma: 10, total: 10, solapadas: 0 } }));
    expect(cuadra.total?.descuadre).toBeNull();
    const no = avanceCuota(bloque({ invariante: { ok: false, suma: 8, total: 10, solapadas: 0 } }));
    expect(no.total?.descuadre).toContain("8");
    expect(no.total?.descuadre).toContain("10");
    // Y el solape se nombra cuando existe: una respuesta en dos bolsas es otro
    // defecto distinto de que falten.
    const solape = avanceCuota(bloque({ invariante: { ok: false, suma: 12, total: 10, solapadas: 2 } }));
    expect(solape.total?.descuadre).toContain("dos bolsas");
  });

  it("un bloque sin invariante no inventa un descuadre", () => {
    // Un payload viejo no lo trae, y eso NO es un descuadre: es que no se midió.
    expect(avanceCuota(bloque({})).total?.descuadre).toBeNull();
  });
});
