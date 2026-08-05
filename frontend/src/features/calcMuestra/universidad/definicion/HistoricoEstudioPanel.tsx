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
import { Fragment, useState } from "react";
import {
  BarraTasa,
  ComposicionCriterio,
  componerCriterio,
} from "../shared/graficos/PrimitivasGrafico";
import { tip, useTooltipGrafico } from "../shared/graficos/TooltipGrafico";
import type {
  CalcMuestraReferenciaAsistencia,
  CalcMuestraReferenciaAsistenciaCelda,
  CalcMuestraReferenciaAsistenciaCadenaSeleccion,
  CalcMuestraReferenciaAsistenciaCadenasReemplazo,
  CalcMuestraReferenciaAsistenciaComposicion,
  CalcMuestraReferenciaAsistenciaCuotas,
  CalcMuestraReferenciaAsistenciaEmbudoFila,
  CalcMuestraReferenciaAsistenciaSerieCampo,
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
  mermas = [],
  suma,
  tono,
}: {
  label: string;
  valor: number;
  universo: number;
  /** Todo lo que se va en este peldaño. Puede irse por más de un motivo. */
  mermas?: { n: number; texto: string; sale?: boolean }[];
  /**
   * Lo que ENTRA en este peldaño. Un embudo que sube rompe la metáfora, y por
   * eso comunica: es la señal de que respondió gente que el conteo del aula no
   * había visto.
   */
  suma?: { n: number; texto: string };
  tono?: "meta";
}) {
  // La barra del peldaño mide `valor` sobre el universo y las mermas se dibujan
  // DENTRO de ese ancho: lo que sobrevive más lo que se va suma exactamente el
  // tramo. Sumarlas por fuera hacía que el primer peldaño, que es el 100 %,
  // desbordara su carril y desarmara la rejilla.
  //
  // Un peldaño puede perder gente por más de un motivo, y dibujar sólo el
  // primero fue un defecto real: del tramo «a quienes tocaba encuestar» a
  // «encuestas completas» se iban 1.122 personas y la leyenda declaraba 335,
  // así que la caída no cuadraba con las cifras de al lado.
  const activas = mermas.filter((m) => m.n > 0);
  const entra = suma && suma.n > 0 ? suma.n : 0;
  const perdido = activas.reduce((acc, m) => acc + m.n, 0);
  const sobrevive = Math.max(0, valor + entra - perdido);
  const escala = (n: number) => (universo > 0 ? (n / universo) * 100 : 0);
  const anchoTotal = escala(valor + entra);
  return (
    <li className="cmv2-hist-paso" data-tono={tono}>
      <span className="cmv2-hist-paso-label">{label}</span>
      <span className="cmv2-hist-paso-cifra">{fmtInt(valor)}</span>
      <span className="cmv2-hist-paso-track">
        <span className="cmv2-hist-paso-fill" style={{ width: `${escala(sobrevive)}%` }} />
        {entra > 0 ? (
          <span
            className="cmv2-hist-paso-suma"
            style={{ width: `${escala(entra)}%` }}
            {...tip({
              titulo: `${fmtInt(entra)} personas`,
              nota: suma?.texto,
              tono: "asistencia",
            })}
          />
        ) : null}
        {activas.map((merma, i) => (
          <span
            key={merma.texto}
            className="cmv2-hist-paso-merma"
            data-sale={merma.sale ? "si" : undefined}
            data-ultima={i === activas.length - 1 || undefined}
            style={{ width: `${escala(merma.n)}%` }}
            {...tip({
              titulo: `${fmtInt(merma.n)} personas`,
              nota: merma.texto,
              tono: merma.sale ? "descuento" : "perdida",
            })}
          />
        ))}
      </span>
      <span className="cmv2-hist-paso-pct">{pct(universo > 0 ? valor / universo : null, 0)}</span>
      {activas.length > 0 ? (
        // La leyenda termina donde termina el tramo que describe.
        <span
          className="cmv2-hist-paso-nota"
          style={{ paddingInlineEnd: `${Math.max(0, 100 - anchoTotal)}%` }}
        >
          {entra > 0 ? (
            <span>
              <b data-suma="si">+{fmtInt(entra)}</b> {suma?.texto}
              {activas.length > 0 ? " · " : null}
            </span>
          ) : null}
          {activas.map((merma, i) => (
            <span key={merma.texto}>
              {i > 0 ? " · " : null}
              <b data-sale={merma.sale ? "si" : undefined}>−{fmtInt(merma.n)}</b> {merma.texto}
            </span>
          ))}
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
      <span className="cmv2-hist-fila-nombre">{fila.celda_label}</span>
      <span className="cmv2-hist-fila-k">{fmtInt(fila.k)}</span>
      <span
        className="cmv2-hist-fila-track"
        aria-label={detalle}
        {...tip({
          titulo: fila.celda_label,
          filas: [
            { label: "Asistencia", valor: pct(valor) },
            { label: "Aulas aplicadas", valor: fmtInt(fila.k) },
          ],
          nota: detalle,
          tono: heredada ? "heredada" : "asistencia",
        })}
      >
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
              <span className="cmv2-hist-apilado-nombre">{nombrar(f.celda_label)}</span>
              <span className="cmv2-hist-apilado-k">{fmtInt(f.k)}</span>
              <span
                className="cmv2-hist-apilado-track"
                {...tip({
                  titulo: nombrar(f.celda_label),
                  filas: [
                    { label: "Completaron", valor: fmtInt(f.efectivas ?? 0) },
                    { label: "Empezaron y no siguieron", valor: fmtInt(f.no_efectivas ?? 0) },
                    { label: "Faltaron o no la abrieron", valor: fmtInt(Math.max(0, fuera)) },
                    { label: "Ya habían contestado", valor: fmtInt(descuento) },
                  ],
                  nota: `${fmtInt(base)} estudiantes del estudio en ${fmtInt(f.k)} aulas`,
                  tono: "efectiva",
                })}
              >
                <span data-tipo="efectiva" style={{ width: `${seg(f.efectivas)}%` }} />
                <span data-tipo="rechazo" style={{ width: `${seg(f.no_efectivas)}%` }} />
                <span data-tipo="ausencia" style={{ width: `${seg(Math.max(0, fuera))}%` }} />
                <span data-tipo="descuento" style={{ width: `${seg(descuento)}%` }} />
              </span>
              <span className="cmv2-hist-apilado-cifra">{pct(f.rendimiento, 0)}</span>
            </li>
          );
        })}
    </ol>
  );
}

/**
 * La serie del operativo, semana a semana.
 *
 * La primera versión sólo daba porcentajes y no decía sobre qué: un «81 %»
 * suelto obliga a adivinar el denominador. Aquí cada semana declara sus
 * absolutos en el orden en que ocurren (a cuántos alcanzaba, cuántos fueron a
 * clase, a cuántos tocaba encuestar, cuántas completas salieron) y el
 * porcentaje va al lado de las dos cifras que lo producen.
 *
 * Existe por una pregunta que el agregado no puede responder: si el campo se
 * fue agotando. Mientras más aulas se aplican, más probable es que quien está
 * en la siguiente ya haya respondido en otra.
 */
function SerieCampo({
  serie,
  meta,
}: {
  serie: CalcMuestraReferenciaAsistenciaSerieCampo;
  meta: number | null;
}) {
  const filas = [...serie.filas].sort((a, b) => a.orden - b.orden);
  const maxAulas = Math.max(1, ...filas.map((f) => f.k));
  const totalEfectivas = filas[filas.length - 1]?.efectivas_acumuladas ?? null;
  return (
    <div className="cmv2-hist-semanas">
      {filas.map((fila) => {
        const acumulado = fila.efectivas_acumuladas ?? 0;
        const avance = meta && meta > 0 ? Math.min(100, (acumulado / meta) * 100) : null;
        return (
          <article className="cmv2-hist-semana" key={fila.semana}>
            <header>
              <h5>{fila.etiqueta}</h5>
              <span className="cmv2-hist-semana-aulas">
                <span style={{ width: `${(fila.k / maxAulas) * 100}%` }} />
                <em>{fmtInt(fila.k)} aulas</em>
              </span>
            </header>

            {/* Los absolutos en el orden en que ocurren: cada cifra es el
                universo de la siguiente, así que la cadena se lee sola. */}
            <ol className="cmv2-hist-semana-flujo">
              <li>
                <strong>{num(fila.elegibles)}</strong>
                <span>estudiantes del estudio en esas aulas</span>
              </li>
              <li data-merma="si">
                <strong>−{num(fila.ausentes)}</strong>
                <span>faltaron a clase</span>
              </li>
              <li>
                <strong>{num(fila.asistentes)}</strong>
                <span>estaban en el aula</span>
              </li>
              <li data-merma="si">
                <strong>−{num((fila.ya_medidas ?? 0) + (fila.no_elegibles ?? 0))}</strong>
                <span>ya habían contestado o no eran del estudio</span>
              </li>
              <li>
                <strong>{num(fila.a_encuestar)}</strong>
                <span>a quienes tocaba encuestar</span>
              </li>
              <li data-tono="meta">
                <strong>{num(fila.efectivas)}</strong>
                <span>encuestas completas</span>
              </li>
            </ol>

            {/* Cada tasa dice de dónde sale: numerador sobre denominador. */}
            <div className="cmv2-hist-semana-tasas">
              <BarraTasa
                label="Asistencia"
                detalle={`${num(fila.asistentes)} de ${num(fila.elegibles)}`}
                valor={fila.asistencia}
                tono="asistencia"
              />
              <BarraTasa
                label="Ya habían contestado"
                detalle={`${num(fila.ya_medidas)} de ${num(fila.asistentes)} presentes`}
                valor={fila.pct_ya_medidas}
                tono="descuento"
              />
              <BarraTasa
                label="Efectividad"
                detalle={`${num(fila.efectivas)} de ${num(fila.a_encuestar)}`}
                valor={fila.efectividad}
                tono="meta"
              />
            </div>

            <footer className="cmv2-hist-semana-pie">
              <span>
                <strong>{num(fila.efectivas_por_aula)}</strong> encuestas por aula
              </span>
              <span>
                <strong>{num(acumulado)}</strong> acumuladas
                {avance !== null ? ` · ${avance.toFixed(0)} % de la meta` : ""}
              </span>
              {avance !== null ? (
                <span className="cmv2-hist-semana-avance" aria-hidden="true">
                  <span style={{ width: `${avance}%` }} />
                </span>
              ) : null}
            </footer>
          </article>
        );
      })}
      {totalEfectivas !== null ? (
        <p className="cmv2-hist-nota-grupo">
          El campo duró {filas.length} semanas y acumuló {num(totalEfectivas)} encuestas completas.
          Las encuestas por aula caen de {num(filas[0]?.efectivas_por_aula)} a{" "}
          {num(filas[filas.length - 1]?.efectivas_por_aula)} entre la primera semana y la última.
        </p>
      ) : null}
    </div>
  );
}


/** «17:00-20:00» se lee peor que «5:00–8:00 pm», que es como se dice una clase. */
function horaLegible(horario: string): string {
  const partes = horario.split(/[-–]/).map((p) => p.trim());
  const ampm = (hhmm: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
    if (!m) return "";
    const h = Number(m[1]);
    const sufijo = h < 12 ? "am" : "pm";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m[2]} ${sufijo}`;
  };
  const desde = ampm(partes[0] ?? "");
  const hasta = partes[1] ? ampm(partes[1]) : "";
  if (!desde) return horario;
  if (!hasta) return desde;
  // El sufijo se repite sólo si cambia de mitad del día.
  const mismoSufijo = desde.slice(-2) === hasta.slice(-2);
  return mismoSufijo ? `${desde.slice(0, -3)}–${hasta}` : `${desde}–${hasta}`;
}

/**
 * La matriz de cadenas: una fila por titular y la historia de qué le pasó.
 *
 * El diseño no manda aplicar un curso-horario suelto. Manda cubrir un puesto, y
 * para cada puesto sortea una cadena que empieza en un titular y sigue en sus
 * suplentes; si el titular se cae, se baja un escalón. El agregado («169 de 170
 * cubiertas») dice el resultado y calla el costo: una cadena resuelta al primer
 * intento y otra que necesitó cinco valen lo mismo ahí y no cuestan lo mismo.
 *
 * Cada columna es un escalón y cada casilla dice qué pasó en él. Ordena por lo
 * que costó, así que las cadenas que dieron trabajo quedan arriba.
 */
function MatrizCadenas({
  cadenas,
  cuotas,
}: {
  cadenas: CalcMuestraReferenciaAsistenciaCadenasReemplazo;
  /** Cuota por facultad y sexo, cuando el estudio la declara. */
  cuotas: CalcMuestraReferenciaAsistenciaCuotas | null;
}) {
  const cuotaDe = (facultad: string) =>
    cuotas?.filas.find(
      (f) => f.facultad.trim().toUpperCase() === facultad.trim().toUpperCase(),
    ) ?? null;
  const columnas = Math.min(cadenas.profundidad_maxima, 8);
  // Agrupada por facultad: comparar dos cursos-horario sólo tiene sentido dentro
  // de su facultad, porque el tamaño de aula y la asistencia cambian por
  // facultad. Dentro de cada grupo, primero las cadenas que más costaron.
  const porFacultad = new Map<string, CalcMuestraReferenciaAsistenciaCadenaSeleccion[]>();
  for (const fila of cadenas.filas) {
    const clave = fila.facultad || "Sin facultad";
    const grupo = porFacultad.get(clave);
    if (grupo) grupo.push(fila);
    else porFacultad.set(clave, [fila]);
  }
  const grupos = [...porFacultad.entries()]
    .map(([facultad, filas]) => ({
      facultad,
      filas: [...filas].sort((a, b) => {
        if (b.escalones_trabajados !== a.escalones_trabajados) {
          return b.escalones_trabajados - a.escalones_trabajados;
        }
        return (b.efectivas ?? 0) - (a.efectivas ?? 0);
      }),
      efectivas: filas.reduce((acc, f) => acc + (f.efectivas ?? 0), 0),
      conReemplazo: filas.filter((f) => f.resuelta_en !== null && f.resuelta_en !== 1).length,
    }))
    .sort((a, b) => b.filas.length - a.filas.length);
  const encabezados = Array.from({ length: columnas }, (_, i) => (i === 0 ? "T" : `R${i}`));

  return (
    <div className="cmv2-hist-matriz-marco">
      <div
        className="cmv2-hist-matriz"
        style={{ ["--cmv2-hist-escalones" as string]: String(columnas) }}
        role="table"
        aria-label="Historia de cada cadena de reemplazo, por facultad"
      >
        <div className="cmv2-hist-matriz-head" role="row">
          <span role="columnheader">Titular sorteado</span>
          {encabezados.map((etiqueta, i) => (
            <span
              key={etiqueta}
              role="columnheader"
              {...tip({ titulo: i === 0 ? "Titular" : `Reemplazo ${i}`,
                nota: i === 0 ? "El curso-horario que salió sorteado" : "Entra sólo si se cae el escalón anterior" })}
            >
              {etiqueta}
            </span>
          ))}
          <span
            role="columnheader"
            {...tip({ titulo: "Total", nota: "Encuestas completas de toda la cadena, sumando sus escalones aplicados" })}
          >
            Total
          </span>
        </div>
        {grupos.map((grupo) => (
          <Fragment key={grupo.facultad}>
            <div className="cmv2-hist-matriz-grupo" role="row">
              <span role="cell">
                {grupo.facultad}
                <em>
                  {fmtInt(grupo.filas.length)} titulares · {fmtInt(grupo.efectivas)} completas
                  {grupo.conReemplazo > 0 ? ` · ${fmtInt(grupo.conReemplazo)} con reemplazo` : ""}
                </em>
                {/* Aquí SÍ hay denominador —la cuota del diseño—, así que se
                    puede dar una tasa. Es cumplimiento, no efectividad: por eso
                    pasa del 100 % sin que nada esté mal. */}
                {(() => {
                  const q = cuotaDe(grupo.facultad);
                  if (!q || (q.cuota_mujeres === null && q.cuota_hombres === null)) return null;
                  return (
                    <span className="cmv2-hist-matriz-cuota">
                      <b data-sexo="mujer">
                        M {fmtInt(q.logradas_mujeres ?? 0)}/{fmtInt(q.cuota_mujeres ?? 0)}
                        <i>{pct(q.cumplimiento_mujeres, 0)}</i>
                      </b>
                      <b data-sexo="hombre" data-corto={(q.cumplimiento_hombres ?? 1) < 1 || undefined}>
                        H {fmtInt(q.logradas_hombres ?? 0)}/{fmtInt(q.cuota_hombres ?? 0)}
                        <i>{pct(q.cumplimiento_hombres, 0)}</i>
                      </b>
                    </span>
                  );
                })()}
              </span>
            </div>
            {grupo.filas.map((fila) => (
              <div className="cmv2-hist-matriz-fila" role="row" key={fila.cadena}>
                <span
                  className="cmv2-hist-matriz-titular"
                  role="cell"
                  {...tip({
                    titulo: fila.titular,
                    filas: [
                      ...(fila.nombre_curso ? [{ label: "Curso", valor: fila.nombre_curso }] : []),
                      { label: "Facultad", valor: fila.facultad || "Sin facultad" },
                      { label: "Encuestas completas", valor: fmtInt(fila.efectivas ?? 0) },
                      // Composición, no tasa: no existe denominador por sexo en
                      // cada curso-horario, así que un porcentaje aquí mentiría.
                      { label: "Mujeres", valor: fmtInt(fila.efectivas_mujeres ?? 0) },
                      { label: "Hombres", valor: fmtInt(fila.efectivas_hombres ?? 0) },
                      { label: "Escalones trabajados", valor: fmtInt(fila.escalones_trabajados) },
                    ],
                    nota: fila.resuelta_en === null
                      ? "La cadena nunca se resolvió"
                      : fila.resuelta_en === 1
                        ? "Se resolvió con el titular"
                        : `Se resolvió en el reemplazo ${fila.resuelta_en - 1}`,
                    tono: fila.resuelta_en === 1 ? "efectiva" : "perdida",
                  })}
                >
                  <b>{fila.titular}</b>
                  {fila.nombre_curso ? <i>{fila.nombre_curso}</i> : null}
                  {fila.horario ? <small>{horaLegible(fila.horario)}</small> : null}
                </span>
                {Array.from({ length: columnas }, (_, i) => {
                  const escalon = fila.escalones[i];
                  if (!escalon) {
                    return (
                      <span key={i} className="cmv2-hist-matriz-casilla" data-estado="vacio" role="cell" />
                    );
                  }
                  const datosTip = escalon.estado === "aplicado"
                    ? {
                        titulo: escalon.curso_horario,
                        filas: [
                          { label: escalon.rol, valor: "se aplicó" },
                          { label: "Encuestas completas", valor: fmtInt(escalon.efectivas ?? 0) },
                          { label: "Estudiantes elegibles", valor: fmtInt(escalon.elegibles ?? 0) },
                          { label: "Efectividad del aula", valor: pct(escalon.rendimiento, 0) },
                        ],
                        tono: "efectiva",
                      }
                    : escalon.estado === "cayo"
                      ? {
                          titulo: escalon.curso_horario,
                          filas: [{ label: escalon.rol, valor: "se cayó" }],
                          nota: escalon.motivo ?? "Sin motivo registrado",
                          tono: "perdida",
                        }
                      : {
                          titulo: escalon.curso_horario,
                          filas: [{ label: escalon.rol, valor: "en reserva" }],
                          nota: "No hizo falta contactarlo",
                          tono: "reserva",
                        };
                  return (
                    <span
                      key={i}
                      className="cmv2-hist-matriz-casilla"
                      data-estado={escalon.estado}
                      role="cell"
                      {...tip(datosTip)}
                    >
                      {escalon.estado === "aplicado" ? (
                        <>
                          <b>{fmtInt(escalon.efectivas ?? 0)}</b>
                          {/* La efectividad del aula: sin ella, 25 completas de un
                              aula de 30 y de una de 90 se leen igual. */}
                          <i>{pct(escalon.rendimiento, 0)}</i>
                        </>
                      ) : escalon.estado === "cayo" && escalon.motivo_codigo ? (
                        <b>{escalon.motivo_codigo}</b>
                      ) : null}
                    </span>
                  );
                })}
                <span className="cmv2-hist-matriz-total" role="cell">
                  <b>{fmtInt(fila.efectivas ?? 0)}</b>
                  <i>{pct(fila.rendimiento, 0)}</i>
                </span>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
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

  // Lo conseguido en campo: lo declara el diseño y, si no, sale del embudo.
  const logradas =
    diseno.efectivas_logradas ?? encuentros?.efectivas ?? cadena.rendimiento.numerador ?? null;
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

  // Un conmutador, no una pila. Con todo apilado la pestaña medía 2.800 px de
  // scroll y las comparaciones que importan (esta facultad contra aquella, esta
  // semana contra la siguiente) quedaban a media pantalla de distancia. Cada
  // vista responde una pregunta y sólo se ofrece si hay datos para responderla.
  const vistas = [
    { id: "general" as const, label: "El embudo", disponible: true },
    { id: "facultad" as const, label: "Por facultad", disponible: Boolean(embudoFacultad) || filasFacultad.length > 0 },
    { id: "criterio" as const, label: "Por criterio", disponible: embudosCriterio.length > 0 || otras.length > 0 },
    { id: "semana" as const, label: "Semana a semana", disponible: Boolean(referencia.serie_campo) },
    { id: "cobertura" as const, label: "Titulares y reemplazos", disponible: Boolean(referencia.cadenas_reemplazo) },
    { id: "diseno" as const, label: "Cómo se dimensionó", disponible: diseno.declarado || filtros.length > 0 },
  ].filter((v) => v.disponible);
  const [vista, setVista] = useState<(typeof vistas)[number]["id"]>("general");
  // Un solo tooltip para toda la superficie, por delegación: la matriz tiene
  // ~1.400 casillas y montar un listener en cada una costaría más que dibujarla.
  const { manejadores, tooltip } = useTooltipGrafico();
  const vistaActiva = vistas.some((v) => v.id === vista) ? vista : "general";

  return (
    <section
      className="cmv2-hist-panel"
      data-qa-geometry-group="calc-muestra/historico-estudio"
      data-qa-geometry-contract="intrinsic"
      aria-label="Lectura del estudio histórico"
      {...manejadores}
    >
      {tooltip}
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

      {vistas.length > 1 ? (
        <div className="cmv2-hist-conmutador" role="group" aria-label="Desglose del estudio histórico">
          {vistas.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              aria-pressed={vistaActiva === opcion.id}
              data-activo={vistaActiva === opcion.id || undefined}
              onClick={() => setVista(opcion.id)}
            >
              {opcion.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* 2 · ¿Dónde se perdió? */}
      {vistaActiva === "general" ? (<>
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
              mermas={
                encuentros.asistentes !== null
                  ? [{ n: universo - encuentros.asistentes, texto: "faltaron a clase ese día" }]
                  : []
              }
            />
            <PasoEmbudo
              label="Fueron a clase"
              valor={encuentros.asistentes ?? 0}
              universo={universo}
              mermas={[
                {
                  n: encuentros.ya_medidas ?? 0,
                  texto: "declararon en el aula que ya habían contestado en otro curso",
                  sale: true,
                },
                {
                  n: encuentros.no_elegibles ?? 0,
                  texto: "abrieron y el formulario los descartó por no ser del estudio",
                  sale: true,
                },
              ]}
            />
            <PasoEmbudo
              label="A quienes tocaba encuestar"
              valor={encuentros.elegibles_presentes ?? 0}
              universo={universo}
              // Este peldaño no sólo pierde: también recibe. En 43 aulas
              // respondió gente que el conteo no había visto, y con ese tramo
              // declarado el embudo cuadra exactamente:
              // 4.425 + 105 = 3.303 + 335 + 892.
              suma={{
                n: encuentros.presentes_no_contados ?? 0,
                texto: "respondieron sin estar en el conteo del aula",
              }}
              mermas={[
                {
                  n: encuentros.no_efectivas ?? 0,
                  texto: "abrieron la encuesta y no quisieron continuar",
                },
                {
                  n: encuentros.no_realizadas ?? 0,
                  texto: "nunca llegaron a abrirla",
                },
              ]}
            />
            <PasoEmbudo
              label="Encuestas completas"
              valor={encuentros.efectivas ?? 0}
              universo={universo}
              tono="meta"
            />
          </ol>
          {(encuentros.presentes_no_contados ?? 0) > 0 ? (
            /*
             * Minimalista y en el sitio donde pasa: el tramo azul del tercer
             * peldaño necesita una frase, no un párrafo. Sin ella, quien sume
             * las cifras encuentra un embudo que crece y no sabe por qué.
             */
            <p className="cmv2-hist-aclaracion">
              <b>+{fmtInt(encuentros.presentes_no_contados ?? 0)}</b> respondieron sin aparecer en el
              conteo del aula, en{" "}
              <b>{fmtInt(encuentros.unidades_con_residual_negativo)}</b> de{" "}
              {fmtInt(cobertura.aplicados)} aulas. Pasa cuando el aplicador cuenta al entrar y
              después llega gente: oyentes, alumnos de otra sección, quien pasaba por ahí. El
              formulario los registró igual, así que cuentan.
            </p>
          ) : null}
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

      </>) : null}

      {/* 4 · El mismo embudo, abierto por facultad: dónde perdió cada una */}
      {vistaActiva === "facultad" ? (<>
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

      {/* 6 · El perfil por facultad vive en la misma vista que su embudo */}
      </>) : null}

      {/* 5 · Los mismos criterios con los que el marco filtra aulas */}
      {vistaActiva === "criterio" ? (<>
      {/* Primero QUÉ hay, después CÓMO rindió: sin saber cuántas aulas de cada
          tipo existen, un rendimiento alto sobre tres aulas se lee como señal. */}
      {referencia.composicion.length > 0 ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">De qué está hecho el marco</span>
            <h4>Qué tipo de cursos-horario tiene cada facultad</h4>
            <p>
              Cada barra reparte las aulas de una facultad entre las categorías del criterio, y
              siempre suma el 100 % de esa facultad. Sirve para ver quién concentra un tipo de aula
              que el resto casi no tiene, porque eso cambia lo que hay que esperar de ella.
            </p>
          </header>
          {[...referencia.composicion]
            .sort((a, b) => a.orden - b.orden)
            .map((composicion) => (
              <div className="cmv2-hist-criterio" key={composicion.criterio_key}>
                <span className="cmv2-eyebrow">{composicion.criterio_label}</span>
                <ComposicionCriterio
                  composicion={{
                    criterio_label: composicion.criterio_label,
                    categorias: composicion.categorias,
                    filas: composicion.filas.map((fila) => ({
                      grupo: fila.facultad,
                      n: fila.n,
                      reparto: fila.reparto,
                    })),
                  }}
                />
              </div>
            ))}
        </div>
      ) : null}

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

      </>) : null}

      {vistaActiva === "semana" && referencia.serie_campo ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">El campo en el tiempo</span>
            <h4>Qué pasó cada semana</h4>
            <p>
              Cada semana declara sus cifras en el orden en que ocurrieron, y cada porcentaje lleva
              al lado las dos cantidades que lo producen.
            </p>
          </header>
          <SerieCampo serie={referencia.serie_campo} meta={meta} />
        </div>
      ) : null}

      {vistaActiva === "cobertura" && referencia.cadenas_reemplazo ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">La historia de cada titular</span>
            <h4>
              {fmtInt(referencia.cadenas_reemplazo.resueltas_con_titular)} se resolvieron al primer
              intento, {fmtInt(referencia.cadenas_reemplazo.resueltas_con_reemplazo)} necesitaron
              reemplazo
            </h4>
            <p>
              El diseño sortea, para cada puesto de la muestra, un curso-horario titular y una
              cadena de suplentes por si ese se cae. Una fila por titular; cada columna es un
              escalón de su cadena. Verde con cifra es que se aplicó y cuántas encuestas dio, ámbar
              es que se cayó, y el gris claro son suplentes que nunca hizo falta contactar. Pasa el
              cursor por cualquier casilla para ver el curso-horario y qué pasó.
            </p>
          </header>
          <div className="cmv2-hist-leyenda">
            <span data-tipo="efectiva">Se aplicó · completas y % de sus elegibles</span>
            <span data-tipo="rechazo">Se cayó · la letra dice por qué</span>
            <span data-tipo="ausencia">No hizo falta contactarlo</span>
          </div>
          {/* La letra de la casilla no puede quedar muda: su significado va
              inmediatamente antes de la matriz, no al pie de la página. */}
          {referencia.cadenas_reemplazo.motivos.length > 0 ? (
            <ul className="cmv2-hist-codigos">
              {[...referencia.cadenas_reemplazo.motivos]
                .sort((a, b) => a.orden - b.orden)
                .map((motivo) => (
                  <li key={motivo.motivo}>
                    <b>{motivo.codigo}</b>
                    <span>{motivo.motivo}</span>
                    <em>{fmtInt(motivo.n)}</em>
                  </li>
                ))}
            </ul>
          ) : null}
          <MatrizCadenas cadenas={referencia.cadenas_reemplazo} cuotas={referencia.cuotas} />
        </div>
      ) : null}

      {/* 6 · El perfil que se hereda, en la misma vista que su embudo */}
      {vistaActiva === "facultad" && filasFacultad.length > 0 ? (
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

      {(vistaActiva === "criterio" ? otras : []).map((dimension) => {
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
      {vistaActiva === "diseno" && diseno.declarado ? (
        <div className="cmv2-hist-bloque">
          <header className="cmv2-hist-bloque-head">
            <span className="cmv2-eyebrow">Cómo se dimensionó</span>
            <h4>Del universo a las aulas que había que visitar</h4>
            <p>
              El recorrido que llevó de la población entera al número de cursos-horario a aplicar.
              Cada paso toma la cifra anterior y le aplica una decisión del diseño.
            </p>
          </header>

          {/* El cálculo como recorrido y no como lista suelta: cada escalón dice
              qué decisión lo produjo, que es lo que hay que replicar o cambiar
              este año. */}
          <ol className="cmv2-hist-escalera">
            <li>
              <span className="cmv2-hist-escalera-cifra">{num(diseno.poblacion_objetivo)}</span>
              <span className="cmv2-hist-escalera-que">estudiantes en la población</span>
              <span className="cmv2-hist-escalera-como">el universo del que se quería hablar</span>
            </li>
            <li data-tono="meta">
              <span className="cmv2-hist-escalera-cifra">{num(diseno.muestra)}</span>
              <span className="cmv2-hist-escalera-que">encuestas necesarias</span>
              <span className="cmv2-hist-escalera-como">
                {[
                  diseno.nivel_confianza !== null ? `${pct(diseno.nivel_confianza, 0)} de confianza` : null,
                  diseno.margen_error !== null ? `±${pct(diseno.margen_error, 2)}` : null,
                  diseno.proporcion_esperada !== null ? `p = ${diseno.proporcion_esperada}` : null,
                  diseno.deff !== null ? `efecto de diseño ${diseno.deff}` : null,
                ].filter(Boolean).join(" · ")}
              </span>
            </li>
            {diseno.sobremuestra !== null ? (
              <li>
                <span className="cmv2-hist-escalera-cifra">{num(diseno.sobremuestra)}</span>
                <span className="cmv2-hist-escalera-que">encuestas a buscar en campo</span>
                <span className="cmv2-hist-escalera-como">
                  {diseno.ratio_sobremuestra !== null
                    ? `sobremuestra ×${diseno.ratio_sobremuestra} para absorber lo que se pierde`
                    : "sobremuestra para absorber lo que se pierde"}
                </span>
              </li>
            ) : null}
            {diseno.aulas_dimensionadas !== null ? (
              <li>
                <span className="cmv2-hist-escalera-cifra">{num(diseno.aulas_dimensionadas)}</span>
                <span className="cmv2-hist-escalera-que">cursos-horario a visitar</span>
                <span className="cmv2-hist-escalera-como">
                  {diseno.tasa_respuesta_asumida !== null
                    ? `suponiendo que respondería el ${pct(diseno.tasa_respuesta_asumida, 0)} de cada aula`
                    : "según el rendimiento supuesto por aula"}
                </span>
              </li>
            ) : null}
            {diseno.aulas_aplicadas !== null ? (
              <li data-tono="real">
                <span className="cmv2-hist-escalera-cifra">{num(diseno.aulas_aplicadas)}</span>
                <span className="cmv2-hist-escalera-que">cursos-horario aplicados de verdad</span>
                <span className="cmv2-hist-escalera-como">
                  {diseno.aulas_dimensionadas !== null && diseno.aulas_dimensionadas > 0
                    ? `${diseno.aulas_aplicadas > diseno.aulas_dimensionadas ? "+" : ""}${fmtInt(diseno.aulas_aplicadas - diseno.aulas_dimensionadas)} frente a lo dimensionado`
                    : "lo que el operativo llegó a cubrir"}
                </span>
              </li>
            ) : null}

            {/* La escalera terminaba en las aulas y callaba qué fue de las
                encuestas. El recorte y la ponderación son decisiones del diseño
                tanto como el tamaño muestral, y son las que explican por qué la
                base con la que se analiza no es la que salió de campo. */}
            {logradas !== null ? (
              <li data-tono="real">
                <span className="cmv2-hist-escalera-cifra">{num(logradas)}</span>
                <span className="cmv2-hist-escalera-que">encuestas completas conseguidas</span>
                <span className="cmv2-hist-escalera-como">
                  {diseno.sobremuestra !== null && diseno.sobremuestra > 0
                    ? `${pct(logradas / diseno.sobremuestra, 0)} de la sobremuestra buscada`
                    : "lo que campo llegó a levantar"}
                </span>
              </li>
            ) : null}
            {diseno.base_analitica !== null ? (
              <li data-tono="meta">
                <span className="cmv2-hist-escalera-cifra">{num(diseno.base_analitica)}</span>
                <span className="cmv2-hist-escalera-que">base con la que se analizó</span>
                <span className="cmv2-hist-escalera-como">
                  {diseno.casos_recortados !== null && diseno.casos_recortados > 0
                    ? `−${fmtInt(diseno.casos_recortados)} recortados al azar dentro de cada celda, para que ninguna pesara más de lo que le tocaba`
                    : diseno.metodo_ajuste || "tras el ajuste final"}
                </span>
              </li>
            ) : null}
          </ol>

          {/* La cuota se reparte por sexo y no siempre se llena igual. Es la
              lectura que explica por qué una facultad hubo que ponderarla, y
              vive aquí porque es una consecuencia del diseño, no del campo. */}
          {referencia.cuotas ? (
            <div className="cmv2-hist-cuota-lectura">
              <span className="cmv2-eyebrow">Cómo se llenó la cuota</span>
              <ul>
                <li data-sexo="mujer">
                  <strong>{pct(referencia.cuotas.cumplimiento_mujeres, 0)}</strong>
                  <span>
                    de la cuota de mujeres · {fmtInt(referencia.cuotas.logradas_mujeres ?? 0)} de{" "}
                    {fmtInt(referencia.cuotas.cuota_mujeres ?? 0)}
                  </span>
                </li>
                <li data-sexo="hombre">
                  <strong>{pct(referencia.cuotas.cumplimiento_hombres, 0)}</strong>
                  <span>
                    de la cuota de hombres · {fmtInt(referencia.cuotas.logradas_hombres ?? 0)} de{" "}
                    {fmtInt(referencia.cuotas.cuota_hombres ?? 0)}
                  </span>
                </li>
              </ul>
              {(() => {
                const cortas = referencia.cuotas.filas.filter(
                  (f) => f.aulas > 0 && ((f.cumplimiento_hombres ?? 1) < 1 || (f.cumplimiento_mujeres ?? 1) < 1),
                );
                if (!cortas.length) return null;
                return (
                  <p>
                    {cortas.length === 1 ? "Una facultad se quedó corta" : `${cortas.length} facultades se quedaron cortas`}
                    :{" "}
                    {cortas
                      .map((f) => {
                        const lado = (f.cumplimiento_hombres ?? 1) < 1 ? "hombres" : "mujeres";
                        const valor = lado === "hombres" ? f.cumplimiento_hombres : f.cumplimiento_mujeres;
                        return `${f.facultad} (${lado}, ${pct(valor, 0)})`;
                      })
                      .join(" · ")}
                    . Es lo que obliga a ponderar: sin peso, esas personas
                    quedarían subrepresentadas en el análisis.
                  </p>
                );
              })()}
            </div>
          ) : null}

          {/* Las decisiones que no son cifras: cómo se repartió, cómo se
              eligió, cómo se ajustó al final. */}
          <dl className="cmv2-hist-decisiones">
            <div>
              <dt>Cómo se repartió</dt>
              <dd>{diseno.afijacion || "No declarado"}</dd>
            </div>
            <div>
              <dt>Cómo se eligieron las aulas</dt>
              <dd>{diseno.metodo_seleccion || "No declarado"}</dd>
            </div>
            <div>
              <dt>Cómo se ajustó al final</dt>
              <dd>{diseno.metodo_ajuste || "No declarado"}</dd>
            </div>
            <div>
              <dt>Ponderación</dt>
              <dd>
                {diseno.ponderado === null
                  ? "No declarado"
                  : diseno.ponderado
                    ? diseno.ponderacion_alcance || "Sí se aplicó"
                    : "No hizo falta"}
              </dd>
            </div>
            {diseno.aulas_marco !== null ? (
              <div>
                <dt>Marco disponible</dt>
                <dd>{fmtInt(diseno.aulas_marco)} cursos-horario elegibles</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {vistaActiva === "diseno" && filtros.length > 0 ? (
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
