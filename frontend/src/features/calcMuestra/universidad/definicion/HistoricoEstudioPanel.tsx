/**
 * ADR 0060 · lo que el estudio previo dejó, leído como estudio y no como tabla.
 *
 * Gonzalo: «lo que tenemos que ver en histórico es toda la información rica que
 * hemos recolectado, de forma muy elegante, gráfica, visual, que es como se
 * caracteriza todo este módulo».
 *
 * La referencia histórica no es un archivo: es un estudio que ya ocurrió, con
 * un diseño que se decidió antes y un campo que pasó después. Esta superficie
 * las muestra en ese orden, porque una tasa de campo sin la meta contra la que
 * se midió es un número suelto:
 *
 * 1. **Lo que se planeó** — población, muestra, sobremuestra y aulas, con los
 *    parámetros del cálculo detrás.
 * 2. **Lo que pasó en el aula** — el embudo por encuentro, con la merma
 *    nombrada en cada arista: quién no vino, quién ya estaba medido, quién no
 *    pertenecía, quién no quiso.
 * 3. **Lo que se transfiere** — las tasas, y de qué denominador salen.
 *
 * El bloque de encuentros sólo existe si la base trae el glosario del ADR; si
 * no, el motor degradó y la superficie lo dice en vez de fingir un denominador
 * que no midió.
 */
import { AlertTriangle, Info } from "lucide-react";
import type { CalcMuestraReferenciaAsistencia } from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import { CifraMotor, FlujoVertical, PanelAvanzado, type FlujoEtapa } from "../ui";
import "./historicoEstudio.css";

const pct = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(1)}%`;

const num = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : fmtInt(value);

/** Un tramo se lee con su denominador delante: sin él la tasa no significa nada. */
function TramoTasa({
  label,
  lectura,
  tasa,
  numerador,
  denominador,
  icLow,
  icHigh,
}: {
  label: string;
  lectura: string;
  tasa: number | null;
  numerador: number | null;
  denominador: number | null;
  icLow: number | null;
  icHigh: number | null;
}) {
  const banda = icLow !== null && icHigh !== null ? `IC 95% ${pct(icLow)}–${pct(icHigh)}` : "Sin IC";
  return (
    <article className="cmv2-hist-tramo">
      <header>
        <span className="cmv2-eyebrow">{label}</span>
        <strong>{pct(tasa)}</strong>
      </header>
      <p className="cmv2-hist-tramo-lectura">{lectura}</p>
      <footer>
        <span className="cmv2-hist-tramo-razon">
          {num(numerador)} / {num(denominador)}
        </span>
        <span>{banda}</span>
      </footer>
    </article>
  );
}

export function HistoricoEstudioPanel({
  referencia,
}: {
  referencia: CalcMuestraReferenciaAsistencia;
}) {
  const { diseno, encuentros, cadena, cobertura, identidad, estudio, filtros_corte: filtros } = referencia;
  const conGlosario = cobertura.glosario_completo;

  // El embudo se arma sólo con lo observado. Cada arista nombra su merma: es la
  // pregunta que el módulo responde —dónde se perdió gente y por qué—.
  const etapas: FlujoEtapa[] = [];
  if (encuentros) {
    const {
      elegibles, asistentes, ya_medidas: yaMedidas, no_elegibles: noElegibles,
      elegibles_presentes: presentes, efectivas, no_efectivas: noEfectivas,
    } = encuentros;
    const ausentes = elegibles !== null && asistentes !== null ? elegibles - asistentes : null;
    const fuera = (yaMedidas ?? 0) + (noElegibles ?? 0);
    etapas.push({
      id: "elegibles",
      label: "Elegibles",
      valor: num(elegibles),
      detalle: "en las aulas aplicadas",
      estado: "ready",
      ...(ausentes !== null && ausentes > 0
        ? { merma: { n: ausentes, label: "no asistieron" } }
        : {}),
    });
    etapas.push({
      id: "asistentes",
      label: "Asistentes",
      valor: num(asistentes),
      detalle: "presentes en el aula",
      estado: "ready",
      ...(fuera > 0 ? { merma: { n: fuera, label: "ya medidos o no elegibles" } } : {}),
    });
    etapas.push({
      id: "presentes",
      label: "Elegibles presentes",
      valor: num(presentes),
      detalle: "podían responder",
      estado: "ready",
      ...(noEfectivas !== null && noEfectivas > 0
        ? { merma: { n: noEfectivas, label: "no quisieron seguir" } }
        : {}),
    });
    etapas.push({
      id: "efectivas",
      label: "Efectivas",
      valor: num(efectivas),
      detalle: "completaron la encuesta",
      estado: "ready",
    });
  }

  const alertas: string[] = [];
  if (identidad.residuales_negativos && identidad.residuales_negativos > 0) {
    alertas.push(
      `${fmtInt(identidad.residuales_negativos)} aulas registran más respuestas que personas contadas: ahí el conteo de campo no cierra y las no realizadas no se publican.`,
    );
  }
  if (identidad.inconsistentes > 0) {
    alertas.push(
      `${fmtInt(identidad.inconsistentes)} de ${fmtInt(identidad.verificables)} filas no cumplen la identidad del embudo.`,
    );
  }

  return (
    <section
      className="cmv2-hist-panel"
      data-qa-geometry-group="calc-muestra/historico-estudio"
      data-qa-geometry-contract="intrinsic"
      aria-label="Lectura del estudio histórico"
    >
      {/* 1 · Lo que se planeó */}
      {diseno.declarado ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">Lo que se planeó</span>
            <h4>Diseño del estudio {estudio.periodo ? `· ${estudio.periodo}` : ""}</h4>
          </header>
          <div className="cmv2-hist-cifras">
            <CifraMotor
              label="Población objetivo"
              value={num(diseno.poblacion_objetivo)}
              detalle="personas únicas elegibles"
              origen="motor"
              hero
            />
            <CifraMotor label="Muestra" value={num(diseno.muestra)} detalle="encuestas objetivo" origen="motor" />
            <CifraMotor
              label="Sobremuestra"
              value={num(diseno.sobremuestra)}
              detalle={diseno.ratio_sobremuestra ? `× ${diseno.ratio_sobremuestra} sobre la muestra` : "margen operativo"}
              origen="motor"
            />
            <CifraMotor
              label="Aulas dimensionadas"
              value={num(diseno.aulas_dimensionadas)}
              detalle={diseno.aulas_aplicadas ? `${num(diseno.aulas_aplicadas)} aplicadas` : "según el marco"}
              origen="motor"
            />
          </div>
          <PanelAvanzado titulo="Parámetros del cálculo">
            <dl className="cmv2-hist-params">
              <div><dt>Nivel de confianza</dt><dd>{pct(diseno.nivel_confianza)}</dd></div>
              <div><dt>Proporción esperada (p)</dt><dd>{diseno.proporcion_esperada ?? "—"}</dd></div>
              <div><dt>Margen de error</dt><dd>{pct(diseno.margen_error)}</dd></div>
              <div><dt>Efecto de diseño</dt><dd>{diseno.deff ?? "—"}</dd></div>
              <div><dt>Tasa de respuesta asumida</dt><dd>{pct(diseno.tasa_respuesta_asumida)}</dd></div>
              <div><dt>Afijación</dt><dd>{diseno.afijacion || "—"}</dd></div>
              <div><dt>Selección</dt><dd>{diseno.metodo_seleccion || "—"}</dd></div>
              <div><dt>Ajuste final</dt><dd>{diseno.metodo_ajuste || "—"}</dd></div>
              <div>
                <dt>Ponderación</dt>
                <dd>{diseno.ponderado === null ? "—" : diseno.ponderado ? "Sí se aplicó" : "No aplica"}</dd>
              </div>
            </dl>
          </PanelAvanzado>
        </div>
      ) : (
        <p className="cmv2-hist-nota" role="status">
          <Info size={14} aria-hidden="true" />
          Esta base no documentó su diseño. Sus tasas se leen igual, pero sin la meta contra la
          que se midieron.
        </p>
      )}

      {/* 2 · Lo que pasó en el aula */}
      <div className="cmv2-hist-bloque">
        <header className="cmv2-hist-bloque-head">
          <span className="cmv2-eyebrow">Lo que pasó en el aula</span>
          <h4>Embudo del encuentro</h4>
          <p>
            {conGlosario
              ? "Cada persona que estuvo en el aula terminó de una sola manera. La merma de cada paso dice quién se perdió y por qué."
              : "Esta base no trae el vocabulario del encuentro, así que el embudo se lee sobre matrícula y registros."}
          </p>
        </header>
        {etapas.length > 0 ? (
          <FlujoVertical etapas={etapas} orientacion="adaptive" ariaLabel="Embudo del estudio histórico" />
        ) : (
          <p className="cmv2-hist-nota" role="status">
            <Info size={14} aria-hidden="true" />
            Sin las columnas de elegibles, ya medidos y no elegibles no se puede reconstruir el
            embudo por encuentro. Cárgalas para verlo.
          </p>
        )}
        <div className="cmv2-hist-cobertura">
          <span><strong>{fmtInt(cobertura.agendados)}</strong> agendados</span>
          <span><strong>{fmtInt(cobertura.aplicados)}</strong> aplicados</span>
          <span><strong>{fmtInt(cobertura.observados)}</strong> con asistencia observada</span>
        </div>
      </div>

      {/* 3 · Lo que se transfiere */}
      <div className="cmv2-hist-bloque">
        <header className="cmv2-hist-bloque-head">
          <span className="cmv2-eyebrow">Lo que se transfiere</span>
          <h4>Tasas del estudio</h4>
          <p>
            Sobre {conGlosario ? "elegibles presentes" : "matrícula y registros"}. Es lo que el
            cálculo puede usar como ancla.
          </p>
        </header>
        <div className="cmv2-hist-tramos">
          <TramoTasa
            label="Asistencia"
            lectura={conGlosario ? "de los elegibles, cuántos vinieron" : "de los matriculados, cuántos vinieron"}
            tasa={cadena.asistencia.tasa}
            numerador={cadena.asistencia.numerador}
            denominador={cadena.asistencia.denominador}
            icLow={cadena.asistencia.ic_low}
            icHigh={cadena.asistencia.ic_high}
          />
          <TramoTasa
            label="Apertura"
            lectura={conGlosario ? "de los que podían, cuántos abrieron" : "de los presentes, cuántos abrieron"}
            tasa={cadena.apertura.tasa}
            numerador={cadena.apertura.numerador}
            denominador={cadena.apertura.denominador}
            icLow={cadena.apertura.ic_low}
            icHigh={cadena.apertura.ic_high}
          />
          <TramoTasa
            label="Efectividad"
            lectura={conGlosario ? "de los que podían, cuántos respondieron" : "de los que abrieron, cuántos completaron"}
            tasa={cadena.efectividad.tasa}
            numerador={cadena.efectividad.numerador}
            denominador={cadena.efectividad.denominador}
            icLow={cadena.efectividad.ic_low}
            icHigh={cadena.efectividad.ic_high}
          />
          <TramoTasa
            label="Rendimiento"
            lectura="producto final sobre el universo del aula"
            tasa={cadena.rendimiento.tasa}
            numerador={cadena.rendimiento.numerador}
            denominador={cadena.rendimiento.denominador}
            icLow={cadena.rendimiento.ic_low}
            icHigh={cadena.rendimiento.ic_high}
          />
        </div>
      </div>

      {/* Filtros declarados: qué cortaba el instrumento y cómo contó cada corte */}
      {filtros.length > 0 ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">Instrumento</span>
            <h4>Filtros de corte declarados</h4>
          </header>
          <ol className="cmv2-hist-filtros">
            {filtros.map((filtro) => (
              <li key={filtro.id} data-en-denominador={filtro.en_denominador ? "si" : "no"}>
                <span className="cmv2-hist-filtro-orden">{filtro.orden}</span>
                <span className="cmv2-hist-filtro-label">{filtro.etiqueta}</span>
                <span className="cmv2-hist-filtro-clase">{filtro.clase.replace("_", " ")}</span>
                <span className="cmv2-hist-filtro-efecto">
                  {filtro.en_denominador ? "cuenta como pérdida" : "sale del denominador"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* Lo que no cierra se dice, no se promedia */}
      {alertas.length > 0 ? (
        <div className="cmv2-hist-alertas" role="alert">
          <header>
            <AlertTriangle size={14} aria-hidden="true" />
            <strong>Lo que no cierra en esta base</strong>
          </header>
          <ul>
            {alertas.map((texto) => <li key={texto}>{texto}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
