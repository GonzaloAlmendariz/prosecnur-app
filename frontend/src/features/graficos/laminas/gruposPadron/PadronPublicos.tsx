// El padrón de cada público de una lámina de resumen (ADR 0135 §6): contraste entre bases, fortalezas y cobertura. Por
// público, su padrón con «Padrón confiable» y la PROPUESTA de Cálculo de muestra o Monitoreo con su origen y «Usar»
// (o «Usar todos»): nada se escribe hasta que el analista la usa. En la cobertura además se elige qué públicos entran,
// la meta de cada uno (porcentaje del padrón o casos) y las filas extra. La lógica vive en modeloPadron.ts.

import { useId } from "react";
import { Panel } from "../../../../components/Panel";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { PadronPropuesto } from "../../../../api/graficosPadron";
import { useVariables } from "../../useVariables";
import { AyudaGlobo } from "../AyudaGlobo";
import { FilaPadron } from "./FilaPadron";
import { FilasExtra } from "./FilasExtra";
import { MetaPublico } from "./MetaPublico";
import {
  alternarPublico, conMeta, conPadron, conPropuesta, metaDe, nombrePublico, padronDe, propuestaDe, propuestaEnUso,
  propuestaUtil, publicoIncluido, publicosDe, ultimoPublico,
} from "./modeloPadron";
import { propuestasDe, usePadronPropuesto } from "./usePadronPropuesto";
import { useGuardaNoConfiables } from "./useGuardaNoConfiables";
import { DeclararPadron } from "./DeclararPadron";
import { faltaPadron } from "./dondeDeclarar";
import "./gruposPadron.css";

type Props = {
  graficador: string;
  args: Readonly<Record<string, unknown>>;
  scope: "active" | "consolidated";
  onCambio: (patch: Record<string, unknown>) => void;
};

const AYUDA_PUBLICOS = "Con padrón confiable la base sale como n (cobertura %); sin él, sólo n. El padrón propuesto se escribe al usarlo.";

const textoPropuesta = (p: PadronPropuesto, conMetas: boolean): string => {
  const piezas = [p.padron !== null ? `padrón ${formatoConteo(p.padron)}` : null,
    conMetas && p.meta !== null ? `meta ${p.meta_unidad === "porcentaje" ? `${p.meta}%` : formatoConteo(p.meta)}` : null];
  return `Propuesta: ${piezas.filter(Boolean).join(", ")}`;
};

const origenPropuesta = (p: PadronPropuesto, conMetas: boolean): string =>
  [p.padron !== null ? p.padron_origen : "", conMetas && p.meta !== null ? p.meta_origen : ""].filter(Boolean).join(". ");

export function PadronPublicos({ graficador, args, scope, onCambio }: Props) {
  const id = useId();
  const { sources } = useVariables();
  const cobertura = graficador === "p_cobertura";
  const guarda = useGuardaNoConfiables(graficador);
  const todas = sources.map((s) => s.name);
  const bases = publicosDe(graficador, args, todas);
  const propuesta = usePadronPropuesto(scope, bases.length > 0);
  const propuestas = propuestasDe(propuesta);
  const pendientes = bases.filter((b) => {
    const p = propuestaDe(propuestas, b);
    return publicoIncluido(args, b) && propuestaUtil(p, cobertura) && !propuestaEnUso(args, b, p, cobertura);
  });
  const rotulo = bases.length === 1 ? "Público" : "Públicos";
  // X5: con la propuesta ya leída, un público sin padrón (ni escrito ni propuesto) dice dónde declararlo.
  const sinPadron = propuesta.fase === "lista" && faltaPadron(bases.map((b) => ({
    incluido: !cobertura || publicoIncluido(args, b), escrito: padronDe(args, nombrePublico(b)).valor, propuesta: propuestaDe(propuestas, b),
  })));

  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-publicos" data-campo="universos"
      data-qa-geometry-group="graficos/f6-padron-publicos" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-grupos-cabeza">
        <span className="pulso-f6-dato-rotulo" id={`${id}-rotulo`}>
          {rotulo}
          <AyudaGlobo id={`${id}-ayuda`} rotulo={rotulo} detalle={AYUDA_PUBLICOS} />
        </span>
        {pendientes.length > 1 && (
          <button type="button" className="pulso-f6-boton pulso-f6-dato-accion"
            onClick={() => onCambio(conPropuesta(args, propuestas, pendientes, cobertura, guarda))}>
            Usar todos
          </button>
        )}
      </div>
      {bases.length === 0 ? (
        <p className="pulso-f6-dato-ayuda" role="note">Elige primero las preguntas: de ellas salen los públicos.</p>
      ) : (
        <Panel variant="subtle" noPadding className="pulso-f6-grupos-lista" data-qa-geometry-member>
          <ul className="pulso-f6-grupos-filas" data-qa-scroll-owner="padron-publicos" aria-labelledby={`${id}-rotulo`}>
            {bases.map((b) => {
              const nombre = nombrePublico(b);
              const incluido = !cobertura || publicoIncluido(args, b);
              const p = propuestaDe(propuestas, b);
              const motivo = p?.motivo ?? "";
              const util = propuestaUtil(p, cobertura);
              return (
                <li key={b} className={incluido ? "pulso-f6-grupos-fila is-incluido" : "pulso-f6-grupos-fila"}>
                  {cobertura ? (
                    <PulsoSwitch size="sm" label={nombre} checked={incluido} disabled={incluido && ultimoPublico(args, todas, b)}
                      onCheckedChange={(v) => onCambio(alternarPublico(args, todas, b, v))} />
                  ) : (
                    <span className="pulso-f6-publicos-nombre">{nombre}</span>
                  )}
                  {incluido && (
                    <>
                      <FilaPadron nombre={nombre} padron={padronDe(args, nombre)}
                        onCambio={(pad) => onCambio(conPadron(args, nombre, pad, guarda))} />
                      {cobertura && (
                        <MetaPublico nombre={nombre} meta={metaDe(args, nombre)} onCambio={(m) => onCambio(conMeta(args, nombre, m))} />
                      )}
                      {util && (
                        <div className="pulso-f6-publicos-propuesta">
                          <span className="pulso-f6-dato-ayuda is-nota">
                            {textoPropuesta(p, cobertura)}
                            <AyudaGlobo rotulo={`Propuesta de ${nombre}`} detalle={origenPropuesta(p, cobertura)} />
                          </span>
                          {propuestaEnUso(args, b, p, cobertura) ? (
                            <span className="pulso-f6-dato-ayuda">En uso</span>
                          ) : (
                            <button type="button" className="pulso-f6-boton" aria-label={`Usar la propuesta de ${nombre}`}
                              onClick={() => onCambio(conPropuesta(args, propuestas, [b], cobertura, guarda))}>
                              Usar
                            </button>
                          )}
                        </div>
                      )}
                      {!util && motivo && (
                        <span className="pulso-f6-dato-ayuda">
                          Sin propuesta
                          <AyudaGlobo rotulo={`Sin propuesta para ${nombre}`} detalle={motivo} />
                        </span>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      {sinPadron && <DeclararPadron />}
      {propuesta.fase === "error" && (
        <p className="pulso-f6-dato-ayuda is-aviso" role="note">No se pudo leer la propuesta de padrón: {propuesta.mensaje}</p>
      )}
      {cobertura && <FilasExtra args={args} onCambio={onCambio} />}
    </div>
  );
}
