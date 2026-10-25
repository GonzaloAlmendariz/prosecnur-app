import { describe, expect, it } from "vitest";
import {
  diaDeMetaCumplida,
  efectivasPorCanal,
  marcasDeEje,
  proyeccion,
  rezagadosPrimero,
  serieDiaria,
  totalesDeAvance,
  ultimosDias,
} from "./avanceModelo";
import { advanceCardsFromRows } from "./tarjetasDeAvance";
import { casosDelCorte } from "../control/casos/tiposDeCaso";
import { insigniasDeAcreditacion, valorDePublicos } from "../navegacion/barraAcreditacion";

// Las cuatro filas de `client_report.actors` de la copia de Contabilidad
// (corte 23/07/26), con `Meta` vacía como llega del motor (H6): la meta sale
// de `config.goals`, igual que en la app.
const ACTORES = [
  { Actor: "Egresados", Universo: 270, Efectivas: 178, Parciales: 5, "Rechazos plataforma": 0, "Sin respuesta": 87, Meta: "" },
  { Actor: "Estudiantes", Universo: 180, Efectivas: 173, Parciales: 3, "Rechazos plataforma": 1, "Sin respuesta": 3, Meta: "" },
  { Actor: "Docentes", Universo: 53, Efectivas: 52, Parciales: 0, "Rechazos plataforma": 1, "Sin respuesta": 0, Meta: "" },
  { Actor: "Administrativos", Universo: 16, Efectivas: 15, Parciales: 0, "Rechazos plataforma": 1, "Sin respuesta": 0, Meta: "" },
];
const META = (actor: string, meta: number) => ({ id: actor, label: actor, meta, filters: { dim_actor: actor } });
const GOALS = [META("Administrativos", 15), META("Estudiantes", 126), META("Docentes", 38), META("Egresados", 108)];

describe("Avance de acreditación", () => {
  const tarjetas = advanceCardsFromRows(ACTORES, GOALS as never);

  it("los totales son los del glosario G4 (418 de 287, 519 personas)", () => {
    const totales = totalesDeAvance(tarjetas);
    expect(totales).toMatchObject({ universo: 519, efectivas: 418, parciales: 8, meta: 287, publicos: 4, conMeta: 4 });
    expect(insigniasDeAcreditacion({ efectivas: totales.efectivas, meta: totales.meta }, null)).toEqual({
      avance: { valor: "146 %", base: "418/287", lectura: "418 efectivas de una meta de 287" },
    });
    expect(valorDePublicos(tarjetas)).toBe("4");
  });

  it("un público sin meta se nombra en la barra", () => {
    const conPiloto = advanceCardsFromRows([...ACTORES, { Actor: "Piloto", Universo: 7, Efectivas: 2 }], GOALS as never);
    expect(valorDePublicos(conPiloto)).toBe("4 + Piloto");
  });

  it("rezagados primero y sin meta al final", () => {
    const conPiloto = advanceCardsFromRows([...ACTORES, { Actor: "Piloto", Universo: 7, Efectivas: 2 }], GOALS as never);
    expect(rezagadosPrimero(conPiloto).map((tarjeta) => tarjeta.actor)).toEqual(["Administrativos", "Docentes", "Estudiantes", "Egresados", "Piloto"]);
  });

  it("la serie diaria rehace el acumulado y encuentra el día de la meta", () => {
    const serie = serieDiaria([
      { Fecha: "2026-05-26", Efectivas: 8 },
      { Fecha: "2026-05-25", Efectivas: 25 },
      { Fecha: "sin fecha", Efectivas: 3 },
      { Fecha: "2026-05-27", Efectivas: 10 },
    ]);
    expect(serie.map((dia) => dia.acumulado)).toEqual([25, 33, 43]);
    expect(diaDeMetaCumplida(serie, 30)).toBe("2026-05-26");
  });

  it("la proyección usa el promedio de los últimos siete días", () => {
    const serie = serieDiaria(Array.from({ length: 10 }, (_, indice) => ({ Fecha: `2026-11-${String(indice + 1).padStart(2, "0")}`, Efectivas: indice < 3 ? 0 : 450 })));
    const lectura = proyeccion(serie, { ...totalesDeAvance(tarjetas), efectivas: 4997, meta: 8503 });
    expect(lectura).toEqual({ tipo: "faltan", faltan: 3506, ritmo: 450, dias: 8 });
    const ultimos = ultimosDias(serie);
    expect(ultimos.sinEfectivas).toBe(3);
    expect(ultimos.promedio7).toBe(450);
  });

  it("efectivas por canal del público", () => {
    const fuentes = [
      { Actor: "Egresados", Canal: "Telefónico", Efectivas: 117 },
      { Actor: "Egresados", Canal: "Correo", Efectivas: 40 },
      { Actor: "Egresados", Canal: "Enlace personalizado", Efectivas: 21 },
      { Actor: "Estudiantes", Canal: "Ficha QR", Efectivas: 173 },
    ];
    expect(efectivasPorCanal(fuentes, "Egresados")).toEqual([
      { canal: "Telefónico", efectivas: 117 },
      { canal: "Correo", efectivas: 40 },
      { canal: "Enlace personalizado", efectivas: 21 },
    ]);
  });

  it("marcas de eje redondas", () => {
    expect(marcasDeEje(450)).toEqual([0, 125, 250, 375, 500]);
    expect(marcasDeEje(9100)).toEqual([0, 2500, 5000, 7500, 10000]);
  });
});

describe("casos por resolver", () => {
  it("separa lo que espera decisión de lo resuelto por regla (Contabilidad: 23)", () => {
    const issues = [
      { issue_type: "duplicado_caso", label: "Caso duplicado", count: 53 },
      { issue_type: "parcial_identificable", label: "Parcial identificable", count: 30 },
      { issue_type: "rechazo_plataforma", label: "Rechazo de plataforma", count: 12 },
      { issue_type: "fuera_base", label: "Llave fuera de base", count: 11 },
      { issue_type: "parcial_no_identificable", label: "Parcial no identificable", count: 9 },
      { issue_type: "incluido_con_salvedad", label: "Incluido con salvedad", count: 3 },
      { issue_type: "sin_llave", label: "Respuesta sin llave", count: 2 },
      { issue_type: "conflicto_telefonico", label: "Conflicto telefónico", count: 1 },
    ].map((issue) => ({ ...issue, severity: "", actor: "", case_key: "", response_id: "", detail: "" }));
    const casos = casosDelCorte(issues);
    expect(casos.esperan).toBe(23);
    expect(casos.porTipo.filter((tipo) => tipo.grupo === "espera").map((tipo) => tipo.etiqueta)).toEqual([
      "Llave fuera de base", "Respuesta sin llave", "Conflicto telefónico", "Parcial no identificable",
    ]);
    expect(casos.porTipo.find((tipo) => tipo.tipo === "incluido_con_salvedad")?.etiqueta).toBe("Asignadas por el supervisor");
    expect(insigniasDeAcreditacion(null, casos)).toEqual({ control: "23" });
  });
});
