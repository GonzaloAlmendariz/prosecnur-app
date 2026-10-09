import type { MonitoreoRow } from "../../../../api/monitoreo";
import { sexSeriesKind } from "../../../calcMuestra/sexoPalette";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type CeldaDeFacultad = {
  facultad: string;
  /** Recogido y por recoger, en PERSONAS, para cada sexo. */
  mujeresLogrado: number;
  /** Lo que traerán las aulas del plan que faltan por aplicar. */
  mujeresPendiente: number;
  /** Lo que seguirá faltando DESPUÉS de aplicarlas todas. */
  mujeresDeficit: number;
  hombresLogrado: number;
  hombresPendiente: number;
  hombresDeficit: number;
  /** El déficit proyectado de la facultad entera; el orden se decide con esto. */
  deficit: number;
  /** La cuota de cada celda: dónde está la meta, para poder marcarla. */
  mujeresCuota: number;
  hombresCuota: number;
};

/**
 * Cuántos hombres y cuántas mujeres lleva cada facultad, y cuántos le faltan.
 *
 * **No es el estrato del sorteo.** El panel de estratos dibujaba
 * `FACULTAD / F / G3` traducido como «mayoría mujeres · 41 alumnos o más», que
 * es el grupo con el que se REPARTIÓ la muestra de aulas: su sexo es el
 * dominante del aula, no el del alumno. Gonzalo: «cómo vas a poner mayoría
 * hombres o mayoría mujeres cuando eso no me interesa; lo que me interesa es
 * cuántos hombres y cuántas mujeres».
 *
 * Un aula «mayoría hombres» tiene mujeres dentro y aporta a las dos celdas de
 * cuota. La cuota es de personas y por eso esta lectura sale de
 * `avance_sexo_facultad` —la celda facultad × sexo del ALUMNO— y no del estrato.
 *
 * Todo en personas enteras: media encuesta no existe.
 *
 * Y en TRES tramos, no dos: lo recogido, lo que traerán las aulas del plan que
 * faltan por aplicar, y el déficit que quedará aun así. Con dos, la barra no
 * suma la cuota y «faltan» acaba nombrando al déficit proyectado, que es otro
 * número.
 */
export function celdasPorFacultad(celdas: ReadonlyArray<MonitoreoRow>): CeldaDeFacultad[] {
  const porFacultad = new Map<string, CeldaDeFacultad>();

  for (const c of celdas) {
    const facultad = txt(c.faculty) || "Sin facultad";
    // No se compara contra `"F"`/`"M"` literales: el `sex` sale de la columna
    // del estudio tal cual (`monitoreo_aulas_universitarias.R:1586`), y uno que
    // diga «Mujer»/«Hombre» —el mapeo del proyecto de auditoría— caía en este
    // `continue` y dejaba el panel entero vacío sin decir por qué. Descartar en
    // silencio lo que no se reconoce es el defecto, no la protección.
    const kind = sexSeriesKind(txt(c.sex));
    if (kind !== "female" && kind !== "male") continue;
    const sexo = kind === "female" ? "F" : "M";

    const fila = porFacultad.get(facultad) ?? {
      facultad,
      mujeresLogrado: 0, mujeresPendiente: 0, mujeresDeficit: 0,
      hombresLogrado: 0, hombresPendiente: 0, hombresDeficit: 0,
      deficit: 0, mujeresCuota: 0, hombresCuota: 0,
    };
    // **Tres tramos, no dos, y esto es lo que hace honesto al gráfico.**
    //
    // `brecha` de la celda es `cuota − PROYECCIÓN`, o sea el déficit que
    // quedará después de aplicar todas las aulas del plan. Pintarla como
    // «faltan» al lado de lo recogido deja fuera la pieza del medio —lo que
    // esas aulas van a traer— y hace que las dos barras no sumen la cuota.
    // Es el rótulo que promete un número y entrega otro.
    const logrado = Math.max(0, Math.round(num(c.logrado)));
    const pendiente = Math.max(0, Math.round(num(c.aporte_pendiente)));
    const deficit = Math.max(0, Math.ceil(num(c.brecha) - 1e-9));
    const cuota = Math.max(0, Math.round(num(c.cuota)));
    if (sexo === "F") {
      fila.mujeresCuota += cuota;
      fila.mujeresLogrado += logrado;
      fila.mujeresPendiente += pendiente;
      fila.mujeresDeficit += deficit;
    } else {
      fila.hombresCuota += cuota;
      fila.hombresLogrado += logrado;
      fila.hombresPendiente += pendiente;
      fila.hombresDeficit += deficit;
    }
    fila.deficit += deficit;
    porFacultad.set(facultad, fila);
  }

  // Manda el déficit proyectado, que es lo que exige una decisión: lo que ya
  // está agendado se resuelve solo. A igualdad, orden alfabético para que la
  // lista no baile entre recargas.
  return [...porFacultad.values()].sort(
    (a, b) => b.deficit - a.deficit || a.facultad.localeCompare(b.facultad, "es"),
  );
}
