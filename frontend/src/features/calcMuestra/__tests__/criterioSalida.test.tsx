/**
 * El criterio de salida de un componente de cuotas se lee del motor.
 *
 * Medido contra `calc_muestra_calcular_estudio` (R): un componente de egresados
 * con técnica de cuotas y marco validado de 40 sale calculado con
 * `n_objetivo = 20`. La tabla hacía
 * `meta.valor || inferencia_acreditacion?.minimo_cuota || 150` y publicaba
 * «Cuota 150» —la regla de docentes con N ≥ 251— sobre ese componente: siete
 * veces y media lo que el motor había decidido.
 *
 * Y el `|| 150` era alcanzable de verdad: con el canal sin definir el motor no
 * puebla la inferencia de acreditación (`minimo_cuota` viaja vacía) pero SÍ
 * calcula el componente, que es justo el estado en el que la pantalla caía a la
 * constante.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  criterioSalida,
  cuotaDelComponente,
  metaCuotaFijada,
  sugerenciaCuota,
} from "../criterioSalida";
import { NumberCell } from "../universidad/aulas/NumberCell";
import type { CalcMuestraComponente } from "../../../api/client";

function egresados(
  resultado: Record<string, unknown> | null,
  meta: Record<string, unknown> = { valor: 0 },
  extra: Record<string, unknown> = {},
): CalcMuestraComponente {
  return {
    id: "cmp-1",
    actor: "Egresados",
    actor_id: "egresados",
    actor_categoria: "egresados",
    canal_recojo: "sin_definir",
    tecnica: "no_prob_cuotas",
    marco: { estado: "validado", marco_validado: 40, estratos: [] },
    parametros: {},
    meta,
    resultado,
    ...extra,
  } as unknown as CalcMuestraComponente;
}

describe("criterio de salida de un componente de cuotas", () => {
  it("publica la cuota que calculó el motor, no una constante", () => {
    // El caso medido en R: marco 40 → n_objetivo 20.
    expect(criterioSalida(egresados({ n_objetivo: 20 }))).toBe("Cuota 20");
  });

  it("nunca publica 150 cuando el motor no lo dijo", () => {
    const texto = criterioSalida(egresados({ n_objetivo: 20 }));
    expect(texto).not.toContain("150");
  });

  it("sin cuota decidida lo dice, en vez de inventar una", () => {
    // Ni resultado con n_objetivo ni meta: el criterio no está fijado.
    expect(criterioSalida(egresados({ n_objetivo: 0 }))).toBe("Cuota sin fijar");
    expect(criterioSalida(egresados({}))).toBe("Cuota sin fijar");
  });

  it("respeta la meta que fijó el usuario cuando el motor la devuelve", () => {
    // Control: `n_objetivo` ya incorpora la meta (medido: meta 90 → n 90).
    expect(criterioSalida(egresados({ n_objetivo: 90 }, { valor: 90 }))).toBe(
      "Cuota 90",
    );
  });

  it("cae a la meta si el resultado no trae objetivo", () => {
    expect(cuotaDelComponente(egresados({}, { valor: 120 }))).toBe(120);
  });

  it("un componente sin calcular sigue pendiente", () => {
    expect(criterioSalida(egresados(null))).toBe("Pendiente");
  });

  it("las demás técnicas conservan su lectura", () => {
    // Control: el cambio se limita a las cuotas.
    const conv = egresados({ n_objetivo: 20 }, { valor: 0 }, {
      tecnica: "no_prob_conveniencia",
      parametros: { cobertura_objetivo: 0.8 },
    });
    expect(criterioSalida(conv)).toContain("Cobertura");
    const otros = egresados({ n_objetivo: 20, cuotas_matriz: [{}, {}] }, { valor: 0 }, {
      actor_categoria: "otros",
    });
    expect(criterioSalida(otros)).toBe("Cuotas por celda");
  });
});

describe("campo editable de la meta de cuota", () => {
  /**
   * La MISMA cadena `meta.valor || minimo_cuota || 150` estaba en dos
   * superficies: la tabla y el campo editable de `AcreditacionTargetCell`. En
   * el campo era peor: precargaba 150 sobre una meta que nadie fijó, y basta
   * con guardar para convertir esa invención en la meta del estudio.
   */
  it("no precarga ninguna cifra cuando el usuario no fijó meta", () => {
    expect(metaCuotaFijada(egresados({ n_objetivo: 20 }, { valor: 0 }))).toBeNull();
    expect(metaCuotaFijada(egresados({ n_objetivo: 20 }, {}))).toBeNull();
  });

  it("muestra la meta que el usuario sí fijó", () => {
    expect(metaCuotaFijada(egresados({ n_objetivo: 90 }, { valor: 90 }))).toBe(90);
  });

  it("la sugerencia es la cifra del motor, nunca una constante", () => {
    expect(sugerenciaCuota(egresados({ n_objetivo: 20 }))).toBe(20);
    expect(sugerenciaCuota(egresados({}))).toBeNull();
    expect(sugerenciaCuota(egresados({ n_objetivo: 20 }))).not.toBe(150);
  });

  it("el campo queda vacío con la sugerencia como placeholder", () => {
    // Contrato de NumberCell: `null` pinta el campo vacío, y la cifra del motor
    // viaja como sugerencia sin quedar fijada.
    const comp = egresados({ n_objetivo: 20 }, { valor: 0 });
    const html = renderToStaticMarkup(
      <NumberCell
        value={metaCuotaFijada(comp)}
        placeholder={String(sugerenciaCuota(comp))}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('value=""');
    expect(html).toContain('placeholder="20"');
  });
});
