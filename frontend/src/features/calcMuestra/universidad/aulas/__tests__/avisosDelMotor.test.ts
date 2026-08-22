/**
 * V2 del goal loop de Selección: el motor no habla en la UI.
 *
 * El caso que abrió esta línea es el primero: llegaba literal a la pantalla,
 * sin tildes y con `pi_design` adentro.
 */
import { describe, expect, it } from "vitest";

import { naturalezaDelAviso, avisoEsTecnico, traducirAvisoDelMotor } from "../avisosDelMotor";

const CRUDO_PI = [
  "Comparacion de metodos con descuento secuencial aplicado al sorteo:",
  "las pi de esta tarjeta son referenciales del diseno estatico",
  "(pi_design); la pi del proceso secuencial solo se estima por Monte",
  "Carlo en la seleccion final, no en la comparacion.",
].join(" ");

describe("avisos del motor · no se leen crudos", () => {
  it("el aviso de las pi referenciales se traduce y guarda su crudo", () => {
    const aviso = traducirAvisoDelMotor(CRUDO_PI);
    expect(aviso.titulo).toBe("Las probabilidades de esta tarjeta son del diseño, no del sorteo");
    expect(aviso.mostrarCrudo).toBe(true);
    // Lo que se lee primero no trae identificadores ni palabras sin tilde.
    expect(aviso.resumen).not.toMatch(/pi_design|comparacion|seleccion|diseno/);
    expect(aviso.resumen).toContain("descuento de repetidos");
  });

  it("dos avisos distintos del motor dejan de llamarse igual", () => {
    // R mandaba los dos bajo «Fallback metodológico»; dos cosas distintas con
    // el mismo nombre se leen como una repetida (V3).
    const a = traducirAvisoDelMotor(CRUDO_PI);
    const b = traducirAvisoDelMotor("sampling::samplecube() no disponible o fallo; se uso sistematico_pps.");
    expect(a.titulo).not.toBe(b.titulo);
    expect(a.titulo).toBeTruthy();
    expect(b.titulo).toBeTruthy();
  });

  it("detecta la jerga por identificador Y por falta de tildes", () => {
    expect(avisoEsTecnico("sampling::UPsystematic falló")).toBe(true);
    expect(avisoEsTecnico("el eligible_n del estrato quedó en 0")).toBe(true);
    // Sin `::` ni identificadores: la única señal es el castellano sin tilde,
    // que es lo que dejaba pasar la detección anterior.
    expect(avisoEsTecnico("La comparacion de metodos no cerro")).toBe(true);
  });

  it("un aviso ya escrito para el usuario pasa intacto y sin disclosure", () => {
    const humano = "7 celda(s) tienen menos reservas que titulares.";
    const aviso = traducirAvisoDelMotor(humano);
    expect(aviso.resumen).toBe(humano);
    expect(aviso.mostrarCrudo).toBe(false);
    expect(aviso.titulo).toBeNull();
  });

  it("un aviso técnico desconocido se resume sin prometer de más", () => {
    const aviso = traducirAvisoDelMotor("el stratum quedó sin discount_step publicado");
    expect(aviso.mostrarCrudo).toBe(true);
    expect(aviso.titulo).toBeNull();
    expect(aviso.resumen).not.toMatch(/stratum|discount_step/);
  });

  it("un detalle vacío no inventa contenido", () => {
    expect(traducirAvisoDelMotor("").mostrarCrudo).toBe(false);
    expect(traducirAvisoDelMotor("   ").resumen).toContain("auditoría técnica");
  });
});

describe("el título del aviso de sorteo dice lo que el aviso trae", () => {
  const soloBalance = "balance del sorteo | balance del sorteo | balance del sorteo | balance del sorteo";
  const soloAjuste = "ajuste de tamano divulgado | ajuste de tamano divulgado";
  const ambos = "ajuste de tamano divulgado | balance del sorteo";

  it("un aviso que sólo balanceó no anuncia que ajustó tamaños", () => {
    const { titulo, resumen } = traducirAvisoDelMotor(soloBalance);
    expect(titulo).toBe("El sorteo balanceó con menos variables de las pedidas");
    // La prueba real del defecto: el título prometía «ajustó tamaños» sobre un
    // aviso donde no hubo ningún ajuste.
    expect(titulo ?? "").not.toMatch(/ajust/i);
    expect(resumen).toContain("4 estratos");
    expect(resumen).not.toContain("cuota y se corrigió");
  });

  it("un aviso que sólo corrigió cuotas no anuncia que balanceó", () => {
    const { titulo, resumen } = traducirAvisoDelMotor(soloAjuste);
    expect(titulo).toBe("El sorteo corrigió cuotas que no salieron exactas");
    expect(titulo ?? "").not.toMatch(/balance/i);
    expect(resumen).toContain("2 estratos");
  });

  it("dos avisos con contenidos distintos no comparten título", () => {
    const a = traducirAvisoDelMotor(soloBalance).titulo;
    const b = traducirAvisoDelMotor(ambos).titulo;
    expect(a).not.toBe(b);
  });

  it("el aviso con las dos cosas las nombra las dos", () => {
    const { titulo, resumen } = traducirAvisoDelMotor(ambos);
    expect(titulo).toMatch(/cuotas/i);
    expect(titulo).toMatch(/balance/i);
    expect(resumen).toContain("1 estrato ");
    expect(resumen).not.toContain("1 estratos");
  });
});

describe("un aviso declara qué clase de cosa es, no sólo su gravedad", () => {
  // Los cinco avisos reales de HSVG2026 el 2026-08-22, todos con severity
  // «media». Gonzalo: «¿a qué se deben tantas alertas, es porque algo está
  // mal?». Sólo uno pedía algo.
  const reales = [
    { code: "reservas_profundidad", severity: "media", title: "Baja profundidad de reservas", detail: "5 celda(s) tienen menos reservas que titulares." },
    { code: "", severity: "media", title: "", detail: "comparacion de metodos con descuento secuencial" },
    { code: "", severity: "media", title: "", detail: "balance del sorteo | balance del sorteo" },
    { code: "", severity: "media", title: "", detail: "ajuste de tamano divulgado | balance del sorteo" },
    { code: "", severity: "media", title: "", detail: "requiere al menos 100 corridas" },
  ];

  it("de los cinco avisos reales sólo uno pide una decisión", () => {
    const nat = reales.map(naturalezaDelAviso);
    expect(nat.filter((n) => n === "asunto")).toHaveLength(1);
    expect(nat.filter((n) => n === "nota")).toHaveLength(3);
    expect(nat.filter((n) => n === "pendiente")).toHaveLength(1);
  });

  it("las cifras de salud que cruzan su umbral son asuntos, no notas", () => {
    expect(naturalezaDelAviso({ code: "salud_cv_pesos", severity: "media", title: "CV alto", detail: "" })).toBe("asunto");
  });

  it("un aviso sin señal conocida se trata como asunto", () => {
    // Callar algo que pedía atención es peor que pedir atención de más.
    expect(naturalezaDelAviso({ code: "xyz_desconocido", severity: "media", title: "?", detail: "?" })).toBe("asunto");
  });

  it("un ok no es ninguna de las tres", () => {
    expect(naturalezaDelAviso({ code: "sin_alertas", severity: "ok", title: "", detail: "" })).toBe("ok");
  });
});
