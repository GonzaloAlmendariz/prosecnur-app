/**
 * El paso que VACÍA el marco tiene que nombrarse a sí mismo.
 *
 * Hasta 2026-08-25 un paso en 0 se pintaba `estado: "pending"` —el mismo estado
 * que un paso que aún no corrió— y su cifra desaparecía (`valor: undefined`).
 * Con el marco en 0, TODOS los pasos posteriores caen a 0 y se pintan igual,
 * así que la pantalla mostraba una cola de pasos apagados y ninguno decía cuál
 * había roto la cadena. Medido en HSVG26DEF: `course_level` pasaba de 3.630 a 0
 * en el paso 11 y el analista lo leía en los pasos 12-18 (session_type,
 * teacher_type…), nueve criterios por debajo de la causa.
 *
 * Quién vacía el marco lo decide el MOTOR, que es el único que ve el conteo de
 * entrada: aquí un `conteo === 0` no distingue al criterio que mató el marco de
 * los que heredaron su cero.
 */
import { describe, expect, it } from "vitest";
import type { EmbudoPaso } from "../../../dominio";
import { embudoEtapas } from "../embudoEtapas";

const paso = (p: Partial<EmbudoPaso> & { id: string; conteo: number }): EmbudoPaso => ({
  label: p.id,
  porQue: "",
  ...p,
});

describe("embudoEtapas — el criterio que vacía el marco", () => {
  it("marca SOLO al que vacía, no a los que heredan su cero", () => {
    const etapas = embudoEtapas(
      [
        paso({ id: "total", label: "Curso-horario únicos", conteo: 3630 }),
        paso({
          id: "course_level",
          label: "+ Nivel del curso",
          conteo: 0,
          vaciaMarco: true,
          aviso: "«+ Nivel del curso» dejó el marco en 0: entraron 3 630 aulas a este paso y no pasó NINGUNA.",
        }),
        paso({ id: "session_type", label: "+ Tipo de sesión", conteo: 0 }),
        paso({ id: "teacher_type", label: "+ Tipo de docente", conteo: 0 }),
      ],
      "aulas",
    );

    const porId = new Map(etapas.map((e) => [e.id, e]));
    expect(porId.get("course_level")!.estado).toBe("alerta");
    expect(porId.get("course_level")!.detalle).toContain("dejó el marco en 0");

    // Los que heredan el cero NO se acusan: siguen pendientes y sin aviso.
    for (const id of ["session_type", "teacher_type"]) {
      expect(porId.get(id)!.estado).toBe("pending");
      expect(porId.get(id)!.detalle).toBeUndefined();
    }
  });

  it("el paso que vacía conserva su cifra en vez de desaparecerla", () => {
    // Un 0 sin cifra se lee como «no calculado». El 0 es EL dato.
    const [etapa] = embudoEtapas(
      [paso({ id: "course_level", label: "+ Nivel", conteo: 0, vaciaMarco: true, aviso: "x" })],
      "aulas",
    );
    expect(etapa.valor).toBe("0");
    expect(etapa.estado).toBe("alerta");
  });

  it("un embudo sano no levanta ninguna alerta", () => {
    const etapas = embudoEtapas(
      [
        paso({ id: "total", label: "Total", conteo: 3630 }),
        paso({ id: "course_level", label: "+ Nivel", conteo: 1222 }),
      ],
      "aulas",
    );
    expect(etapas.every((e) => e.estado !== "alerta")).toBe(true);
    expect(etapas.every((e) => e.detalle === undefined)).toBe(true);
  });

  it("un paso en 0 SIN sello del motor sigue siendo pendiente, no alerta", () => {
    // Frames viejos no traen `vacia_marco`. El front no inventa el veredicto.
    const [, etapa] = embudoEtapas(
      [paso({ id: "total", label: "Total", conteo: 10 }), paso({ id: "nivel", label: "+ Nivel", conteo: 0 })],
      "aulas",
    );
    expect(etapa.estado).toBe("pending");
  });
});
