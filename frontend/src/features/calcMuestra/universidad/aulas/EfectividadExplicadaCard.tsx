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
  ajustesPorFacultad,
  efectividadExplicada,
  etiquetaDocente,
  fuenteEfectividad,
  radiografiaAula,
  radiografiaAulaTau,
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
  const fuente = fuenteEfectividad(filas);
  // El nombre de la referencia se LEE de la fila; la UI no asume un año.
  const refTexto =
    fuente.tipo === "historico"
      ? fuente.periodo
        ? `histórico ${fuente.periodo}`
        : "histórico del estudio anterior"
      : "estudio de calibración";
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
  const ajustes = useMemo(() => ajustesPorFacultad(filas), [filas]);
  const ajusteActivo = ajustes.length > 0;
  const radio =
    elegida && fuente.tipo !== "tau_global" ? radiografiaAula(elegida, m.porTamano) : null;
  const radioTau = elegida && fuente.tipo === "tau_global" ? radiografiaAulaTau(elegida) : null;

  return (
    <section
      className="cmv2-generales-card cmv2-efexp"
      aria-label="De dónde sale el esperado de cada aula"
    >
      <header>
        <strong>De dónde sale el esperado de cada aula</strong>
        <span>
          {fuente.tipo === "tau_global"
            ? `la misma regla para los ${fmtInt(conCuenta.length)} cursos-horario del plan: elegibles × la tasa global declarada (${coma((fuente.tau ?? 0) * 100, 1)} %)`
            : `la misma cuenta para los ${fmtInt(conCuenta.length)} cursos-horario del plan (titulares y reemplazos), con tasas derivadas del ${refTexto}`}
        </span>
      </header>

      {/* 1 · El bloque formal de referencia: las dos tablas medidas. Solo
          existe cuando hay curvas (histórico o calibración); con tasa global no
          hay curvas que mostrar. */}
      {fuente.tipo !== "tau_global" && (
      <div className={`cmv2-efexp-ref${ajusteActivo ? "" : " cmv2-efexp-ref--solo"}`}>
        <table className="cmv2-efexp-tabla-ref">
          <caption>Tasa de efectividad según el tamaño del aula — {refTexto}</caption>
          <thead>
            <tr>
              <th scope="col">Elegibles</th>
              <th scope="col">Tasa de efectividad</th>
              <th scope="col" title="Cursos-horario del plan en este tramo">Aulas</th>
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
                <td className="cmv2-efexp-celda-barra">
                  <i className="cmv2-efexp-minibar" aria-hidden="true">
                    <b style={{ width: `${Math.min(100, g.tasa * 100)}%` }} />
                  </i>
                  <span>{pct(g.tasa)}</span>
                </td>
                <td>{fmtInt(g.nAulas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ajusteActivo && (
          <table className="cmv2-efexp-tabla-ref">
            <caption>Ajuste por facultad — {refTexto}</caption>
            <thead>
              <tr>
                <th scope="col">Facultad</th>
                <th scope="col">Ajuste del esperado</th>
                <th scope="col" title="Aulas aplicadas de la facultad en el histórico">k</th>
              </tr>
            </thead>
            <tbody>
              {ajustes.map((a) => (
                <tr key={a.facultad}>
                  <th scope="row">{a.facultad}</th>
                  <td className="cmv2-efexp-celda-barra">
                    {/* Barra divergente desde ×1,00: arriba en acento, abajo
                        en tinta tenue — la magnitud se VE, no solo se lee. */}
                    <i className="cmv2-efexp-divbar" data-dir={a.factor >= 1 ? "up" : "down"} aria-hidden="true">
                      <b style={{ width: `${Math.min(50, (Math.abs(a.factor - 1) / 0.15) * 50)}%` }} />
                    </i>
                    <span>× {coma(a.factor, 2)}</span>
                  </td>
                  <td>{a.k != null ? fmtInt(a.k) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      {/* 1c · El ajuste por facultad, cuando el estudio lo declaró (decisión
          de Gonzalo, 2026-08-20): la tasa de la facultad frente a la general, con su
          k — «sí necesito saber por qué solo en seis facultades». */}
      {ajusteActivo && (
          <p className="cmv2-efexp-aviso">
            El ajuste solo se aplica donde el {refTexto} acumuló base suficiente
            (al menos 12 aulas aplicadas, según la clasificación de suficiencia de la
            referencia). Para las demás facultades el histórico no pudo generar una tasa
            específica estadísticamente defendible: rige la tasa general, y cada
            radiografía lo declara.
          </p>
      )}

      {/* 1b · La procedencia y la limitación, declaradas — nunca en silencio. */}
      {fuente.tipo === "calibracion_embebida" && (
        <p className="cmv2-efexp-aviso" data-tono="warn">
          Este estudio no declara la procedencia de su calibración: las tasas provienen de
          una calibración embebida en el motor, medida sobre un estudio anterior. Declara el
          histórico del estudio (con su periodo) o una tasa global propia para que el esperado
          quede correctamente referenciado.
        </p>
      )}
      {fuente.tipo === "historico" && !ajusteActivo && (
        <p className="cmv2-efexp-aviso">
          Las dos tasas son generales del {refTexto}: no se diferencian por facultad. La
          variación por facultad medida en ese histórico está identificada y su
          incorporación al esperado es una decisión metodológica pendiente del estudio.
        </p>
      )}
      {fuente.tipo === "tau_global" && (
        <p className="cmv2-efexp-aviso">
          Este estudio no tiene histórico de referencia: cada esperado se rige por el
          supuesto global declarado en el diseño. Cuando exista data aplicada propia, la
          calibración por tipo de docente y tamaño podrá medirse y reemplazar al supuesto.
        </p>
      )}

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
              <b>× {pct(radio.rendimiento)}</b>
              <div>
                <strong>tasa de efectividad de su tamaño</strong>
                <span>
                  con {fmtInt(radio.elegibles)} elegibles se ubica en el tramo de{" "}
                  {radio.tramo}; en el {refTexto}, las aulas aplicadas de ese tramo
                  registraron una tasa de efectividad del {pct(radio.rendimiento)}{" "}
                  (encuestas efectivas sobre elegibles)
                </span>
              </div>
            </li>
            {ajusteActivo && (
              <li>
                <b>× {coma(radio.factorFacultad, 2)}</b>
                <div>
                  <strong>ajuste de su facultad</strong>
                  <span>
                    {radio.factorFacultad !== 1
                      ? `en el ${refTexto}, ${radio.facultad} registró una tasa de efectivas ${radio.factorFacultad > 1 ? "mayor" : "menor"} que la general (k = ${fmtInt(radio.facultadK ?? 0)} aulas aplicadas): el esperado se ajusta en consecuencia`
                      : `el ${refTexto} no pudo generar una tasa específica para ${radio.facultad} (base insuficiente): rige la tasa general`}
                  </span>
                </div>
              </li>
            )}
            <li data-resultado="true">
              <b>= {coma(radio.esperadas, 1)}</b>
              <div>
                <strong>efectivas esperadas — el valor de validez</strong>
                <span>
                  {fmtInt(radio.elegibles)} × {coma(radio.rendimiento, 2)}
                  {ajusteActivo ? ` × ${coma(radio.factorFacultad, 2)}` : ""} ={" "}
                  {coma(radio.productoExacto, 2)}, que el motor guarda como{" "}
                  {coma(radio.esperadas, 1)}. Es la cuenta CONDICIONAL: lo que esta aula debe
                  rendir si entra a campo — con este número Monitoreo la juzga; si se cae, su
                  reemplazo se juzga contra el suyo propio.
                </span>
              </div>
            </li>
          </ol>
          {/* V7: el docente NO descuenta efectivas — es dato OPERATIVO: anticipa
              si el aula entrara y cuanta cadena podria costar el cupo. */}
          <p className="cmv2-efexp-operativo">
            <b>Dato operativo</b>: su docente ({radio.docente}) tiene una tasa de aplicación
            del {pct(radio.pAplicada)} — no descuenta las esperadas; anticipa el riesgo de que
            el aula no entre y haya que activar su cadena de reemplazos. El presupuesto de
            visitas de Selección usa esta tasa.
          </p>
        </article>
      )}

      {radioTau && (
        <article
          className="cmv2-efexp-radio"
          aria-label={`Cálculo del esperado de ${radioTau.curso}`}
        >
          <header>
            <span className="cmv2-efexp-radio-rol">{radioTau.rol}</span>
            <strong>{radioTau.curso}</strong>
            <small>
              {radioTau.codigo}
              {radioTau.horario ? ` · ${radioTau.horario}` : ""} · {radioTau.facultad}
            </small>
          </header>
          <ol className="cmv2-efexp-pasos">
            <li>
              <b>{fmtInt(radioTau.elegibles)}</b>
              <div>
                <strong>elegibles sentados</strong>
                <span>
                  estudiantes del universo elegible matriculados en este curso-horario
                </span>
              </div>
            </li>
            <li>
              <b>× {coma(radioTau.tau * 100, 1)} %</b>
              <div>
                <strong>tasa global declarada en el diseño</strong>
                <span>
                  este estudio no tiene histórico de referencia: el supuesto global es la
                  única tasa disponible y se aplica igual a todas las aulas
                </span>
              </div>
            </li>
            <li data-resultado="true">
              <b>= {coma(radioTau.esperadas, 1)}</b>
              <div>
                <strong>efectivas esperadas — el valor de validez</strong>
                <span>
                  {fmtInt(radioTau.elegibles)} × {coma(radioTau.tau, 2)} ={" "}
                  {coma(radioTau.productoExacto, 2)}, que el motor guarda como{" "}
                  {coma(radioTau.esperadas, 1)}. Con este número Monitoreo juzga esta aula
                  en campo; cada curso-horario lleva el suyo.
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
          titulares suman <b>{fmtInt(Math.round(mTitulares.totalEsperadas))} efectivas
          esperadas</b> sobre {fmtInt(mTitulares.totalElegibles)} elegibles en lista —{" "}
          {pct(mTitulares.tasaGlobal)} de tasa media de efectividad. Es el mismo número que
          certifica cada facultad en su tabla y el que Monitoreo consume aula por aula; las
          tasas por facultad que lo componen viven en Cálculo → Cursos-horario requeridos.
        </p>
      )}
    </section>
  );
}
