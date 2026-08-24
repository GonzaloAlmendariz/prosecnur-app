import { describe, expect, test } from "vitest";

import type {
  MonitoreoAulasAvanceCuota,
  MonitoreoAulasAvanceCuotaFacultad,
} from "../../../../api/monitoreo";
import { avanceCuota } from "./avanceCuota";

function facultad(sobre: Partial<MonitoreoAulasAvanceCuotaFacultad> = {}): MonitoreoAulasAvanceCuotaFacultad {
  return {
    facultad: "Derecho",
    faculty_key: "derecho",
    cuota: 380,
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
    expect(vista.procedencia.chip).toBe("cuota del diseño · τ 0,53");
    expect(vista.procedencia.degradada).toBe(false);
    expect(vista.vacio).toBeNull();
    expect(vista.total?.etiqueta).toBe("Cuota del diseño");
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
    expect(vista.total?.etiqueta).toBe("Meta del plan");
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
    expect(hueco.lectura).toBe("sin aulas sorteadas");
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
    expect(vista.total?.avanceTexto).toBe("137,5");
    expect(vista.filas[0].avance).toBe(137.5);
    expect(vista.filas[0].lectura).toBe("cuota cumplida · 137,5%");
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
    expect(conMermas.total?.notas).toEqual(["12 fuera de universo", "3 sin aula del plan"]);
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
    expect(vista.procedencia.chip).toBe("cuota del diseño · τ —");
  });

  test("un sello sin verificar se declara en el chip, no se calla", () => {
    // `no_verificable` no degrada el denominador —sigue siendo la cuota del
    // diseño— pero leerlo como vigente a secas presume una verificación que no
    // ocurrió.
    const vista = avanceCuota(bloque({
      vigencia: "no_verificable",
      motivo: "El sello del diseño no se pudo verificar contra el marco.",
    }));
    expect(vista.procedencia.chip).toBe("cuota del diseño · τ 0,53 (sello sin verificar)");
    expect(vista.procedencia.detalle).toContain("no se pudo verificar");
  });

  test("una fila cumplida no muestra resta y su avance queda dicho", () => {
    const vista = avanceCuota(bloque({
      facultades: [facultad({ brecha: 0, respuestas_validas: 390, avance_pct: 102.6 })],
    }));
    // «0 faltan» es una resta que nadie preguntó; lo que se lee es que cerró.
    expect(vista.filas[0].cifra).toBeNull();
    expect(vista.filas[0].cumplida).toBe(true);
    expect(vista.filas[0].lectura).toBe("cuota cumplida · 102,6%");
    expect(vista.cumplidas).toBe(1);
  });
});
