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
import { fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import { CifraFila, CifraMotor } from "../ui";
import {
  certezaEstratosDesdeResultado,
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

function FilaCerteza({ fila }: { fila: CertezaFilaVista }) {
  const texto = ESTADO_TEXTO[fila.estado];
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
      <td className="cmv2-certeza-prob" data-bajo={
        typeof fila.probabilidad_formula === "number" && fila.probabilidad_formula < 0.95 ? "" : undefined
      }>
        {fmtPct(fila.probabilidad_formula)}
      </td>
      <td className="cmv2-certeza-minimo">
        <strong>{fila.aulas_certeza == null ? "—" : fmtInt(fila.aulas_certeza)}</strong>
      </td>
      <td className="cmv2-certeza-brecha">{fmtBrecha(fila.brecha)}</td>
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
}: {
  filasResultado: readonly CalcMuestraAulasEstrato[];
  vista: CertezaVista | null;
  busy: boolean;
  onMedir: (payload: {
    estratos: ReturnType<typeof certezaEstratosDesdeResultado>;
    nivel: number;
  }) => void | Promise<void>;
  marcoDesactualizado?: boolean;
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
          <strong>¿Alcanza?</strong>
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
            <CifraMotor
              label={`Titulares para ${PCT.format(nivelMostrado)}`}
              value={fmtInt(vista.aulasCerteza)}
              detalle="mínimo que sostiene el nivel"
              origen="motor"
              hero
            />
            <CifraMotor
              label="Diferencia"
              value={fmtBrecha(vista.brecha)}
              detalle={vista.brecha > 0 ? "aulas que faltan" : vista.brecha < 0 ? "aulas que sobran" : "sin cambios"}
              origen="motor"
              tono={vista.brecha > 0 ? "alerta" : "ok"}
            />
          </CifraFila>

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
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {vista.filas.map((fila) => (
                  <FilaCerteza key={fila.key} fila={fila} />
                ))}
              </tbody>
            </table>
          </div>

          <footer className="cmv2-certeza-pie">
            <p>
              <Info size={12} aria-hidden="true" /> Cada facultad se simuló{" "}
              {fmtInt(vista.certeza.corridas_solicitadas)} veces por candidato, sorteando con el
              mismo método que la selección real y contando estudiantes distintos (dos aulas que
              comparten alumnos no suman dos veces). El rendimiento τ de cada facultad se aplica
              antes de comparar contra la cuota.
            </p>
            <p>
              Lo que esto <strong>no</strong> mide: la incertidumbre del propio τ. Acá entra como
              valor conocido; su intervalo lo publica la referencia histórica de asistencia.
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
