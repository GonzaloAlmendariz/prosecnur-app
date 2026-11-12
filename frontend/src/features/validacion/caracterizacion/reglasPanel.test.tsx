// @vitest-environment happy-dom
/**
 * Caracterización de Validación: grupo "reglasPanel" (rebanada V2 del plan de
 * fidelidad). Ver arnes.tsx.
 *
 * El panel de regla propia (`panel=regla`): lo que guarda con "Alguna" en
 * "Condiciones combinadas", al comparar con otra pregunta, al guardar y
 * auditar, el conteo previo de "Casos que marca hoy" (con la base vacía
 * también) y la apertura por dirección. La cancelación del pedido de conteo
 * anterior la fija `reglas/panel/conteoPrevio.test.ts`.
 */
import { act } from "react";
import { afterEach, beforeEach, describe, expect } from "vitest";
import type { ReglaCustom } from "../types";
import { asentar, cuerposEnviados, direccionActual, EN_VUELO, escenario, escribir, Fallo, fijar, hay, montar, prepararGrupo, pulsar, type Ruta } from "./arnes";
import { REGLAS_PROPIAS, UNA_BASE, estadoInstrumento, limpieza, reglaPropia, rutasLimpieza, rutasReglasPropias } from "./escenarios";
import { ESPERA_DEL_CONTEO_MS, fijarEsperaDelConteoParaPruebas } from "../reglas/panel/conteoPrevio";

prepararGrupo("reglasPanel");

/** El conteo previo queda lejos salvo en los escenarios que lo miden (`conConteo`). */
const ESPERA_EN_PRUEBA = 40;
beforeEach(() => {
  fijarEsperaDelConteoParaPruebas(60_000);
});
afterEach(() => {
  fijarEsperaDelConteoParaPruebas(ESPERA_DEL_CONTEO_MS);
});
const conConteo = () => fijarEsperaDelConteoParaPruebas(ESPERA_EN_PRUEBA);

/** "Condiciones combinadas" guardada con el contrato M1 (`types.ts` aún no nombra el tipo). */
const CONDICIONES = {
  ...reglaPropia("RC_003", {
    nombre: "Edad o sexo fuera de lugar",
    variables: ["edad", "sexo"],
    params: {
      modo: "todas",
      condiciones: [
        { variable: "edad", op: "<", valor: 18 },
        { variable: "sexo", op: "==", valor: "1" },
      ],
    },
    hallazgo_kind: "caso_validar",
    severidad: "advertencia",
  }),
  tipo: "condiciones",
} as unknown as ReglaCustom;

const REGLAS = [...REGLAS_PROPIAS, CONDICIONES];

function respuestaDeProbar(nCasos: number) {
  return {
    ok: true,
    estado: "evaluada",
    evaluada: true,
    motivo: null,
    base_vacia: false,
    filtro_previo: false,
    n_filas: 120,
    n_base: 120,
    n_casos: nCasos,
    proporcion: nCasos / 120,
    ejemplos: [
      { id_caso: "E-0412", valores: [{ variable: "edad", valor: "14", papel: "revisada", falla: true }] },
      { id_caso: "E-0533", valores: [{ variable: "edad", valor: "31", papel: "revisada", falla: true }] },
    ],
    n_ejemplos: 2,
  };
}

const SIN_DATOS = {
  ok: true, estado: "sin_datos", evaluada: false, motivo: null, base_vacia: true, filtro_previo: false,
  n_filas: 0, n_base: 0, n_casos: 0, proporcion: null, ejemplos: [], n_ejemplos: 0,
};

const JOB_TERMINADO = {
  id: "job-aud", kind: "validacion.v2.auditoria", status: "done", started_at: "2026-01-01T00:00:00Z",
  finished_at: "2026-01-01T00:00:01Z", has_file_result: false, result_filename: null, result_data: {}, progress: null, error: "",
};

/** Catálogo de reglas (M3): dos del formulario sin evaluar y las preguntas que nombran sus frases. */
const CATALOGO = {
  ok: true, base_nombre: "default", variable: null, plan_construido: true, auditada_en: null,
  n_total: 3, n_activas: 3, n_sin_evaluar: 2, por_origen: { formulario: 3, operativo: 0, propia: 0 },
  familias: [
    { origen: "formulario", familia: "salto", nombre: "Saltos", n: 3, n_activas: 3, n_sin_evaluar: 2 },
  ],
  reglas: [
    { id: "VR_1", origen: "formulario", familia: "obligatoria", nombre: "x", frase: [{ pregunta: "edad", etiqueta: "Edad en años cumplidos", tipo: "numerica" }, { texto: " es obligatoria." }] },
    { id: "VR_2", origen: "formulario", familia: "obligatoria", nombre: "y", frase: [{ pregunta: "sexo", etiqueta: "Sexo", tipo: "unica" }, { texto: " es obligatoria." }] },
  ],
  avisos: [],
};

function rutas(probar: Ruta[2] = EN_VUELO): Ruta[] {
  return [
    ["GET", /^\/api\/validacion\/v2\/reglas\/catalogo/, CATALOGO],
    ["POST", "/api/validacion/v2/reglas_custom/probar", probar],
    ["POST", "/api/validacion/v2/auditoria", { ok: true, job_id: "job-aud", kind: "validacion.v2.auditoria", n_reglas: 3, n_plan: 0, n_propias: 3 }],
    ["GET", "/api/jobs/job-aud", JOB_TERMINADO],
    ["GET", "/api/validacion/v2/instrumento/estado", estadoInstrumento(true, true)],
    ...rutasLimpieza(limpieza({ auditoria: true })),
    ...rutasReglasPropias(REGLAS),
  ];
}

/** Deja pasar la espera del conteo previo y lo que responde el motor (con la máquina cargada, unas vueltas más). */
async function esperarConteo() {
  for (let vuelta = 0; vuelta < 15; vuelta += 1) {
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, ESPERA_EN_PRUEBA + 200));
    });
    await asentar();
    if (!hay(".pulso-regla-casos", "Contando los casos")) return;
  }
}

/** Los pedidos que guardan algo, sin el conteo previo: `[línea del pedido, cuerpo]`. */
function guardados(): Array<[string, Record<string, unknown>]> {
  return cuerposEnviados()
    .filter((c) => !c.includes("/reglas_custom/probar"))
    .map((c) => {
      const corte = c.indexOf("\n");
      return [c.slice(0, corte), JSON.parse(c.slice(corte + 1) || "{}") as Record<string, unknown>];
    });
}

describe("Validación, panel de regla", () => {
  escenario("reglas-panel_por-direccion", "la dirección abre la regla del foco y una nueva con su tipo y su pregunta", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&panel=regla&foco=RC_002", rutas: rutas() });
    expect(hay(".pulso-panel-regla .pulso-cabecera-panel__titulo", "Sexo y servicio")).toBe(true);
    expect(hay(".pulso-panel-regla", "Dos respuestas que deben cuadrar")).toBe(true);
    await pulsar('.pulso-panel-regla button[aria-label="Cerrar la regla"]');
    expect(direccionActual()).toBe("/validacion?pestana=reglas");
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&panel=regla&foco=nueva&tipo=rango_num&pregunta=edad", rutas: rutas() });
    expect(hay(".pulso-panel-regla .pulso-cabecera-panel__titulo", 'Valor fuera de rango: "Edad en años cumplidos"')).toBe(true);
    fijar("reglas-panel_por-direccion");
  });

  escenario("reglas-panel_condiciones-alguna", "Alguna en Condiciones combinadas guarda modo alguna", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&panel=regla&foco=RC_003", rutas: rutas() });
    const conector = () => document.querySelector(".pulso-panel-regla .pulso-frase-regla-frase em")?.textContent;
    expect(hay(".pulso-panel-regla .pulso-frase-regla", "es menor que 18")).toBe(true);
    expect(hay(".pulso-panel-regla .pulso-frase-regla", "es Hombre")).toBe(true);
    expect(conector()).toBe("y");
    await pulsar('.pulso-panel-regla [role="radio"]', "Alguna");
    expect(conector()).toBe("o");
    await pulsar(".pulso-dialog__actions button", "Guardar");
    const [[pedido, cuerpo]] = guardados();
    expect(pedido).toBe("PUT /api/validacion/v2/reglas_custom/RC_003 [base=default]");
    expect(cuerpo.params).toEqual({
      modo: "alguna",
      condiciones: [
        { variable: "edad", op: "<", valor: 18 },
        { variable: "sexo", op: "==", valor: "1" },
      ],
    });
    fijar("reglas-panel_condiciones-alguna");
  });

  escenario("reglas-panel_compara-pregunta", "comparar con otra pregunta guarda valor_y_variable en lugar de valor_y", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&panel=regla&foco=RC_002", rutas: rutas() });
    await pulsar('.pulso-panel-regla button[aria-label="Comparar con otra pregunta"]');
    expect(document.querySelector('.pulso-panel-regla button[aria-label="Comparar con otra pregunta"]')?.getAttribute("aria-pressed")).toBe("true");
    await pulsar(".pulso-dialog__actions button", "Guardar");
    const [[, cuerpo]] = guardados();
    expect(cuerpo.params).toEqual({ op_x: "==", valor_x: "1", op_y: "!=", valor_y_variable: "edad" });
    fijar("reglas-panel_compara-pregunta");
  });

  escenario("reglas-panel_probar", "Casos que marca hoy cuenta el borrador y vuelve a contar al cambiarlo", async () => {
    conConteo();
    await montar({
      ...UNA_BASE,
      entrada: "/validacion?pestana=reglas&panel=regla&foco=RC_001",
      rutas: rutas((_url: string, cuerpo: string) => {
        const min = String((JSON.parse(cuerpo) as { params?: { min?: unknown } }).params?.min ?? "");
        // El primer conteo queda en vuelo: el segundo es el que se ve.
        return min === "16" ? EN_VUELO : respuestaDeProbar(min === "20" ? 3 : 7);
      }),
    });
    expect(hay(".pulso-regla-casos", "Contando los casos")).toBe(true);
    await esperarConteo();
    await escribir('.pulso-panel-regla input[aria-label="Mínimo"]', "20");
    await esperarConteo();
    expect(hay(".pulso-regla-casos .pulso-cifra-hallazgo-cifra", "3")).toBe(true);
    expect(hay(".pulso-regla-casos", "de 120 casos")).toBe(true);
    expect(hay(".pulso-regla-casos", "Se muestran 2 de 3 casos.")).toBe(true);
    fijar("reglas-panel_probar");
  });

  escenario("reglas-panel_sin-datos", "con la base sin respuestas solo se guarda", async () => {
    conConteo();
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&panel=regla&foco=RC_001", rutas: rutas(SIN_DATOS) });
    await esperarConteo();
    expect(hay(".pulso-regla-casos", "La base todavía no tiene respuestas")).toBe(true);
    expect(hay(".pulso-dialog__actions button", "Guardar y auditar")).toBe(false);
    expect(hay(".pulso-panel-regla", "Se audita cuando haya respuestas.")).toBe(true);
    fijar("reglas-panel_sin-datos");
  });

  escenario("reglas-panel_guardar-y-auditar", "guardar y auditar guarda, audita y lleva a Hallazgos", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&panel=regla&foco=RC_001", rutas: rutas() });
    await pulsar(".pulso-dialog__actions button", "Guardar y auditar");
    await asentar(20);
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos");
    expect(guardados().map(([pedido]) => pedido)).toEqual([
      "PUT /api/validacion/v2/reglas_custom/RC_001 [base=default]",
      "POST /api/validacion/v2/auditoria [base=default]",
    ]);
    fijar("reglas-panel_guardar-y-auditar");
  });

  escenario("reglas-panel_sin-respuestas", "A4: con la base sin respuestas el panel abre en su variante vacía", async () => {
    conConteo();
    await montar({
      ...UNA_BASE,
      entrada: "/validacion?pestana=reglas&panel=regla&foco=RC_001",
      rutas: [
        ["GET", /^\/api\/validacion\/v2\/explorar\/variables/, new Fallo("E_NO_DATA_INST", "No hay data o instrumento cargado para esta base.", 409)],
        ...rutas(new Fallo("E_NO_DATA_INST", "No hay data o instrumento cargado para esta base.", 409)),
      ],
    });
    await esperarConteo();
    expect(hay(".pulso-panel-regla .pulso-cabecera-panel__titulo", "Edad entre 16 y 25")).toBe(true);
    expect(hay(".pulso-regla-casos", "La base todavía no tiene respuestas")).toBe(true);
    expect(hay(".pulso-dialog__actions button", "Guardar y auditar")).toBe(false);
    fijar("reglas-panel_sin-respuestas");
  });

  escenario("reglas-panel_sin-evaluar", "Qué quieres revisar dice cuántas reglas del formulario quedaron sin evaluar", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&panel=regla&foco=nueva", rutas: rutas() });
    expect(hay(".pulso-regla-sugeridas", "2 reglas del formulario sin evaluar")).toBe(true);
    fijar("reglas-panel_sin-evaluar");
  });

  escenario("reglas-panel_usar-sugerida", "una sugerida usada se guarda como sugerida", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&panel=regla&foco=nueva", rutas: rutas() });
    await pulsar('button[aria-label="Usar la sugerida Duplicados por documento"]');
    await pulsar(".pulso-dialog__actions button", "Guardar");
    const [[pedido, cuerpo]] = guardados();
    expect(pedido).toBe("POST /api/validacion/v2/reglas_custom [base=default]");
    expect(cuerpo.origen).toBe("sembrado");
    fijar("reglas-panel_usar-sugerida");
  });

  escenario("reglas-panel_alias-propia", "el enlace viejo al detalle abre la regla propia en el panel y limpia la dirección", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=instrumento&panel=regla&foco=RC_002", rutas: rutas() });
    expect(direccionActual()).toBe("/validacion?pestana=reglas&panel=regla&foco=RC_002");
    expect(hay(".pulso-panel-regla .pulso-cabecera-panel__titulo", "Sexo y servicio")).toBe(true);
    fijar("reglas-panel_alias-propia");
  });

  escenario("reglas-panel_descartar-cambios", "cerrar con cambios pide confirmar y no pierde el borrador", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&panel=regla&foco=RC_001", rutas: rutas() });
    await escribir('.pulso-panel-regla input[aria-label="Mínimo"]', "20");
    await pulsar(".pulso-dialog__actions button", "Cancelar");
    expect(hay('[role="dialog"]', "Descartar los cambios de la regla")).toBe(true);
    await pulsar("button", "Seguir editando");
    expect((document.querySelector('.pulso-panel-regla input[aria-label="Mínimo"]') as HTMLInputElement | null)?.value).toBe("20");
    await pulsar(".pulso-dialog__actions button", "Cancelar");
    await pulsar("button", "Descartar los cambios");
    expect(direccionActual()).toBe("/validacion?pestana=reglas");
    fijar("reglas-panel_descartar-cambios");
  });
});
