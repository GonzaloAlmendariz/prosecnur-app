/**
 * Panel "¿Alcanza?" — certeza de cobertura por facultad.
 *
 * Responde una pregunta que la tabla de cursos-horario requeridos no responde:
 * el número que publica la fórmula, ¿alcanza la cuota, o alcanza sólo en
 * promedio? La respuesta viene de R (Monte Carlo del sorteo real); acá se
 * presenta y se explica.
 */
import { useState } from "react";
import { Info, Shuffle } from "../../../../vendor/lucide-react";
import type { CalcMuestraAulasEstrato } from "../../../../api/client";
import { fmtDec, fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import { CifraFila, CifraMotor } from "../ui";
import {
  certezaEstratosDesdeResultado,
  curvaResumen,
  precisionVeredicto,
  type CertezaEstado,
  type CertezaFilaVista,
  type CertezaVista,
} from "./certezaCoberturaModel";
import "./certezaCobertura.css";

const PCT = new Intl.NumberFormat("es-PE", {
  style: "percent",
  maximumFractionDigits: 0,
});

const NIVELES = [0.9, 0.95, 0.99] as const;

const ESTADO_TEXTO: Record<CertezaEstado, { etiqueta: string; detalle: string }> = {
  agotado: {
    etiqueta: "Marco agotado",
    detalle: "Ni visitando todas sus aulas se llega. Pedir más aulas no lo arregla: hay que revisar criterios o cuota.",
  },
  corta: {
    etiqueta: "Faltan aulas",
    detalle: "La fórmula pide menos de las necesarias para el nivel exigido.",
  },
  sobra: {
    etiqueta: "Sobran aulas",
    detalle: "El nivel exigido se alcanza con menos aulas de las que pide la fórmula.",
  },
  ajustada: {
    etiqueta: "Ajustada",
    detalle: "La fórmula ya da el mínimo exacto para el nivel exigido.",
  },
  sin_datos: {
    etiqueta: "Sin medir",
    detalle: "El estrato no tiene aulas en el marco o la búsqueda no pudo completarse.",
  },
};

function fmtPct(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? PCT.format(value) : "—";
}

function fmtBrecha(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value === 0) return "=";
  return value > 0 ? `+${fmtInt(value)}` : fmtInt(value);
}

function fmtRendimiento(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? fmtDec(value, 1) : "—";
}

/**
 * La curva de la que sale el número certificado, en el ancho de una celda.
 *
 * El panel publicaba sólo el resultado, y con eso una certificación degenerada
 * era invisible: el motor devolvía 392,7 con 40 aulas y 394,6 con 55 y en
 * pantalla se veía una cifra sola, perfectamente creíble. Dibujar la curva
 * convierte ese caso en algo que se nota sin leer el API.
 */
function CurvaCerteza({ fila }: { fila: CertezaFilaVista }) {
  const { puntos, plana } = curvaResumen(fila.curva);
  if (puntos.length < 2) return <td className="cmv2-certeza-curva">—</td>;
  const rends = puntos.map((p) => p.rendimiento_medio);
  const min = Math.min(...rends);
  const max = Math.max(...rends);
  const rango = max - min || 1;
  const linea = puntos
    .map((p, i) => {
      const x = (i / (puntos.length - 1)) * 46;
      const y = 14 - ((p.rendimiento_medio - min) / rango) * 12;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const titulo = plana
    ? `El rendimiento no crece al sumar aulas (${puntos[0]!.aulas} → ${puntos[puntos.length - 1]!.aulas}): la corrida no está evaluando el número que declara.`
    : puntos.map((p) => `${p.aulas} aulas: ${Math.round(p.rendimiento_medio)}`).join(" · ");
  return (
    <td className="cmv2-certeza-curva" data-plana={plana ? "" : undefined}>
      <svg viewBox="0 0 46 16" role="img" aria-label={titulo}>
        <title>{titulo}</title>
        <polyline points={linea} />
      </svg>
      {plana && <small>plana</small>}
    </td>
  );
}

function FilaCerteza({ fila, nivel, onFijarAulas }: {
  fila: CertezaFilaVista;
  nivel: number;
  onFijarAulas?: (facultad: string, aulas: number) => void;
}) {
  const texto = ESTADO_TEXTO[fila.estado];
  // Marcar «probabilidad baja» contra un 0,95 escrito a mano decía que el nivel
  // es 95% pase lo que pase, y el nivel lo declara el estudio: la cabecera ya
  // muestra «Titulares para 90%» mientras la columna seguía midiendo contra 95.
  // Con un nivel exigido más alto, filas que NO lo alcanzan salían sin marcar.
  const precision = precisionVeredicto(fila, nivel);
  const bajo = typeof fila.probabilidad_formula === "number"
    && Number.isFinite(nivel) && nivel > 0
    && fila.probabilidad_formula < nivel;
  return (
    <tr data-estado={fila.estado}>
      <td>
        <strong>{fila.label}</strong>
        {fila.cotaSuperior && (
          <small className="cmv2-certeza-cota" title="El marco no trae padrones: el rendimiento es una cota superior, no una medición.">
            cota superior
          </small>
        )}
      </td>
      <td>{fmtInt(fila.cuota)}</td>
      <td>{fmtInt(fila.disponibles)}</td>
      <td>{fmtInt(fila.aulas_formula)}</td>
      <td className="cmv2-certeza-prob" data-bajo={bajo ? "" : undefined}>
        {fmtPct(fila.probabilidad_formula)}
      </td>
      <td className="cmv2-certeza-minimo">
        <strong>{fila.aulas_certeza == null ? "—" : fmtInt(fila.aulas_certeza)}</strong>
        {/* Con cuántos sorteos se decidió. El motor los recorta en los marcos
            grandes, así que las facultades de mayor cuota son las que menos
            evidencia reciben, y sin este dato el veredicto se lee como si
            todos valieran lo mismo.

            El aviso de riesgo mide si el ruido puede mover EL MÍNIMO, no si la
            probabilidad está lejos del umbral: lo que decide es si el candidato
            anterior alcanza el nivel, y ese hueco suele ser enorme. Medirlo
            como margen sobre el umbral marcaba tres facultades de HSVG2026
            como ambiguas cuando sus veredictos aguantaban 21, 13 y 3 errores
            estándar. */}
        {precision.corridas != null && (
          <small
            className="cmv2-certeza-corridas"
            data-ruido={precision.dentroDelRuido ? "" : undefined}
            title={
              precision.dentroDelRuido
                ? `Decidido con ${precision.corridas} sorteos, y el veredicto es frágil: a ${fila.aulas_certeza! - 1} aulas le falta sólo ${(precision.distancia * 100).toFixed(2)} puntos para alcanzar el nivel, que son ${precision.erroresHastaVoltear!.toFixed(1)} veces el error de muestreo (±${(precision.error * 100).toFixed(2)}). Otra corrida podría dejar el mínimo en ${fila.aulas_certeza! - 1}.`
                : precision.erroresHastaVoltear == null
                  ? `Decidido con ${precision.corridas} sorteos`
                  : `Decidido con ${precision.corridas} sorteos · el veredicto aguanta: a ${fila.aulas_certeza! - 1} aulas le faltan ${(precision.distancia * 100).toFixed(1)} puntos para el nivel, ${precision.erroresHastaVoltear.toFixed(1)} veces el error de muestreo`
            }
          >
            {fmtInt(precision.corridas)} sorteos
            {precision.dentroDelRuido && " · veredicto frágil"}
          </small>
        )}
      </td>
      <td className="cmv2-certeza-brecha">
        {fmtBrecha(fila.brecha)}
        {/* La accion donde aparece el hallazgo: sin esto, aplicar lo que dice
            esta fila obliga a cruzar a Aulas · Seleccion y pulsar el stepper
            de ±1 tantas veces como diga la diferencia. */}
        {onFijarAulas != null && fila.aulas_certeza != null && (fila.brecha ?? 0) > 0 && (
          <button
            type="button"
            className="cmv2-certeza-fijar"
            onClick={() => onFijarAulas(fila.label, fila.aulas_certeza as number)}
            title={`Fija ${fila.label} en ${fila.aulas_certeza} titulares, el mínimo que alcanza el nivel exigido. Invalida la selección vigente: hay que volver a sortear.`}
          >
            Llevar a {fmtInt(fila.aulas_certeza)}
          </button>
        )}
      </td>
      {/* El motor simulaba el rendimiento y publicaba las dos cifras; ninguna
          pantalla las mostraba. El P05 es el que decide si la cuota aguanta un
          mal día: la media puede alcanzar y el peor 5% quedarse corto. */}
      <td className="cmv2-certeza-rendimiento">
        <strong>{fmtRendimiento(fila.rendimiento_medio)}</strong>
        <small>P05 {fmtRendimiento(fila.rendimiento_p05)}</small>
      </td>
      <CurvaCerteza fila={fila} />
      <td>
        <span className="cmv2-certeza-chip" data-estado={fila.estado} title={texto.detalle}>
          {texto.etiqueta}
        </span>
      </td>
    </tr>
  );
}

export function CertezaCoberturaPanel({
  filasResultado,
  vista,
  busy,
  onMedir,
  marcoDesactualizado = false,
  onFijarAulas,
  onFijarTodas,
}: {
  filasResultado: readonly CalcMuestraAulasEstrato[];
  vista: CertezaVista | null;
  busy: boolean;
  onMedir: (payload: {
    estratos: ReturnType<typeof certezaEstratosDesdeResultado>;
    nivel: number;
  }) => void | Promise<void>;
  marcoDesactualizado?: boolean;
  /** Aplica el minimo certificado a una facultad sin salir de este panel. */
  onFijarAulas?: (facultad: string, aulas: number) => void;
  /** Aplica de una vez el minimo de TODAS las facultades que se quedan cortas. */
  onFijarTodas?: () => void;
}) {
  const [nivel, setNivel] = useState<number>(0.95);
  const estratos = certezaEstratosDesdeResultado(filasResultado);
  const puedeMedir = estratos.length > 0 && !busy && !marcoDesactualizado;
  const nivelMostrado = vista ? vista.nivelPct : nivel;

  return (
    <section
      className="cmv2-panel cmv2-certeza-panel"
      aria-label="Certeza de cobertura"
      data-qa-geometry-group="calc-muestra/certeza-cobertura"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="cmv2-panel-head" data-qa-geometry-member>
        <div>
          {/* Gonzalo, 2026-08-21: «tampoco entiendo la finalidad de "alcanza".
              ¿A qué te refieres con alcanza?». El título preguntaba sin decir
              qué se pregunta: la respuesta estaba en el párrafo de abajo y el
              rótulo, solo, no significaba nada. */}
          <strong>¿Esas aulas alcanzan la cuota de cada facultad?</strong>
          {/* La explicación es el contenido, no una nota al pie: sin ella el
              usuario no tiene forma de saber por qué dos números distintos
              responden la misma pregunta. */}
          <p className="cmv2-certeza-explicacion">
            La tabla de arriba divide la cuota entre el tamaño típico de un aula. Esa cuenta apunta
            al centro: dice cuántas aulas harían falta si cada una rindiera lo normal. Pero el
            sorteo se hace una sola vez, las aulas no son todas iguales y los estudiantes se repiten
            entre ellas. Acá se simula el sorteo real muchas veces y se cuenta en cuántas se llegó
            a la cuota.
          </p>
        </div>
        <div className="cmv2-certeza-acciones">
          <div className="cmv2-segment" role="radiogroup" aria-label="Nivel de certeza exigido">
            {NIVELES.map((valor) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={nivel === valor}
                data-active={nivel === valor || undefined}
                onClick={() => setNivel(valor)}
              >
                {PCT.format(valor)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="cmv2-primary"
            disabled={!puedeMedir}
            onClick={() => void onMedir({ estratos, nivel })}
          >
            <Shuffle size={13} aria-hidden="true" />
            {busy ? "Simulando…" : vista ? "Volver a medir" : "Medir certeza"}
          </button>
        </div>
      </div>

      {marcoDesactualizado && (
        <AvisoModulo tone="warn" role="status">
          El marco cambió después del cálculo. Recalcula la propuesta antes de medir la certeza:
          simular sobre un marco que ya no existe da un número que no describe nada.
        </AvisoModulo>
      )}

      {!vista ? (
        <p className="cmv2-certeza-vacio" role="status">
          {estratos.length === 0
            ? "Sin facultades con cuota publicada: recalcula la propuesta para poder medir."
            : `Sin medir todavía. La simulación responde cuántas aulas hacen falta para que la cuota se alcance en al menos ${PCT.format(nivel)} de los sorteos posibles.`}
        </p>
      ) : (
        <>
          {!vista.vigente && (
            <AvisoModulo tone="warn" role="status">
              Esta medición se hizo sobre otro marco. Vuelve a medir para que el resultado
              corresponda al marco vigente.
            </AvisoModulo>
          )}

          <CifraFila>
            <CifraMotor
              label="Titulares por la fórmula"
              value={fmtInt(vista.aulasFormula)}
              detalle="lo que pide la división"
              origen="motor"
            />
            {/*
              El total que se muestra es el de SUBIR donde falta sin bajar donde
              sobra, porque es el que el diseño va a tomar: la regla de la casa
              es «no bajes ninguna, solo sube donde haga falta».

              El neto de R decía 167 en HSVG 2026 —165 más dos— mientras seis
              facultades pedían +8 y tres pedían −6. Nadie iba a quitarle tres
              aulas a Ciencias e Ingeniería, así que el encabezado prometía un
              total que el estudio nunca iba a usar. Con la regla, 173.
            */}
            <CifraMotor
              label={`Titulares para ${PCT.format(nivelMostrado)}`}
              value={fmtInt(vista.aulasSoloSubidas)}
              detalle="subiendo donde falta, sin bajar donde sobra"
              origen="motor"
              hero
            />
            <CifraMotor
              label="Diferencia"
              value={fmtBrecha(vista.brechaSoloSubidas)}
              detalle={vista.brechaSoloSubidas > 0 ? "aulas que faltan" : "sin cambios"}
              origen="motor"
              tono={vista.brechaSoloSubidas > 0 ? "alerta" : "ok"}
            />
          </CifraFila>

          {/*
            El neto no desaparece porque no lo usemos: se dice. Sin esta línea
            el encabezado y el total que publica el motor difieren y nadie
            puede saber por qué.
          */}
          {vista.aulasQueNoSeBajan > 0 && (
            <p className="cmv2-certeza-neto">
              El motor calcula <strong>{fmtInt(vista.aulasCerteza)}</strong> compensando
              con {fmtInt(vista.aulasQueNoSeBajan)} {vista.aulasQueNoSeBajan === 1 ? "aula" : "aulas"} que
              daría por sobrantes. No se bajan.
            </p>
          )}

          {vista.criticos.length > 0 ? (
            <AvisoModulo
              tone="warn"
              role="status"
              title={
                vista.criticos.length === 1
                  ? "Una facultad no llega con lo que pide la fórmula"
                  : `${fmtInt(vista.criticos.length)} facultades no llegan con lo que pide la fórmula`
              }
            >
              {vista.criticos.map((fila) => fila.label).join(", ")}.
              {/*
                Las que faltan se aplican juntas porque la certeza las midió
                juntas y sus mínimos son independientes: el de Derecho no cambia
                porque se fije Psicología. De a una obligaba a fijar, recalcular
                y volver a medir una vez por facultad — al fijar la primera el
                resultado del componente se invalida y esta pantalla se queda
                sin nada sobre lo que medir.
              */}
              {onFijarTodas != null && vista.brechaSoloSubidas > 0 && (
                <p className="cmv2-certeza-aplicar">
                  <button type="button" className="cmv2-btn" onClick={onFijarTodas}>
                    {vista.criticos.length === 1
                      ? "Llevar esa facultad a su mínimo"
                      : `Llevar las ${fmtInt(vista.criticos.length)} a su mínimo`}
                  </button>
                  <span>
                    Suma {fmtInt(vista.brechaSoloSubidas)}{" "}
                    {vista.brechaSoloSubidas === 1 ? "aula" : "aulas"} y deja el diseño
                    en <strong>{fmtInt(vista.aulasSoloSubidas)}</strong> titulares. Hay que
                    volver a sortear.
                  </span>
                </p>
              )}
            </AvisoModulo>
          ) : (
            <AvisoModulo tone="success" role="status">
              Todas las facultades alcanzan su cuota en al menos {PCT.format(nivelMostrado)} de los
              sorteos con las aulas dimensionadas.
            </AvisoModulo>
          )}

          <div
            className="cmv2-table-wrap"
            tabIndex={0}
            aria-label="Certeza de cobertura por facultad"
            data-qa-geometry-capacity="owned"
          >
            <table className="cmv2-table cmv2-table--university cmv2-certeza-tabla">
              <thead>
                <tr>
                  <th>Facultad</th>
                  <th>Cuota</th>
                  <th title="Cursos-horario elegibles del marco en esa facultad">Aulas del marco</th>
                  <th>Titulares (fórmula)</th>
                  <th title="Proporción de sorteos simulados en los que ese número alcanza la cuota">
                    Alcanza en
                  </th>
                  <th>Titulares para {PCT.format(nivelMostrado)}</th>
                  <th>Dif.</th>
                  <th title="Alumnos que rinde un aula en la simulación: la media arriba, y debajo el percentil 5 —el peor escenario razonable—.">
                    Alumnos por aula
                  </th>
                  <th title="Cómo crece el rendimiento a medida que se suman aulas. Una curva plana significa que la corrida no está evaluando el número que declara.">
                    Curva
                  </th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {vista.filas.map((fila) => (
                  <FilaCerteza key={fila.key} fila={fila} nivel={nivelMostrado} onFijarAulas={onFijarAulas} />
                ))}
              </tbody>
            </table>
          </div>

          <footer className="cmv2-certeza-pie">
            <p>
              <Info size={12} aria-hidden="true" /> Cada facultad se simuló{" "}
              {fmtInt(vista.certeza.corridas_solicitadas)} veces por candidato, sorteando con el
              mismo método que la selección real y contando estudiantes distintos (dos aulas que
              comparten alumnos no suman dos veces). La tasa de efectividad de cada facultad se
              aplica antes de comparar contra la cuota.
            </p>
            <p>
              Lo que esto <strong>no</strong> mide: la incertidumbre de la propia tasa de
              efectividad. Acá entra como valor conocido; su base (k) y su derivación se declaran
              en la tarjeta de la tasa por facultad, arriba.
            </p>
            {vista.hayCotaSuperior && (
              <p>
                Algunas facultades vienen marcadas como <strong>cota superior</strong>: su marco no
                trae padrones de estudiantes, así que no se puede descontar el traslape entre aulas
                y el rendimiento mostrado es el mejor caso posible.
              </p>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
