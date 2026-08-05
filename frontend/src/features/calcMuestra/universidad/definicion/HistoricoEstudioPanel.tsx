/**
 * ADR 0060 · el estudio previo, leído como estudio.
 *
 * Gonzalo: «lo que tenemos que ver en histórico es toda la información rica que
 * hemos recolectado, de forma muy elegante, gráfica, visual, que es como se
 * caracteriza todo este módulo» — y, sobre eso, «buscamos perfilar los
 * cursos-horario de las facultades».
 *
 * Una primera versión resolvió esto con tablas y tiles. Funcionaba y no decía
 * nada: quien abre esta pestaña no viene a consultar celdas, viene a entender
 * qué rindió el año pasado para decidir cuántas aulas visitar este. Así que la
 * superficie narra, en el orden en que se toma la decisión:
 *
 *   1. ¿Se cumplió?      contraste plan vs resultado, con el excedente a la vista
 *   2. ¿Dónde se perdió? el embudo proporcional, cada merma nombrada
 *   3. ¿Qué aprendimos?  las cifras de lectura, sin párrafos
 *   4. ¿Y por facultad?  el perfil que de verdad se hereda, ordenado por tasa
 *
 * Dos reglas del ADR gobiernan lo que se muestra. Una: `ya medidas` y `no
 * elegibles` NO son pérdidas —salen del denominador— y la superficie tiene que
 * hacer visible esa diferencia, porque es lo que separa un aula mal trabajada
 * de un aula con mucho traslape. Dos: una celda con pocas aulas publica la
 * tasa global y eso se dice, nunca se disfraza de dato propio.
 *
 * Sin Plotly: barras en CSS. Esta pestaña vive en Definición y no debe arrastrar
 * el bundle de gráficos por cuatro perfiles marginales.
 */
import { Info } from "lucide-react";
import type {
  CalcMuestraReferenciaAsistencia,
  CalcMuestraReferenciaAsistenciaCelda,
} from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import "./historicoEstudio.css";

const pct = (value: number | null | undefined, dec = 1) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(dec)}%`;

const num = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : fmtInt(value);

/**
 * Un peldaño del embudo. La barra ocupa lo que queda del universo y la merma se
 * dibuja pegada a su derecha, así que la caída se ve sin leer una sola cifra.
 * El ADR separa pérdida de descuento —quien ya respondió o no pertenecía no es
 * un fracaso del operativo— y esa diferencia se codifica en el color, no en un
 * párrafo.
 */
function PasoEmbudo({
  label,
  valor,
  universo,
  merma,
  tono,
}: {
  label: string;
  valor: number;
  universo: number;
  merma?: { n: number; texto: string; sale?: boolean };
  tono?: "meta";
}) {
  const ancho = universo > 0 ? Math.max(1.5, (valor / universo) * 100) : 0;
  const anchoMerma = merma && universo > 0 ? (merma.n / universo) * 100 : 0;
  return (
    <li className="cmv2-hist-paso" data-tono={tono}>
      <span className="cmv2-hist-paso-label">{label}</span>
      <span className="cmv2-hist-paso-track">
        <span className="cmv2-hist-paso-fill" style={{ width: `${ancho}%` }}>
          <b>{fmtInt(valor)}</b>
        </span>
        {merma && anchoMerma > 0 ? (
          <span
            className="cmv2-hist-paso-merma"
            data-sale={merma.sale ? "si" : undefined}
            style={{ width: `${anchoMerma}%` }}
          />
        ) : null}
      </span>
      <span className="cmv2-hist-paso-pct">{pct(universo > 0 ? valor / universo : null, 0)}</span>
      {merma && anchoMerma > 0 ? (
        // La leyenda de la merma se ancla al tramo rayado que describe: si vive
        // al inicio de la fila, se lee como si hablara de la barra llena.
        <span className="cmv2-hist-paso-nota" style={{ marginLeft: `${ancho}%` }}>
          <b data-sale={merma.sale ? "si" : undefined}>−{fmtInt(merma.n)}</b> {merma.texto}
        </span>
      ) : null}
    </li>
  );
}

/**
 * Una celda del perfil. La barra se escala a 100 %, no al máximo observado, para
 * que dos dimensiones distintas sean comparables entre sí; el intervalo se pinta
 * encima como una banda, y una celda que publica la global se dibuja rayada
 * porque su valor no es propio.
 */
function FilaPerfil({
  fila,
  referencia,
}: {
  fila: CalcMuestraReferenciaAsistenciaCelda;
  referencia: number | null;
}) {
  const degradada = fila.fuente_publicada === "global";
  const ancho = fila.tasa !== null ? Math.max(1.5, Math.min(100, fila.tasa * 100)) : 0;
  const banda = fila.ic_low !== null && fila.ic_high !== null
    ? { left: Math.max(0, fila.ic_low * 100), width: Math.max(1, (fila.ic_high - fila.ic_low) * 100) }
    : null;
  const sobreReferencia = referencia !== null && fila.tasa !== null && fila.tasa >= referencia;
  return (
    <li className="cmv2-hist-fila" data-degradada={degradada ? "si" : undefined}>
      <span className="cmv2-hist-fila-nombre" title={fila.celda_label}>{fila.celda_label}</span>
      <span className="cmv2-hist-fila-k">{fmtInt(fila.k)}</span>
      <span className="cmv2-hist-fila-track">
        {banda ? (
          <span className="cmv2-hist-fila-ic" style={{ left: `${banda.left}%`, width: `${banda.width}%` }} />
        ) : null}
        <span className="cmv2-hist-fila-barra" data-sobre={sobreReferencia ? "si" : undefined} style={{ width: `${ancho}%` }} />
        {referencia !== null ? (
          <span className="cmv2-hist-fila-ref" style={{ left: `${Math.min(100, referencia * 100)}%` }} />
        ) : null}
      </span>
      <span className="cmv2-hist-fila-tasa">{pct(fila.tasa)}</span>
    </li>
  );
}

export function HistoricoEstudioPanel({
  referencia,
}: {
  referencia: CalcMuestraReferenciaAsistencia;
}) {
  const {
    diseno, encuentros, cadena, cobertura, identidad, estudio,
    filtros_corte: filtros, dimensiones,
  } = referencia;
  const conGlosario = cobertura.glosario_completo;

  const facultad = dimensiones.find((d) => d.dimension_key === "facultad");
  const embudoFacultad = referencia.embudos.find((e) => e.dimension_key === "facultad");
  const otras = dimensiones.filter((d) => d.dimension_key !== "facultad");

  const logradas = encuentros?.efectivas ?? cadena.rendimiento.numerador ?? null;
  const meta = diseno.muestra;
  const cumplimiento = meta && logradas ? logradas / meta : null;
  const universo = encuentros?.elegibles ?? cadena.asistencia.denominador ?? 0;

  // Métricas de lectura: cifra al frente, una línea de contexto. No párrafos.
  const metricas: Array<{ valor: string; label: string; nota: string; tono?: "alerta" | "clave" }> = [];
  if (encuentros) {
    if (encuentros.ya_medidas && encuentros.asistentes) {
      metricas.push({
        valor: pct(encuentros.ya_medidas / encuentros.asistentes, 1),
        label: "ya había contestado antes",
        nota: `${fmtInt(encuentros.ya_medidas)} estudiantes aparecieron en un aula habiendo respondido en otro curso. Mide cuánto se repiten los alumnos entre las aulas del marco.`,
      });
    }
    if (encuentros.no_efectivas && encuentros.elegibles_presentes) {
      metricas.push({
        valor: pct(encuentros.no_efectivas / encuentros.elegibles_presentes, 1),
        label: "empezó y no terminó",
        nota: `${fmtInt(encuentros.no_efectivas)} estudiantes abrieron la encuesta y decidieron no continuar.`,
      });
    }
    if (encuentros.no_realizadas !== null && encuentros.elegibles_presentes) {
      metricas.push({
        valor: pct(encuentros.no_realizadas / encuentros.elegibles_presentes, 1),
        label: "no la abrió siquiera",
        nota: `${fmtInt(encuentros.no_realizadas)} estudiantes estaban en el aula y nunca entraron a la encuesta.`,
      });
    }
  }
  if (diseno.tasa_respuesta_asumida && cadena.rendimiento.tasa) {
    const brecha = cadena.rendimiento.tasa - diseno.tasa_respuesta_asumida;
    metricas.push({
      valor: `${brecha >= 0 ? "+" : "−"}${pct(Math.abs(brecha), 1)}`,
      label: brecha >= 0 ? "mejor de lo previsto" : "por debajo de lo previsto",
      nota: `Al diseñar se supuso que respondería el ${pct(diseno.tasa_respuesta_asumida, 0)} y respondió el ${pct(cadena.rendimiento.tasa, 0)}. Ese supuesto es el que fija cuántas aulas visitar.`,
      tono: brecha < -0.05 ? "alerta" : "clave",
    });
  }
  if (identidad.residuales_negativos && identidad.residuales_negativos > 0) {
    metricas.push({
      valor: fmtInt(identidad.residuales_negativos),
      label: "aulas con el conteo abierto",
      nota: "Llegaron más encuestas que personas contadas en el aula, así que ahí no se sabe cuántos no la abrieron. El resto de las cifras no cambia.",
      tono: "alerta",
    });
  }

  const filasFacultad = facultad
    ? [...facultad.filas].filter((f) => f.k > 0).sort((a, b) => (b.tasa ?? 0) - (a.tasa ?? 0))
    : [];
  const degradadas = filasFacultad.filter((f) => f.fuente_publicada === "global").length;

  return (
    <section
      className="cmv2-hist-panel"
      data-qa-geometry-group="calc-muestra/historico-estudio"
      data-qa-geometry-contract="intrinsic"
      aria-label="Lectura del estudio histórico"
    >
      {/* 1 · ¿Se cumplió? */}
      <div className="cmv2-hist-hero">
        <div className="cmv2-hist-hero-id">
          <span className="cmv2-eyebrow">Estudio de referencia</span>
          <h4>{estudio.label || "Estudio anterior"}</h4>
          <p>
            {[estudio.periodo, `${fmtInt(cobertura.aplicados)} aulas aplicadas`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {meta && logradas ? (
          <div className="cmv2-hist-hero-meta">
            <div className="cmv2-hist-hero-cifras">
              <span>
                <small>Meta</small>
                <strong>{fmtInt(meta)}</strong>
              </span>
              <span data-cumple={cumplimiento && cumplimiento >= 1 ? "si" : "no"}>
                <small>Logrado</small>
                <strong>{fmtInt(logradas)}</strong>
              </span>
              {diseno.sobremuestra ? (
                <span>
                  <small>Sobremuestra</small>
                  <strong>{fmtInt(diseno.sobremuestra)}</strong>
                </span>
              ) : null}
            </div>
            <div className="cmv2-hist-hero-barra" aria-hidden="true">
              <span
                className="cmv2-hist-hero-avance"
                style={{ width: `${Math.min(100, (cumplimiento ?? 0) * 100)}%` }}
              />
              {diseno.sobremuestra && meta ? (
                <span
                  className="cmv2-hist-hero-marca"
                  style={{ left: `${Math.min(100, (meta / diseno.sobremuestra) * 100)}%` }}
                />
              ) : null}
            </div>
            <p className="cmv2-hist-hero-lectura">
              {cumplimiento && cumplimiento >= 1
                ? `Superó la meta en ${pct(cumplimiento - 1, 0)}${diseno.sobremuestra ? `, y llegó al ${pct(logradas / diseno.sobremuestra, 0)} de la sobremuestra` : ""}.`
                : `Quedó en ${pct(cumplimiento, 0)} de la meta.`}
            </p>
          </div>
        ) : null}
      </div>

      {/* 2 · ¿Dónde se perdió? */}
      {encuentros && universo > 0 ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">Qué pasó en las aulas</span>
            <h4>De {fmtInt(universo)} estudiantes a {fmtInt(encuentros.efectivas ?? 0)} encuestas completas</h4>
            <p>
              Cada estudiante terminó en uno solo de estos grupos. El ancho de la barra es la
              cantidad de personas; la parte rayada es la que se fue en ese paso.
            </p>
          </header>
          <ol className="cmv2-hist-embudo">
            <PasoEmbudo
              label="Estudiantes del estudio"
              valor={universo}
              universo={universo}
              merma={
                encuentros.asistentes !== null
                  ? { n: universo - encuentros.asistentes, texto: "faltaron a clase ese día" }
                  : undefined
              }
            />
            <PasoEmbudo
              label="Fueron a clase"
              valor={encuentros.asistentes ?? 0}
              universo={universo}
              merma={{
                n: (encuentros.ya_medidas ?? 0) + (encuentros.no_elegibles ?? 0),
                texto: "no sumaban: ya habían contestado en otro curso, o no eran del estudio",
                sale: true,
              }}
            />
            <PasoEmbudo
              label="A quienes tocaba encuestar"
              valor={encuentros.elegibles_presentes ?? 0}
              universo={universo}
              merma={
                encuentros.no_efectivas
                  ? { n: encuentros.no_efectivas, texto: "abrieron la encuesta y no quisieron continuar" }
                  : undefined
              }
            />
            <PasoEmbudo
              label="Encuestas completas"
              valor={encuentros.efectivas ?? 0}
              universo={universo}
              tono="meta"
            />
          </ol>
          <div className="cmv2-hist-tasas">
            <span>
              <small>Asistencia</small>
              <strong>{pct(cadena.asistencia.tasa)}</strong>
              <em>de los estudiantes del estudio, cuántos fueron a clase el día de la visita</em>
            </span>
            <span data-fuerte="si">
              <small>Efectividad</small>
              <strong>{pct(cadena.efectividad.tasa)}</strong>
              <em>
                de aquellos a quienes tocaba encuestar —los que estaban en el aula, eran del
                estudio y todavía no habían contestado— cuántos completaron la encuesta
              </em>
            </span>
            <span>
              <small>Rendimiento</small>
              <strong>{pct(cadena.rendimiento.tasa)}</strong>
              <em>de todos los estudiantes del estudio, cuántas encuestas completas salieron</em>
            </span>
          </div>
        </div>
      ) : (
        <p className="cmv2-hist-nota" role="status">
          <Info size={14} aria-hidden="true" />
          Esta base no trae las columnas del encuentro (elegibles, ya medidos, no elegibles), así
          que el embudo se lee sobre matrícula y registros:{" "}
          <strong>{pct(cadena.asistencia.tasa)}</strong> de asistencia y{" "}
          <strong>{pct(cadena.rendimiento.tasa)}</strong> de rendimiento.
        </p>
      )}

      {/* 3 · Lectura en cifras */}
      {metricas.length > 0 ? (
        <ul className="cmv2-hist-metricas">
          {metricas.map((m) => (
            <li key={m.label} data-tono={m.tono}>
              <strong>{m.valor}</strong>
              <span>{m.label}</span>
              <em>{m.nota}</em>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 4 · El mismo embudo, abierto por facultad: dónde perdió cada una */}
      {embudoFacultad && embudoFacultad.filas.length > 0 ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">Dónde perdió cada facultad</span>
            <h4>El embudo, facultad por facultad</h4>
            <p>
              Dos facultades pueden terminar con el mismo resultado por razones opuestas: una
              porque sus alumnos faltaron, otra porque ya habían contestado en otro curso. La
              barra reparte a los estudiantes de cada facultad entre esas cuatro salidas.
            </p>
          </header>
          <div className="cmv2-hist-leyenda">
            <span data-tipo="efectiva">Completaron</span>
            <span data-tipo="rechazo">Empezaron y no siguieron</span>
            <span data-tipo="ausencia">Faltaron o no la abrieron</span>
            <span data-tipo="descuento">Ya habían contestado o no eran del estudio</span>
          </div>
          <ol className="cmv2-hist-apilado">
            {[...embudoFacultad.filas]
              .filter((f) => (f.elegibles ?? 0) > 0)
              .sort((a, b) => (b.rendimiento ?? 0) - (a.rendimiento ?? 0))
              .map((f) => {
                const base = f.elegibles ?? 0;
                const seg = (n: number | null) => (base > 0 ? ((n ?? 0) / base) * 100 : 0);
                const descuento = (f.ya_medidas ?? 0) + (f.no_elegibles ?? 0);
                const fuera = base - (f.efectivas ?? 0) - (f.no_efectivas ?? 0) - descuento;
                return (
                  <li key={f.celda_key}>
                    <span className="cmv2-hist-apilado-nombre" title={f.celda_label}>{f.celda_label}</span>
                    <span className="cmv2-hist-apilado-k">{fmtInt(f.k)}</span>
                    <span className="cmv2-hist-apilado-track">
                      <span data-tipo="efectiva" style={{ width: `${seg(f.efectivas)}%` }} title={`${fmtInt(f.efectivas ?? 0)} completaron`} />
                      <span data-tipo="rechazo" style={{ width: `${seg(f.no_efectivas)}%` }} title={`${fmtInt(f.no_efectivas ?? 0)} empezaron y no siguieron`} />
                      <span data-tipo="ausencia" style={{ width: `${seg(Math.max(0, fuera))}%` }} title={`${fmtInt(Math.max(0, fuera))} faltaron o no la abrieron`} />
                      <span data-tipo="descuento" style={{ width: `${seg(descuento)}%` }} title={`${fmtInt(descuento)} ya habían contestado o no eran del estudio`} />
                    </span>
                    <span className="cmv2-hist-apilado-cifra">{pct(f.rendimiento, 0)}</span>
                  </li>
                );
              })}
          </ol>
        </div>
      ) : null}

      {/* 5 · El perfil que se hereda */}
      {filasFacultad.length > 0 ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">El perfil que se hereda</span>
            <h4>Asistencia por facultad</h4>
            <p>
              Qué porcentaje de sus estudiantes asistió a clase, facultad por facultad. La línea
              vertical es el promedio de todo el estudio; la banda gris, el margen de error.
              {degradadas > 0
                ? ` Las ${degradadas} rayadas tuvieron muy pocas aulas para tener cifra propia, así que muestran ese promedio.`
                : ""}
            </p>
          </header>
          <ol className="cmv2-hist-perfil">
            {filasFacultad.map((fila) => (
              <FilaPerfil key={fila.celda_key} fila={fila} referencia={cadena.asistencia.tasa} />
            ))}
          </ol>
        </div>
      ) : null}

      {otras.map((dimension) => {
        const filas = [...dimension.filas].filter((f) => f.k > 0).sort((a, b) => (b.tasa ?? 0) - (a.tasa ?? 0));
        if (!filas.length) return null;
        return (
          <div className="cmv2-hist-bloque cmv2-hist-bloque-secundario" key={dimension.dimension_key}>
            <header className="cmv2-hist-bloque-head">
              <span className="cmv2-eyebrow">Asistencia según</span>
              <h4>{dimension.dimension_label}</h4>
            </header>
            <ol className="cmv2-hist-perfil">
              {filas.map((fila) => (
                <FilaPerfil key={fila.celda_key} fila={fila} referencia={cadena.asistencia.tasa} />
              ))}
            </ol>
          </div>
        );
      })}

      {/* Cómo se calculó: los parámetros a la vista, no plegados (ADR 0057) */}
      {diseno.declarado ? (
        <div className="cmv2-hist-bloque cmv2-hist-bloque-secundario">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">Cómo se dimensionó</span>
            <h4>Parámetros del estudio anterior</h4>
          </header>
          <dl className="cmv2-hist-params">
            <div><dt>Población objetivo</dt><dd>{num(diseno.poblacion_objetivo)}</dd></div>
            <div><dt>Confianza</dt><dd>{pct(diseno.nivel_confianza, 0)}</dd></div>
            <div><dt>Proporción esperada</dt><dd>{diseno.proporcion_esperada ?? "—"}</dd></div>
            <div><dt>Margen de error</dt><dd>{pct(diseno.margen_error, 2)}</dd></div>
            <div><dt>Efecto de diseño</dt><dd>{diseno.deff ?? "—"}</dd></div>
            <div><dt>Aulas dimensionadas</dt><dd>{num(diseno.aulas_dimensionadas)}</dd></div>
            <div><dt>Afijación</dt><dd>{diseno.afijacion || "—"}</dd></div>
            <div><dt>Selección</dt><dd>{diseno.metodo_seleccion || "—"}</dd></div>
            <div><dt>Ajuste final</dt><dd>{diseno.metodo_ajuste || "—"}</dd></div>
            <div>
              <dt>Ponderación</dt>
              <dd>{diseno.ponderado === null ? "—" : diseno.ponderado ? "Sí se aplicó" : "No aplica"}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {filtros.length > 0 ? (
        <div className="cmv2-hist-bloque cmv2-hist-bloque-secundario">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">Instrumento</span>
            <h4>Dónde cortaba la encuesta</h4>
          </header>
          <ol className="cmv2-hist-filtros">
            {filtros.map((filtro) => (
              <li key={filtro.id} data-en-denominador={filtro.en_denominador ? "si" : "no"}>
                <span className="cmv2-hist-filtro-orden">{filtro.orden}</span>
                <span className="cmv2-hist-filtro-label">{filtro.etiqueta}</span>
                <span className="cmv2-hist-filtro-efecto">
                  {filtro.en_denominador ? "cuenta como pérdida" : "sale del denominador"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
