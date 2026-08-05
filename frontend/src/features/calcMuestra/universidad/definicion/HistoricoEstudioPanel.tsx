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
  CalcMuestraReferenciaAsistenciaEmbudoFila,
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
  // La barra del peldaño mide `valor` sobre el universo y la merma se dibuja
  // DENTRO de ese ancho: lo que sobrevive más lo que se va suma exactamente el
  // tramo. Sumarlas por fuera hacía que el primer peldaño —que es el 100 %—
  // desbordara su carril y desarmara la rejilla.
  const perdido = merma?.n ?? 0;
  const sobrevive = Math.max(0, valor - perdido);
  const anchoTotal = universo > 0 ? (valor / universo) * 100 : 0;
  const anchoVivo = universo > 0 ? (sobrevive / universo) * 100 : 0;
  const anchoMerma = universo > 0 ? (perdido / universo) * 100 : 0;
  return (
    <li className="cmv2-hist-paso" data-tono={tono}>
      <span className="cmv2-hist-paso-label">{label}</span>
      <span className="cmv2-hist-paso-cifra">{fmtInt(valor)}</span>
      <span className="cmv2-hist-paso-track">
        <span className="cmv2-hist-paso-fill" style={{ width: `${anchoVivo}%` }} />
        {anchoMerma > 0 ? (
          <span
            className="cmv2-hist-paso-merma"
            data-sale={merma?.sale ? "si" : undefined}
            style={{ width: `${anchoMerma}%` }}
          />
        ) : null}
      </span>
      <span className="cmv2-hist-paso-pct">{pct(universo > 0 ? valor / universo : null, 0)}</span>
      {merma && anchoMerma > 0 ? (
        // La leyenda arranca donde arranca el tramo rayado que describe.
        <span
          className="cmv2-hist-paso-nota"
          style={{ paddingInlineEnd: `${Math.max(0, 100 - anchoTotal)}%` }}
        >
          <b data-sale={merma.sale ? "si" : undefined}>−{fmtInt(merma.n)}</b> {merma.texto}
        </span>
      ) : null}
    </li>
  );
}

/**
 * Una celda del perfil: una barra a escala fija 0 a 100 %, una línea con el
 * promedio del estudio y nada más.
 *
 * La versión anterior superponía tres codificaciones en 200 px (banda de
 * intervalo, color según estuviera sobre o bajo el promedio, rayado si el valor
 * era heredado) y el resultado no se leía: parecían barras grises al azar con
 * un halo alrededor de la punta. Aquí cada cosa se dice una sola vez y de una
 * sola forma. El intervalo, que sigue importando, se lee al pasar el cursor; y
 * una facultad sin cifra propia lo dice con palabras, que es más honesto que
 * una textura que hay que descifrar.
 */
function FilaPerfil({
  fila,
  referencia,
}: {
  fila: CalcMuestraReferenciaAsistenciaCelda;
  referencia: number | null;
}) {
  const heredada = fila.fuente_publicada === "global";
  // La barra pinta `tasa_publicada`, que es la que el módulo va a usar, no la
  // `tasa` observada. Con poca base el motor descarta la observada y publica la
  // global: dibujar la observada mostraba a Gastronomía liderando con 98 % sobre
  // 3 aulas, un número que nadie iba a heredar.
  const valor = fila.tasa_publicada ?? fila.tasa;
  const ancho = valor !== null ? Math.max(1.5, Math.min(100, valor * 100)) : 0;
  const detalle = heredada
    ? `Observada: ${pct(fila.tasa, 0)} sobre ${fmtInt(fila.k)} aulas, base insuficiente para publicarla`
    : fila.ic_low !== null && fila.ic_high !== null
      ? `Entre ${pct(fila.ic_low, 0)} y ${pct(fila.ic_high, 0)} sobre ${fmtInt(fila.k)} aulas`
      : undefined;
  return (
    <li className="cmv2-hist-fila" data-heredada={heredada ? "si" : undefined}>
      <span className="cmv2-hist-fila-nombre" title={fila.celda_label}>{fila.celda_label}</span>
      <span className="cmv2-hist-fila-k" title={`${fmtInt(fila.k)} aulas aplicadas`}>{fmtInt(fila.k)}</span>
      <span className="cmv2-hist-fila-track" title={detalle}>
        <span className="cmv2-hist-fila-barra" style={{ width: `${ancho}%` }} />
        {referencia !== null ? (
          <span className="cmv2-hist-fila-ref" style={{ left: `${Math.min(100, referencia * 100)}%` }} />
        ) : null}
      </span>
      <span className="cmv2-hist-fila-tasa">{pct(valor)}</span>
    </li>
  );
}

/**
 * El embudo repartido dentro de una dimensión. Cada barra suma 100 % de SUS
 * estudiantes, así que compara proporciones y no tamaños: una facultad chica y
 * una grande se leen en la misma escala.
 */
function EmbudoApilado({
  filas,
  prefijo,
}: {
  filas: CalcMuestraReferenciaAsistenciaEmbudoFila[];
  /** Nombre de la dimensión, para nombrar categorías que sólo son un número. */
  prefijo?: string;
}) {
  // Un criterio como `nivel_curso` llega con valores «6», «9», «3»: la cifra
  // sola no dice qué mide. Cuando toda la dimensión es numérica se antepone su
  // nombre («Nivel del curso 6»); si ya trae texto, se respeta tal cual.
  const soloNumeros =
    Boolean(prefijo) && filas.length > 0 && filas.every((f) => /^\d+([.,]\d+)?$/.test(f.celda_label.trim()));
  const nombrar = (label: string) => (soloNumeros ? `${prefijo} ${label}` : label);

  return (
    <ol className="cmv2-hist-apilado">
      {[...filas]
        .filter((f) => (f.elegibles ?? 0) > 0)
        .sort((a, b) =>
          soloNumeros
            ? Number(a.celda_label) - Number(b.celda_label)
            : (b.rendimiento ?? 0) - (a.rendimiento ?? 0),
        )
        .map((f) => {
          const base = f.elegibles ?? 0;
          const seg = (n: number | null) => (base > 0 ? ((n ?? 0) / base) * 100 : 0);
          const descuento = (f.ya_medidas ?? 0) + (f.no_elegibles ?? 0);
          const fuera = base - (f.efectivas ?? 0) - (f.no_efectivas ?? 0) - descuento;
          return (
            <li key={f.celda_key}>
              <span className="cmv2-hist-apilado-nombre" title={nombrar(f.celda_label)}>{nombrar(f.celda_label)}</span>
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
  // Los criterios de curso-horario son los ejes con los que el marco filtra
  // aulas; verlos aquí cierra el circuito entre lo que se filtró y lo que rindió.
  const CRITERIOS = ["condicion_curso", "nivel_curso", "tipo_docente", "modalidad", "tipo_sesion"];
  const embudosCriterio = referencia.embudos
    .filter((e) => CRITERIOS.includes(e.dimension_key) && e.filas.length > 1)
    .sort((a, b) => a.orden - b.orden);
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

  // Ordenar por la tasa observada ponía arriba a las facultades de 2 y 3 aulas,
  // justo las que no tienen cifra propia. Primero van las que sí midieron, de
  // mayor a menor; después las que heredan el promedio.
  const filasFacultad = facultad
    ? [...facultad.filas]
        .filter((f) => f.k > 0)
        .sort((a, b) => {
          const heredaA = a.fuente_publicada === "global" ? 1 : 0;
          const heredaB = b.fuente_publicada === "global" ? 1 : 0;
          if (heredaA !== heredaB) return heredaA - heredaB;
          return (b.tasa_publicada ?? b.tasa ?? 0) - (a.tasa_publicada ?? a.tasa ?? 0);
        })
    : [];
  const heredadas = filasFacultad.filter((f) => f.fuente_publicada === "global");
  const degradadas = heredadas.length;
  // La línea de referencia tiene que ser el mismo valor que heredan las celdas
  // sin base; si no, la línea cae en un sitio y las barras heredadas en otro.
  const refPerfil = heredadas[0]?.tasa_publicada ?? cadena.asistencia.tasa;

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
                de quienes estaban en el aula, eran del estudio y todavía no habían contestado,
                cuántos completaron la encuesta
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
          <EmbudoApilado filas={embudoFacultad.filas} />
        </div>
      ) : null}

      {/* 5 · Los mismos criterios con los que el marco filtra aulas */}
      {embudosCriterio.length > 0 ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">Criterios del curso-horario</span>
            <h4>Qué rindió cada tipo de aula</h4>
            <p>
              Los mismos ejes con los que Marco decide qué aulas entran. Sirve para saber si un
              taller rinde distinto que una clase teórica antes de fijar los criterios de este año.
            </p>
          </header>
          <div className="cmv2-hist-leyenda">
            <span data-tipo="efectiva">Completaron</span>
            <span data-tipo="rechazo">Empezaron y no siguieron</span>
            <span data-tipo="ausencia">Faltaron o no la abrieron</span>
            <span data-tipo="descuento">Ya habían contestado o no eran del estudio</span>
          </div>
          {embudosCriterio.map((e) => (
            <div className="cmv2-hist-criterio" key={e.dimension_key}>
              <span className="cmv2-eyebrow">{e.dimension_label}</span>
              <EmbudoApilado filas={e.filas} prefijo={e.dimension_label} />
            </div>
          ))}
        </div>
      ) : null}

      {/* 6 · El perfil que se hereda */}
      {filasFacultad.length > 0 ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">El perfil que se hereda</span>
            <h4>Asistencia por facultad</h4>
            <p>
              De cada 100 estudiantes matriculados en las aulas visitadas de esa facultad, cuántos
              estaban en clase el día de la visita. La barra va de 0 a 100 % y la línea vertical
              marca el {pct(refPerfil, 0)} de referencia, para ver de un vistazo quién queda por
              encima y quién por debajo.
            </p>
          </header>
          <ol className="cmv2-hist-perfil">
            {filasFacultad
              .filter((f) => f.fuente_publicada !== "global")
              .map((fila) => (
                <FilaPerfil key={fila.celda_key} fila={fila} referencia={refPerfil} />
              ))}
          </ol>
          {degradadas > 0 ? (
            <>
              {/* Las que no fijan cifra propia se agrupan bajo su propio rótulo en vez
                  de repetir la misma aclaración en cada fila. */}
              <p className="cmv2-hist-nota-grupo">
                Estas {degradadas} se aplicaron en muy pocas aulas para fijar una cifra propia, así
                que heredan el {pct(refPerfil, 0)} de referencia. Pasa el cursor para ver qué
                observó cada una.
              </p>
              <ol className="cmv2-hist-perfil">
                {filasFacultad
                  .filter((f) => f.fuente_publicada === "global")
                  .map((fila) => (
                    <FilaPerfil key={fila.celda_key} fila={fila} referencia={refPerfil} />
                  ))}
              </ol>
            </>
          ) : null}
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
