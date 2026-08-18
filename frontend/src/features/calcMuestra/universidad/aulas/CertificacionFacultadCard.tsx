/**
 * La certificación de la selección, POR FACULTAD.
 *
 * Gonzalo, textual: «siempre muy importante tener aulas tal que nos garantice
 * tener la cantidad de alumnos que nos hemos trazado en la meta (…) la
 * selección de aulas tiene que certificarse de esa forma». La afijación
 * garantiza las AULAS de cada facultad; esta tarjeta responde la pregunta
 * que sigue: ¿esas aulas cargan los ALUMNOS que la cuota exige, con la tasa
 * de asistencia esperada? Una facultad con sus N aulas puede no llegar si le
 * tocaron aulas chicas.
 *
 * El motor deriva la certificación al servir (nunca desfasada) y cada fila
 * trae su aviso con la cadena completa en una frase. Los estados que no son
 * «certificada» dicen la CAUSA (no cubre, sin tasa, sin titulares): un
 * hueco jamás se pinta como un cero medido.
 */
import type { CalcMuestraCertificacionFacultad } from "../../../../api/calcMuestra";
import { fmtInt } from "../../sharedCore";
import "./certificacionFacultad.css";

const ESTADO_LABEL: Record<string, string> = {
  certificada: "Certificada",
  no_cubre: "NO cubre",
  sin_titulares: "Sin titulares",
  sin_tasa: "Sin tasa declarada",
  sin_cuota: "Sin cuota trazada",
};

/** Celda compacta de la cuota de un sexo: margen y si cubre; el detalle
 *  (cuota → esperadas) viaja en el title. Sin celda para esta facultad → «—»,
 *  jamás un 0. */
function CeldaSexo({
  fila,
  sexo,
}: {
  fila: CalcMuestraCertificacionFacultad["filas"][number];
  sexo: "F" | "M";
}) {
  const celda = fila.sexo.find((c) => c.sexo === sexo);
  if (!celda || celda.margen == null) return <td>—</td>;
  const detalle = `${sexo === "F" ? "Mujeres" : "Hombres"}: cuota ${celda.cuota ?? "—"} · ${celda.elegibles ?? "—"} elegibles · ${celda.esperadas ?? "—"} esperadas`;
  return (
    <td title={detalle}>
      <span className="cmv2-cert-sexo" data-cubre={celda.cubre === true ? "si" : celda.cubre === false ? "no" : "sin_tasa"}>
        {celda.margen.toFixed(2).replace(".", ",")}×
      </span>
    </td>
  );
}

/** Una fila está comprometida si no cubre, si alguna celda de sexo no cubre,
 *  o si el margen queda al filo (≤ 1,05×): son las que piden decisión. */
function filaComprometida(f: CalcMuestraCertificacionFacultad["filas"][number]): boolean {
  if (f.estado === "no_cubre") return true;
  if (f.sexo.some((c) => c.cubre === false)) return true;
  return f.margen != null && f.margen <= 1.05;
}

export function CertificacionFacultadCard({
  certificacion,
  onAgregarAula,
}: {
  certificacion: CalcMuestraCertificacionFacultad | null;
  /** Acción REGISTRADA: fija los titulares de la facultad en (actuales + 1)
   *  en el estrato del estudio; el recálculo la aplica. Sin callback, la
   *  tarjeta es solo lectura (p. ej. en superficies de eco). */
  onAgregarAula?: (facultad: string, aulasActuales: number) => void;
}) {
  if (!certificacion || !certificacion.filas.length) return null;
  const { certificadas, evaluables, tasa_esperada, ok } = certificacion;

  return (
    <section className="cmv2-cert-card" aria-label="Certificación de la selección por facultad" data-ok={ok ? "si" : "no"}>
      <header>
        <strong>La selección, certificada facultad por facultad</strong>
        <span>
          {evaluables > 0 ? (
            <>
              <b data-tono={ok ? "bien" : "mal"}>
                {fmtInt(certificadas)} de {fmtInt(evaluables)}
              </b>{" "}
              facultades garantizan la cuota de alumnos que el diseño les trazó
              {tasa_esperada != null
                ? `, con la tasa de asistencia esperada de ${(tasa_esperada * 100).toFixed(1).replace(".", ",")} %`
                : ""}
              .
            </>
          ) : (
            <>Sin facultades evaluables todavía: {certificacion.filas[0]?.aviso}</>
          )}
        </span>
      </header>
      <div className="cmv2-cert-wrap">
        <table className="cmv2-cert-tabla">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col">Cuota</th>
              <th scope="col">Titulares</th>
              <th scope="col">Elegibles</th>
              <th scope="col">Esperadas</th>
              <th scope="col">Margen</th>
              <th scope="col">Mujeres</th>
              <th scope="col">Hombres</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {certificacion.filas.map((f) => (
              <tr key={f.faculty_key || f.facultad} data-estado={f.estado} title={f.aviso}>
                <th scope="row">{f.facultad}</th>
                <td>{f.cuota != null ? fmtInt(f.cuota) : "—"}</td>
                <td>{fmtInt(f.aulas_titulares)}</td>
                <td>{f.elegibles_titulares != null ? fmtInt(f.elegibles_titulares) : "—"}</td>
                <td>{f.efectivas_esperadas != null ? fmtInt(f.efectivas_esperadas) : "—"}</td>
                <td>{f.margen != null ? `${f.margen.toFixed(2).replace(".", ",")}×` : "—"}</td>
                <CeldaSexo fila={f} sexo="F" />
                <CeldaSexo fila={f} sexo="M" />
                <td>
                  <span className="cmv2-cert-estado" data-estado={f.estado}>
                    {ESTADO_LABEL[f.estado] ?? f.estado}
                  </span>
                  {onAgregarAula && filaComprometida(f) ? (
                    <button
                      type="button"
                      className="cmv2-cert-accion"
                      title={`Fija ${f.aulas_titulares + 1} titulares para ${f.facultad} en el estudio; recalcula y vuelve a seleccionar para aplicarlo.`}
                      onClick={() => onAgregarAula(f.facultad, f.aulas_titulares)}
                    >
                      +1 aula
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
