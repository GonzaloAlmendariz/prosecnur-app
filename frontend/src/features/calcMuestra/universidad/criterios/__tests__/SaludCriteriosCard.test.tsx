/**
 * El aviso de un criterio que no se puede evaluar llega al analista, no sólo al
 * motor.
 *
 * El mismo defecto volvió cuatro veces: un criterio declarado sobre una columna
 * que no lleva lo que dice, y el marco se publica igual. El motor ya lo detecta
 * (`calc_muestra_aulas_salud_criterios`); esto comprueba que se ve.
 *
 * La distinción que la tarjeta existe para hacer: un criterio SIN SEÑAL deja
 * pasar a todos porque no había con qué filtrar, y eso no es lo mismo que uno
 * que se midió y no dejó fuera a nadie.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  normalizeCalcMuestraSaludCriterios,
  type CalcMuestraSaludCriterios,
} from "../../../../../api/calcMuestra";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
} from "../../../../../api/client";
import { CriteriosMarcoTab } from "../CriteriosMarcoTab";
import { SaludCriteriosCard } from "../SaludCriteriosCard";

const CRUDO = {
  schema: "calc_muestra_aulas_salud_criterios_v1",
  grain: "criterio",
  filas: [
    {
      criterion_id: "session_type", label: "Tipo de sesión", columna: "session_type",
      columna_en_el_marco: true, aulas: 5263, aulas_con_valor: 0, kind: "flat",
      categorias_declaradas: 1, categorias_presentes: 0, categorias_ausentes: ["teorico"],
      estado: "sin_senal",
      aviso: "«Tipo de sesión» está declarado pero su columna llega vacía en las 5263 aulas del marco: el criterio no puede filtrar a nadie y no es que deje pasar a todos.",
      por_facultad: [
        { facultad: "DERECHO", aulas: 575, con_valor: 0 },
        { facultad: "GESTIÓN", aulas: 184, con_valor: 0 },
      ],
    },
    {
      criterion_id: "modality", label: "Modalidad", columna: "modality",
      columna_en_el_marco: true, aulas: 5263, aulas_con_valor: 5263, kind: "flat",
      categorias_declaradas: 1, categorias_presentes: 1, categorias_ausentes: [],
      estado: "ok", aviso: "",
      por_facultad: [{ facultad: "DERECHO", aulas: 575, con_valor: 575 }],
    },
  ],
};

function pintar(salud: CalcMuestraSaludCriterios | null): string {
  return renderToStaticMarkup(<SaludCriteriosCard salud={salud} />);
}

describe("normalizador de la salud de criterios", () => {
  it("acepta el payload de R con escalares envueltos en array", () => {
    // R serializa un escalar como array de uno; sin esto la tarjeta no vería
    // ninguna fila y el aviso se perdería en silencio.
    const s = normalizeCalcMuestraSaludCriterios({
      filas: [{ ...CRUDO.filas[0], criterion_id: ["session_type"], aulas: [5263], estado: ["sin_senal"] }],
    });
    expect(s?.filas[0].criterion_id).toBe("session_type");
    expect(s?.filas[0].aulas).toBe(5263);
    expect(s?.filas[0].estado).toBe("sin_senal");
  });

  it("descarta una fila sin criterio y no inventa un bloque vacío", () => {
    expect(normalizeCalcMuestraSaludCriterios({ filas: [{ label: "sin id" }] })).toBeNull();
    expect(normalizeCalcMuestraSaludCriterios(null)).toBeNull();
    expect(normalizeCalcMuestraSaludCriterios({ filas: [] })).toBeNull();
  });

  it("un estado desconocido no se cuela como si fuera válido", () => {
    const s = normalizeCalcMuestraSaludCriterios({
      filas: [{ criterion_id: "x", estado: "inventado" }],
    });
    expect(s?.filas[0].estado).toBe("desconocido");
  });
});

describe("tarjeta de salud de criterios", () => {
  it("dice cuál no se puede evaluar, con su cifra y su aviso", () => {
    const html = pintar(normalizeCalcMuestraSaludCriterios(CRUDO));
    expect(html).toContain('data-estado="alerta"');
    expect(html).toContain("Un criterio no se puede evaluar");
    expect(html).toContain("Tipo de sesión");
    expect(html).toContain("0 de 5,263 aulas con dato");
    // La frase que hace la distinción que faltó cuatro veces.
    expect(html).toContain("no es que deje pasar a todos");
  });

  it("CONTROL: el criterio sano NO aparece en la lista de problemas", () => {
    // Si todo se listara, la tarjeta dejaría de señalar y volvería a esconder.
    const html = pintar(normalizeCalcMuestraSaludCriterios(CRUDO));
    expect(html).not.toContain("Modalidad");
    expect(html).toContain("Los otros 1 sí");
  });

  it("con todo sano lo dice CON la cifra, no con un «todo bien»", () => {
    // «Todo bien» sin número no distingue un marco sano de una comprobación que
    // no llegó a correr.
    const sano = { ...CRUDO, filas: [CRUDO.filas[1]] };
    const html = pintar(normalizeCalcMuestraSaludCriterios(sano));
    expect(html).toContain('data-estado="ok"');
    expect(html).toContain("<strong>1</strong> criterios declarados");
    expect(html).not.toContain("no se puede evaluar");
  });

  it("publica el desglose por facultad de las que no llegan a todas sus aulas", () => {
    const html = pintar(normalizeCalcMuestraSaludCriterios(CRUDO));
    expect(html).toContain("las 2 facultades donde falta dato");
  });

  it("sin bloque no dibuja nada", () => {
    expect(pintar(null)).toBe("");
    expect(pintar(normalizeCalcMuestraSaludCriterios({ filas: [] }))).toBe("");
  });
});

/**
 * El montaje, que es lo que de verdad protege.
 *
 * Con la tarjeta desmontada de la pestaña, los 1.413 tests de calcMuestra
 * seguían en verde: un test del componente suelto NO protege que alguien lo
 * pinte. Éste falla si se desmonta.
 */
describe("la tarjeta vive en la pestaña de Criterios", () => {
  const workspace = {
    version: 2,
    frame_mode: "sin_definir",
    marco_disponible: "",
    fuente_marco: "",
    unidad_observacion: "estudiante",
    unidad_muestreo: "curso-horario",
    variables_control: [],
    escenarios: [],
    notas_diseno: "",
    aulas_config: { criterios_seleccion: { byVariable: {} } },
  } as unknown as CalcMuestraWorkspace;

  function pestana(salud: unknown): string {
    const state = {
      frame: {
        schema: "calc_muestra_aulas_frame_v1",
        generated_at: "2026-08-17T00:00:00Z",
        input_mode: "base_madre",
        config: {},
        frame_hash: "salud-montaje",
        aula_frame: [{ classroom_id: "CH-1", included: true, eligible_n: 30 }],
      },
      salud_criterios: salud,
    } as unknown as CalcMuestraAulasState;
    return renderToStaticMarkup(
      <CriteriosMarcoTab
        workspace={workspace}
        aulasState={state}
        facultades={[]}
        onWorkspace={() => {}}
        onReconstruir={() => {}}
        puedeReconstruir
        scope="alumno"
      />,
    );
  }

  it("el aviso aparece en la pestaña, no sólo en el componente", () => {
    const html = pestana(CRUDO);
    expect(html).toContain("cmv2-salud-card");
    expect(html).toContain("Tipo de sesión");
    expect(html).toContain("no es que deje pasar a todos");
  });

  it("CONTROL: sin bloque la pestaña no pinta la tarjeta", () => {
    // Si apareciera igual, el test de arriba no probaría que depende del dato.
    expect(pestana(null)).not.toContain("cmv2-salud-card");
  });
});
