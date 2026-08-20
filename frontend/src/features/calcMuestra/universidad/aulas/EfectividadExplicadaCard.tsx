/**
 * «De dónde sale el esperado de cada aula» — la radiografía del valor de
 * validez.
 *
 * Gonzalo (2026-08-20): «yo puedo marcar cualquier curso horario o cualquier
 * reemplazo, y el validador me debería decir cómo llegamos a este valor…
 * la información de contratado/ordinario o aula de tantos a tantos debería
 * ser un bloque más formal arriba, y debería poder escoger el curso horario
 * y que me dé la redacción del cálculo». Este valor es el que consume la
 * sesión de Monitoreo para juzgar cada aula en campo.
 *
 * Las tablas de referencia se DERIVAN de las filas del motor (no son curvas
 * copiadas en prosa: un solo dueño del dato).
 */
import { useMemo, useState } from "react";
import { fmtInt } from "../../sharedCore";
import {
  efectividadExplicada,
  etiquetaDocente,
  radiografiaAula,
} from "./efectividadExplicadaModel";
import "./efectividadExplicada.css";

type Fila = Record<string, unknown>;

const pct = (v: number) => `${Math.round(v * 100)} %`;
const coma = (v: number, dec: number) => v.toFixed(dec).replace(".", ",");
const texto = (v: unknown): string => String(v ?? "").trim();

function rolCorto(fila: Fila): string {
  const role = texto(fila.sample_role);
  if (role === "titular") return "Titular";
  if (role === "chain_reserve") {
    const n = Number(fila.replacement_order);
    return Number.isFinite(n) ? `R${n}` : "R";
  }
  if (role === "extra_reserve_pool") return "Bolsa extra";
  return role || "—";
}

export function EfectividadExplicadaCard({
  filas,
  titulares = null,
}: {
  /** TODO el plan: titulares y reemplazos — cualquiera se puede radiografiar. */
  filas: Fila[] | null;
  /** Solo titulares, para el control de coherencia del pie. */
  titulares?: Fila[] | null;
}) {
  // Las tasas de referencia se derivan del plan completo; la coherencia del
  // pie se juzga sobre los titulares (los que arman la muestra).
  const m = useMemo(() => efectividadExplicada(filas), [filas]);
  const mTitulares = useMemo(
    () => efectividadExplicada(titulares ?? null),
    [titulares],
  );
  const [query, setQuery] = useState("");
  const [elegidaId, setElegidaId] = useState("");
  if (!m) return null;

  const conCuenta = (filas ?? []).filter(
    (f) => Number.isFinite(Number(f.efectivas_esperadas)),
  );
  const elegida =
    conCuenta.find((f) => texto(f.classroom_id) === elegidaId) ??
    conCuenta.find((f) => texto(f.sample_role) === "titular") ??
    conCuenta[0] ??
    null;
  const q = query.trim().toLowerCase();
  const candidatas = q
    ? conCuenta
        .filter((f) =>
          `${texto(f.course_name)} ${texto(f.course_id)} ${texto(f.schedule)} ${texto(f.teacher)} ${texto(f.faculty_aula) || texto(f.faculty)}`
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 8)
    : [];
  const radio = elegida ? radiografiaAula(elegida, m.porTamano) : null;

  return (
    <section
      className="cmv2-generales-card cmv2-efexp"
      aria-label="De dónde sale el esperado de cada aula"
    >
      <header>
        <strong>De dónde sale el esperado de cada aula</strong>
        <span>
          la misma cuenta para los {fmtInt(conCuenta.length)} cursos-horario del plan
          (titulares y reemplazos), con las tasas que el 2025 ejecutado dejó medidas
        </span>
      </header>

      {/* 1 · El bloque formal de referencia: las dos tablas medidas. */}
      <div className="cmv2-efexp-ref">
        <table className="cmv2-efexp-tabla-ref">
          <caption>Probabilidad de poder aplicar, según el tipo de docente</caption>
          <thead>
            <tr>
              <th scope="col">Tipo de docente</th>
              <th scope="col">Dejó aplicar (2025)</th>
              <th scope="col">Aulas en el plan</th>
            </tr>
          </thead>
          <tbody>
            {m.porDocente.map((g) => (
              <tr key={g.tasa}>
                <th scope="row">{etiquetaDocente(g.etiqueta)}</th>
                <td>{pct(g.tasa)}</td>
                <td>{fmtInt(g.nAulas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="cmv2-efexp-tabla-ref">
          <caption>Rendimiento al aplicar, según el tamaño del aula</caption>
          <thead>
            <tr>
              <th scope="col">Elegibles sentados</th>
              <th scope="col">Rindió (2025)</th>
              <th scope="col">Aulas en el plan</th>
            </tr>
          </thead>
          <tbody>
            {m.porTamano.map((g) => (
              <tr key={g.tasa}>
                <th scope="row">
                  {g.minElegibles === g.maxElegibles
                    ? fmtInt(g.minElegibles)
                    : `${fmtInt(g.minElegibles)} a ${fmtInt(g.maxElegibles)}`}
                </th>
                <td>{pct(g.tasa)}</td>
                <td>{fmtInt(g.nAulas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2 · El selector: cualquier curso-horario del plan, titular o reemplazo. */}
      <div className="cmv2-efexp-selector">
        <label className="cmv2-compact-field cmv2-efexp-buscador">
          <span>Radiografiar un curso-horario</span>
          <input
            value={query}
            placeholder="busca por curso, código, docente o facultad…"
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
        {candidatas.length > 0 && (
          <ul className="cmv2-efexp-candidatas">
            {candidatas.map((f) => (
              <li key={texto(f.classroom_id)}>
                <button
                  type="button"
                  onClick={() => {
                    setElegidaId(texto(f.classroom_id));
                    setQuery("");
                  }}
                >
                  <b>{rolCorto(f)}</b>
                  <span>
                    {texto(f.course_name) || texto(f.course_id)} · {texto(f.schedule)} ·{" "}
                    {texto(f.faculty_aula) || texto(f.faculty)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {q && candidatas.length === 0 && (
          <p className="cmv2-efexp-sinmatch">
            Ningún curso-horario del plan coincide con «{query}».
          </p>
        )}
      </div>

      {/* 3 · La redacción del cálculo del curso-horario elegido. */}
      {radio && (
        <article className="cmv2-efexp-radio" aria-label={`Cálculo del esperado de ${radio.curso}`}>
          <header>
            <span className="cmv2-efexp-radio-rol">{radio.rol}</span>
            <strong>{radio.curso}</strong>
            <small>
              {radio.codigo}
              {radio.horario ? ` · ${radio.horario}` : ""} · {radio.facultad}
            </small>
          </header>
          <ol className="cmv2-efexp-pasos">
            <li>
              <b>{fmtInt(radio.elegibles)}</b>
              <div>
                <strong>elegibles sentados</strong>
                <span>
                  estudiantes del universo elegible matriculados en este curso-horario
                </span>
              </div>
            </li>
            <li>
              <b>× {pct(radio.pAplicada)}</b>
              <div>
                <strong>probabilidad de poder aplicarla</strong>
                <span>
                  su docente es {radio.docente}; en 2025, de las aulas con ese tipo de
                  docente se pudo aplicar el {pct(radio.pAplicada)}
                </span>
              </div>
            </li>
            <li>
              <b>× {pct(radio.rendimiento)}</b>
              <div>
                <strong>rendimiento de su tamaño</strong>
                <span>
                  con {fmtInt(radio.elegibles)} elegibles cae en el tramo de {radio.tramo};
                  en 2025 las aulas aplicadas de ese tamaño convirtieron en encuestas
                  efectivas el {pct(radio.rendimiento)} de sus elegibles
                </span>
              </div>
            </li>
            <li data-resultado="true">
              <b>= {coma(radio.esperadas, 1)}</b>
              <div>
                <strong>efectivas esperadas — el valor de validez</strong>
                <span>
                  {fmtInt(radio.elegibles)} × {coma(radio.pAplicada, 2)} ×{" "}
                  {coma(radio.rendimiento, 2)} = {coma(radio.productoExacto, 2)}, que el
                  motor guarda como {coma(radio.esperadas, 1)}. Con este número Monitoreo
                  juzga esta aula en campo; cada curso-horario lleva el suyo.
                </span>
              </div>
            </li>
          </ol>
        </article>
      )}

      {/* 4 · Control de coherencia sobre los titulares — NO es lo que usa
          Monitoreo (eso es el esperado de cada aula, arriba). */}
      {mTitulares && (
        <p className="cmv2-efexp-pie">
          Control de coherencia: las {fmtInt((titulares ?? []).length)} cuentas de los
          titulares suman <b>{fmtInt(Math.round(mTitulares.totalEsperadas))} esperadas</b>{" "}
          sobre {fmtInt(mTitulares.totalElegibles)} elegibles sentados —{" "}
          {pct(mTitulares.tasaGlobal)}, que se descompone en {pct(mTitulares.pAplicadaMedia)}{" "}
          <small>(la parte de aulas que se dejan aplicar)</small> ×{" "}
          {pct(mTitulares.tauImplicito)} <small>(el rendimiento al aplicar: el mismo τ que
          dimensionó cuántas aulas pedir)</small>. La brecha entre ambas tasas es el riesgo
          de que un aula se caiga, y eso lo recupera la cadena de reemplazos — por eso
          existe.
        </p>
      )}
    </section>
  );
}
