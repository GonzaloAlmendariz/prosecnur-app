import { describe, expect, it } from "vitest";
import {
  FAMILIA_FUERA_DE_AUDITORIA,
  FAMILIA_PLAN_SIN_LEER,
  FAMILIA_PROPIAS_VACIA,
  FAMILIA_SIN_EVALUAR,
  avisosDeLaFranja,
  avisosDeLaRegla,
  cifrasDeReglas,
  columnaDeFamilias,
  destinoDeLaFranja,
  estadoDeFila,
  familiaAbierta,
  gruposDeLaFranja,
  normalizarCatalogoCompleto,
  parejaDe,
  reglaElegida,
  reglasDeLaFamilia,
  textoDeBase,
  textoDeTratamiento,
} from "./modeloCatalogo";

// Rebanada V1 del plan de fidelidad: la mesa de Reglas leída del catálogo M3.
// Las reglas siguen la forma del ejemplo real de audit_reference (contrato M3, sección 2).

function regla(id: string, cambios: Record<string, unknown> = {}) {
  return {
    id,
    id_motor: id,
    origen: "formulario",
    familia: "salto",
    familia_nombre: "Saltos",
    nombre: `Regla ${id}`,
    frase: [
      { pregunta: "area_other", etiqueta: "Otra area", tipo: "texto" },
      { texto: " se responde cuando " },
      { pregunta: "area", etiqueta: "Area principal", tipo: "unica" },
      { texto: " es " },
      { valor: "Otro", codigo: "99" },
      { texto: "." },
    ],
    clase: "inconsistencia",
    tratamiento_previsto: { accion: null, alcance: null },
    activa: true,
    estado_evaluacion: "evaluada",
    ultima_auditoria: null,
    ...cambios,
  };
}

function catalogo(cambios: Record<string, unknown> = {}) {
  return normalizarCatalogoCompleto({
    ok: true,
    plan_construido: true,
    auditada_en: "2026-11-08T15:00:00Z",
    n_total: 4,
    n_activas: 3,
    n_sin_evaluar: 1,
    por_origen: { formulario: 3, operativo: 0, propia: 1 },
    familias: [
      { origen: "formulario", familia: "obligatoria", nombre: "Obligatorias", n: 1, n_activas: 1, n_sin_evaluar: 1 },
      { origen: "formulario", familia: "salto", nombre: "Saltos", n: 2, n_activas: 1, n_sin_evaluar: 0 },
      { origen: "propia", familia: "rango_num", nombre: "Valor fuera de rango", n: 1, n_activas: 1, n_sin_evaluar: 0 },
    ],
    reglas: [
      regla("VR_req", { familia: "obligatoria", estado_evaluacion: "sin_evaluar", causa_codigo: "listado_externo", causa: "Depende de un listado externo" }),
      regla("VR_debe", {
        direccion: "debe", pareja: "VR_nodebe",
        ultima_auditoria: { n_casos: 4, n_base: 142, base_definicion: "a quienes les correspondía responder", porcentaje: 4 / 142, nivel: "caso", n_decididos: 1 },
      }),
      regla("VR_nodebe", { direccion: "nodebe", pareja: "VR_debe", activa: false, motivo_desactivada: "Se revisa a mano" }),
      regla("RC_1", {
        origen: "propia", familia: "rango_num", nombre: "Edad entre 16 y 25", clase: "caso_a_revisar",
        tratamiento_previsto: { accion: "nullify_fields", alcance: "single" },
        ultima_auditoria: { n_casos: 3, n_base: 120, base_definicion: "casos de la base", porcentaje: 0.025, nivel: "caso", n_decididos: 3 },
      }),
    ],
    avisos: [],
    ...cambios,
  });
}

describe("normalizar el catálogo", () => {
  it("conserva los espacios de la frase y lee preguntas, valores y textos", () => {
    const c = catalogo();
    const frase = c.reglas[1].frase;
    expect(frase.map((p) => (p.tipo === "texto" ? p.texto : p.tipo === "valor" ? p.valor : p.codigo)).join("|"))
      .toBe("area_other| se responde cuando |area| es |Otro|.");
    expect(frase[0]).toEqual({ tipo: "pregunta", codigo: "area_other", etiqueta: "Otra area", tipoPregunta: "texto" });
    expect(frase[4]).toEqual({ tipo: "valor", valor: "Otro", codigo: "99" });
  });

  it("una cifra que falta queda en null, no en 0", () => {
    const c = normalizarCatalogoCompleto({ plan_construido: true, reglas: [], familias: [] });
    expect(c.n_total).toBeNull();
    expect(c.n_activas).toBeNull();
    expect(c.por_origen.formulario).toBeNull();
  });

  // La lectura que no descarta reglas la fija api/validacionCatalogo.test.ts.
});

describe("columna de familias", () => {
  it("reúne las sin evaluar al final del formulario y deja las propias y las excluidas", () => {
    const grupos = columnaDeFamilias(catalogo(), 2);
    expect(grupos.map((g) => g.id)).toEqual(["formulario", "operativo", "propia", "fuera"]);
    expect(grupos[0].entradas.map((e) => `${e.clave}:${e.n}`)).toEqual(["obligatoria:1", "salto:2", `${FAMILIA_SIN_EVALUAR}:1`]);
    expect(grupos[0].n).toBe(3);
    expect(grupos[1].entradas).toEqual([]);
    expect(grupos[2].entradas.map((e) => e.clave)).toEqual(["rango_num"]);
    expect(grupos[3].entradas).toEqual([{ clave: FAMILIA_FUERA_DE_AUDITORIA, nombre: "Preguntas excluidas", n: 2 }]);
  });

  it("sin sin evaluar no hay entrada; sin propias queda una entrada vacía", () => {
    const c = catalogo({ n_sin_evaluar: 0, familias: [{ origen: "formulario", familia: "salto", nombre: "Saltos", n: 2 }] });
    const grupos = columnaDeFamilias(c, null);
    expect(grupos[0].entradas.map((e) => e.clave)).toEqual(["salto"]);
    expect(grupos[2].entradas.map((e) => e.clave)).toEqual([FAMILIA_PROPIAS_VACIA]);
  });

  it("sin plan, el formulario tiene la entrada que lleva a leerlo y se abre esa", () => {
    const c = catalogo({ plan_construido: false, familias: [], reglas: [], n_sin_evaluar: 0 });
    const grupos = columnaDeFamilias(c, 0);
    expect(grupos[0].entradas.map((e) => e.clave)).toEqual([FAMILIA_PLAN_SIN_LEER]);
    expect(familiaAbierta(c, grupos, null, null)).toBe(FAMILIA_PLAN_SIN_LEER);
  });

  it("abre la pedida, o la de la regla del foco, o la primera con reglas", () => {
    const c = catalogo();
    const grupos = columnaDeFamilias(c, 0);
    expect(familiaAbierta(c, grupos, "salto", null)).toBe("salto");
    expect(familiaAbierta(c, grupos, "no-existe", "RC_1")).toBe("rango_num");
    expect(familiaAbierta(c, grupos, null, null)).toBe("obligatoria");
  });

  it("la dirección con familia=propias, escrita cuando no había propias, abre la primera propia que aparece al guardar (ítem 45.2)", () => {
    const c = catalogo();
    const grupos = columnaDeFamilias(c, 0);
    expect(familiaAbierta(c, grupos, FAMILIA_PROPIAS_VACIA, null)).toBe("rango_num");
    // Sin propias, "propias" sigue siendo la entrada vacía.
    const sinPropias = catalogo({ familias: [{ origen: "formulario", familia: "salto", nombre: "Saltos", n: 2 }] });
    expect(familiaAbierta(sinPropias, columnaDeFamilias(sinPropias, 0), FAMILIA_PROPIAS_VACIA, null)).toBe(FAMILIA_PROPIAS_VACIA);
  });
});

describe("lista y regla elegida", () => {
  it("sin evaluar reúne por estado; cada regla conserva su familia", () => {
    const c = catalogo();
    expect(reglasDeLaFamilia(c, FAMILIA_SIN_EVALUAR).map((r) => r.id)).toEqual(["VR_req"]);
    expect(reglasDeLaFamilia(c, "obligatoria").map((r) => r.id)).toEqual(["VR_req"]);
    expect(reglasDeLaFamilia(c, FAMILIA_PROPIAS_VACIA)).toEqual([]);
  });

  it("elige por id o por id del motor; si no, la primera", () => {
    const reglas = reglasDeLaFamilia(catalogo(), "salto");
    expect(reglaElegida(reglas, "VR_nodebe")?.id).toBe("VR_nodebe");
    expect(reglaElegida(reglas, "no-esta")?.id).toBe("VR_debe");
    expect(reglaElegida([], null)).toBeNull();
  });

  it("la pareja del salto se cruza por id", () => {
    const c = catalogo();
    expect(parejaDe(c, c.reglas[1])?.id).toBe("VR_nodebe");
    expect(parejaDe(c, c.reglas[3])).toBeNull();
  });
});

describe("textos de la fila y de la ficha", () => {
  it("casos, decididos, sin evaluar y desactivada", () => {
    const c = catalogo();
    expect(estadoDeFila(c.reglas[0])).toEqual({ tipo: "sin-evaluar", causa: "Depende de un listado externo" });
    expect(estadoDeFila(c.reglas[1])).toEqual({ tipo: "casos", cifra: "4", unidad: "casos", decididos: "1 decidido" });
    expect(estadoDeFila(c.reglas[2])).toEqual({ tipo: "desactivada" });
    expect(estadoDeFila(c.reglas[3])).toMatchObject({ decididos: "todos decididos" });
  });

  it("sin auditoría la regla está sin auditar; con 0 casos, sin casos", () => {
    const c = catalogo();
    expect(estadoDeFila({ ...c.reglas[1], ultima_auditoria: null })).toEqual({ tipo: "sin-auditar" });
    const cero = { ...c.reglas[1], ultima_auditoria: { ...c.reglas[1].ultima_auditoria!, n_casos: 0 } };
    expect(estadoDeFila(cero)).toEqual({ tipo: "sin-casos" });
  });

  it("el tratamiento y su alcance; la base con su definición", () => {
    expect(textoDeTratamiento({ accion: null, alcance: null })).toBe("Sin propuesta");
    expect(textoDeTratamiento({ accion: "nullify_fields", alcance: "all" })).toBe("Vaciar la respuesta");
    expect(textoDeTratamiento({ accion: "ignore_rule", alcance: "single" })).toBe("Sin propuesta, uno por uno");
    expect(textoDeBase(catalogo().reglas[1].ultima_auditoria!)).toBe("142 a quienes les correspondía responder");
  });
});

describe("cabecera", () => {
  it("activas sobre el total, sin evaluar con su punto y la fecha de la última auditoría", () => {
    const cifras = cifrasDeReglas(catalogo());
    expect(cifras.map((c) => `${c.valor}${c.base ? `/${c.base}` : ""} ${c.rotulo}`)).toEqual([
      "3/4 reglas activas",
      "1 sin evaluar",
      "8 nov última auditoría",
    ]);
    expect(cifras[1].tono).toBe("alerta");
  });

  it("sin auditoría no hay fecha; con resultado guardado sin fecha, lo dice", () => {
    const sinAuditar = catalogo({ auditada_en: null, reglas: [regla("A")] });
    expect(cifrasDeReglas(sinAuditar).map((c) => c.clave)).toEqual(["reglas-activas", "sin-evaluar"]);
    const sinFecha = catalogo({ auditada_en: null });
    expect(cifrasDeReglas(sinFecha).at(-1)?.valor).toBe("Sin fecha");
  });
});

describe("franja de las reglas a los hallazgos", () => {
  const cola = [
    { hallazgo_kind: "inconsistencia_xlsform" as const, pending: true },
    { hallazgo_kind: "inconsistencia_usuario" as const, pending: false },
    { hallazgo_kind: "caso_validar" as const, pending: true },
  ];

  it("reglas por origen, casos auditados y hallazgos por clase (D-F1: uno por regla de la cola)", () => {
    const grupos = gruposDeLaFranja(catalogo(), { nCasosAuditados: 178, cola });
    expect(grupos.map((g) => g.cifras.map((c) => `${c.cifra} ${c.texto}`))).toEqual([
      ["3 del formulario", "0 del operativo", "1 propia"],
      ["178 casos, el 8 nov"],
      ["2 reglas con inconsistencias", "1 regla con casos a revisar"],
    ]);
    let llevado = false;
    const destino = destinoDeLaFranja(catalogo(), { nCasosAuditados: 178, cola }, () => { llevado = true; });
    expect(destino.rotulo).toBe("Por decidir");
    expect(destino.cifra).toBe(2);
    destino.onClick?.({} as never);
    expect(llevado).toBe(true);
  });

  it("sin auditoría la franja termina en un dato, sin cifras de hallazgos", () => {
    const c = catalogo({ auditada_en: null, reglas: [regla("A")] });
    expect(gruposDeLaFranja(c, { nCasosAuditados: null, cola: null }).map((g) => g.id)).toEqual(["reglas"]);
    expect(destinoDeLaFranja(c, { nCasosAuditados: null, cola: null }, () => undefined)).toEqual({ rotulo: "Hallazgos", texto: "al auditar" });
  });

  it("los avisos de una regla se reúnen por código; los generales van tal cual", () => {
    const c = catalogo({
      avisos: [
        { codigo: "valor_fuera_de_opciones", id_regla: "VR_debe", texto: "El formulario compara \"P\" con \"1\"." },
        { codigo: "valor_fuera_de_opciones", id_regla: "VR_req", texto: "El formulario compara \"Q\" con \"2\"." },
        { codigo: "auditoria_con_reglas_fuera", ids: ["VR_x"], texto: "La última auditoría tiene 5 reglas que ya no están." },
      ],
    });
    expect(avisosDeLaFranja(c).map((a) => a.texto)).toEqual([
      "2 reglas comparan una pregunta con un valor que no está entre sus opciones.",
      "La última auditoría tiene 5 reglas que ya no están.",
    ]);
    expect(avisosDeLaRegla(c, c.reglas[1]).map((a) => a.texto)).toEqual(["El formulario compara \"P\" con \"1\"."]);
  });
});
