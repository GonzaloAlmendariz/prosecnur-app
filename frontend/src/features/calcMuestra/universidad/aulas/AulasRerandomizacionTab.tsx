/**
 * «¿Este sorteo o otro?» — la última pestaña de Selección (ADR 0082).
 *
 * Va la última porque es la última decisión antes de fijar la muestra: con el
 * criterio ya declarado, lo que queda por resolver es si el sorteo que salió
 * sirve o hay que pedir otro.
 *
 * La pantalla existe para separar dos cosas que producen muestras idénticas a
 * la vista y no lo son. Sortear cien veces y quedarse con la mejor es
 * **optimizar**: las probabilidades finales dejan de ser calculables, y el motor
 * ya lo advierte para `pool_controlado`. Rerandomizar es **aceptar o rechazar
 * contra un criterio fijado antes de mirar los resultados**, y entonces lo que
 * sale sigue siendo un diseño sobre el que se puede razonar.
 */
import { Shuffle, TriangleAlert } from "../../../../vendor/lucide-react";
import { PulsoField, PulsoFieldRow } from "../../../../components/PulsoField";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import type { CalcMuestraAulasSelection, CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import { ExplicacionBloque, ExplicacionPlegable } from "../ui";
import { veredictoRerandomizacion } from "./rerandomizacionVeredicto";
import "./rerandomizacion.css";

const pct = (v: number | null | undefined, d = 1) =>
  typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(d)} %` : "—";
const num = (v: number | null | undefined, d = 3) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—";

export function AulasRerandomizacionTab({
  config,
  selection,
  onConfig,
}: {
  config: CalcMuestraWorkspaceAulasConfig;
  selection: CalcMuestraAulasSelection | null;
  onConfig?: (patch: Partial<CalcMuestraWorkspaceAulasConfig>) => void;
}) {
  const rr = config.rerandomizacion;
  const criterio = rr?.criterio ?? null;
  const corrida = selection?.rerandomizacion ?? null;
  const agotado = corrida?.aplicada === true && corrida.agotado === true;
  const veredicto = veredictoRerandomizacion(corrida, { activa: rr?.activa === true, hayCriterio: criterio != null });

  const cambiar = (patch: Partial<NonNullable<CalcMuestraWorkspaceAulasConfig["rerandomizacion"]>>) => {
    if (!onConfig || !rr) return;
    onConfig({ rerandomizacion: { ...rr, ...patch } });
  };

  return (
    <div
      className="cmv2-aulas-stack"
      data-qa-geometry-group="calc-muestra/aulas-rerandomizacion"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="cmv2-panel cmv2-rr-veredicto" data-qa-geometry-member>
        <div className="cmv2-subhead">
          <strong>Qué pasó en la última corrida</strong>
          <small>la evidencia, no sólo el resultado</small>
        </div>
        {/* El ADR lo hace obligatorio: entregar el mejor fingiendo que pasó es
            lo que convierte esto en optimización disfrazada. Por eso el
            agotamiento es el veredicto, no una nota al pie. */}
        <AvisoModulo
          tone={veredicto.tono}
          icon={agotado ? TriangleAlert : undefined}
          role={agotado ? "alert" : "status"}
        >
          {veredicto.titulo}
          {agotado && corrida ? (
            <>
              {" "}Cobertura mínima {num(corrida.cobertura_minima)}. O se sube el tope, o el criterio pide
              más de lo que el marco puede dar.
            </>
          ) : null}
        </AvisoModulo>
        {corrida?.aplicada ? (
          <>
            <dl className="cmv2-rr-cifras">
              <div><dt>Sorteos hechos</dt><dd>{fmtInt(corrida.sorteos)}</dd></div>
              <div><dt>Pasaron el criterio</dt><dd>{fmtInt(corrida.aceptados)}</dd></div>
              <div>
                <dt>Tasa de aceptación</dt>
                <dd>{pct(corrida.tasa_aceptacion)}</dd>
              </div>
              <div><dt>Cobertura mínima</dt><dd>{num(corrida.cobertura_minima)}</dd></div>
            </dl>
            {/* La tasa no es telemetría: es lo que dice si el criterio es sensato. */}
            <small className="cmv2-rr-nota">
              La tasa de aceptación es parte del diseño, no una estadística de proceso: una
              tasa alta dice que el criterio se cumple casi solo; una muy baja, que pide
              más de lo que el marco da y que lo que hay que revisar es el diseño, no
              seguir sorteando.
            </small>
          </>
        ) : rr?.activa !== true ? (
          <small className="cmv2-rr-nota">
            Es el comportamiento de siempre y no tiene nada de malo; sólo que entonces no hay
            tasa de aceptación que reportar.
          </small>
        ) : null}
      </section>

      {!criterio ? (
        <section className="cmv2-panel" data-qa-geometry-member>
          <AvisoModulo tone="warn" role="status">
            Todavía no hay criterio que aplicar. Se arma solo con la cuota y la tasa de
            efectividad de cada facultad más el reparto por sexo del marco: completa el
            cálculo por facultad y vuelve.
          </AvisoModulo>
        </section>
      ) : (
        <section className="cmv2-panel" data-qa-geometry-member>
          <div className="cmv2-subhead">
            <strong>El criterio</strong>
            <small>declarado antes de sortear, y guardado con el proyecto</small>
          </div>
          <p className="cmv2-rr-criterio">
            Toda celda facultad × sexo alcanza al menos el{" "}
            <b>{pct(criterio.umbral, 0)}</b> de su cuota.{" "}
            Son <b>{fmtInt(criterio.celdas.length * 2)}</b> celdas de{" "}
            <b>{fmtInt(criterio.celdas.length)}</b> facultades.
          </p>
          {/* K1 (L27): el interruptor es el switch del kit y el tope, un campo
              numérico del kit en línea; la fila declara su grupo (C1). */}
          <PulsoFieldRow className="cmv2-rr-controles" geometryGroup="aulas-rerandomizacion-controles">
            <PulsoSwitch
              className="cmv2-rr-switch"
              label={<><Shuffle size={13} aria-hidden="true" /> Rerandomizar al sortear</>}
              ariaLabel="Rerandomizar al sortear"
              checked={rr?.activa === true}
              disabled={!onConfig}
              onCheckedChange={(activa) => cambiar({ activa })}
            />
            <PulsoField label="Tope de sorteos" inline className="is-compact">
              <PulsoInput
                type="number" min={1} max={1000} size="sm" numeric
                value={rr?.tope ?? 50}
                disabled={!onConfig || rr?.activa !== true}
                onChange={(e) => cambiar({ tope: Number(e.target.value) || 1 })}
              />
            </PulsoField>
          </PulsoFieldRow>
          <small className="cmv2-rr-nota">
            Con el interruptor apagado el sorteo se comporta como siempre: sale el primero
            y no se rechaza ninguno. Encenderlo cambia el diseño, y por eso es una decisión
            y no un ajuste.
          </small>
        </section>
      )}


      {/* Abierta: en aulas no se pliega nada (ADR 0057). Va después del
          veredicto y del criterio, y reparte sus bloques en el ancho. */}
      <ExplicacionPlegable
        titulo="Sortear una vez, o sortear hasta que sirva"
        resumen="y por qué no es lo mismo que quedarse con el mejor"
        defaultOpen
      >
        <ExplicacionBloque titulo="Por qué hace falta">
          <p>
            Un sorteo balanceado no garantiza que <b>todas</b> las celdas de facultad × sexo
            alcancen su cuota. En el diseño de 2026 sólo la mitad de los sorteos las cerraba,
            así que la muestra que se usó no fue la primera: fue una elegida entre cincuenta.
          </p>
        </ExplicacionBloque>
        <ExplicacionBloque titulo="Rerandomizar no es optimizar">
          <p>
            Eso se puede hacer de dos maneras que se ven iguales y no lo son.{" "}
            <b>Quedarse con la mejor de cien</b> es optimizar: las probabilidades de que cada
            aula entrara dejan de poder calcularse. <b>Aceptar o rechazar contra un criterio
            fijado antes de sortear</b> es otra cosa: el conjunto de muestras aceptables no
            depende del sorteo, así que lo que sale sigue siendo un diseño.
          </p>
          <p>
            Esta pantalla hace lo segundo. Lo primero sigue disponible como motor
            «pool controlado», con su advertencia.
          </p>
        </ExplicacionBloque>
      </ExplicacionPlegable>
    </div>
  );
}
