// Grupos internos de las aperturas (p_dumbbell estilo resumen con cruce; ADR 0135 §6, maqueta graficos-sintesis, Grupos,
// columna izquierda). Va en Datos, debajo de «Dividir por» (BrechaEntreGrupos): un interruptor por grupo del cruce para
// incluirlo (hasta cuatro, «3 de 4»), su padrón con «Padrón confiable», el aviso del grupo chico con el texto del pie del
// motor y la línea «Base:» que irá en la nota. Los casos salen de las categorías del cruce (useCategoriasGrafico); sin
// conteo no hay vista previa de la base. La lógica vive en modeloGruposPadron.ts y modeloPadron.ts.

import { useId, useMemo, type KeyboardEvent } from "react";
import { Panel } from "../../../../components/Panel";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { formatoConteoDe } from "../../../../lib/formatoNumero";
import { AyudaGlobo } from "../AyudaGlobo";
import { MAX_GRUPOS_RESUMEN, type Opcion } from "../brecha/modeloBrechaGrupos";
import { useCategoriasGrafico } from "../useCategoriasGrafico";
import { CoberturaGrupo } from "./CoberturaGrupo";
import { FilaPadron } from "./FilaPadron";
import { OrdenGrupo } from "./OrdenGrupo";
import { PadronDelCruce } from "./PadronDelCruce";
import {
  alternarGrupo, filasGrupos, gruposSinPadron, incluidosEnOrden, lineaBase, moverGrupo, notaGrupoChico, textoDiferencia,
  textoTope, unidadDeCruce,
} from "./modeloGruposPadron";
import { conPadron } from "./modeloPadron";
import { useGuardaNoConfiables } from "./useGuardaNoConfiables";
import "./gruposPadron.css";

type Props = {
  args: Readonly<Record<string, unknown>>;
  /** La pregunta del cruce, calificada (`base$variable`). */
  cruce: string;
  opciones: readonly Opcion[];
  scope: "active" | "consolidated";
  onCambio: (patch: Record<string, unknown>) => void;
};

const AYUDA_GRUPOS = "Hasta cuatro. Con dos, la diferencia es el primero menos el segundo; con más, el mayor menos el menor.";
const AYUDA_BASE = "Con los casos de cada grupo en la pregunta que divide. Si cambian de pregunta a pregunta, la nota da su rango.";

export function GruposPadron({ args, cruce, opciones, scope, onCambio }: Props) {
  const id = useId();
  const categorias = useCategoriasGrafico(cruce, scope);
  const guarda = useGuardaNoConfiables("p_dumbbell");
  const conteos = useMemo(
    () => (categorias.fase === "lista" ? new Map(categorias.datos.categorias.map((c) => [c.codigo, c.n])) : null),
    [categorias],
  );
  const filas = filasGrupos(opciones, conteos, args);
  const incluidos = incluidosEnOrden(filas, args);
  const chico = notaGrupoChico(incluidos, unidadDeCruce(cruce));
  const base = lineaBase(incluidos);
  const diferencia = textoDiferencia(incluidos);
  // Alt+Flecha arriba/abajo desde cualquier control de la fila mueve el grupo en la lámina.
  const alTeclear = (codigo: string, incluido: boolean) => (e: KeyboardEvent<HTMLLIElement>) => {
    if (!incluido || !e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    onCambio(moverGrupo(args, codigo, e.key === "ArrowUp" ? -1 : 1));
  };

  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-grupos" data-campo="grupos"
      data-qa-geometry-group="graficos/f6-grupos-padron" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-grupos-cabeza">
        <span className="pulso-f6-dato-rotulo" id={`${id}-rotulo`}>
          Grupos
          <AyudaGlobo id={`${id}-ayuda`} rotulo="Grupos" detalle={AYUDA_GRUPOS} />
        </span>
        <span className={incluidos.length >= MAX_GRUPOS_RESUMEN ? "pulso-f6-grupos-tope is-lleno" : "pulso-f6-grupos-tope"} aria-live="polite">
          {textoTope(incluidos.length)}
        </span>
      </div>
      <Panel variant="subtle" noPadding className="pulso-f6-grupos-lista" data-qa-geometry-member>
        <ul className="pulso-f6-grupos-filas" data-qa-scroll-owner="grupos-padron" aria-labelledby={`${id}-rotulo`}>
          {filas.map((f) => (
            <li key={f.codigo} className={f.incluido ? "pulso-f6-grupos-fila is-incluido" : "pulso-f6-grupos-fila"}
              onKeyDown={alTeclear(f.codigo, f.incluido)}>
              <div className="pulso-f6-grupos-fila-cabeza">
                <PulsoSwitch size="sm" label={f.etiqueta} checked={f.incluido} disabled={f.bloqueado}
                  title={f.bloqueado ? "Ya hay cuatro grupos: quita uno para incluir otro." : undefined}
                  description={f.n === null ? undefined : (
                    <span className={f.chico ? "is-chico" : undefined}>
                      {formatoConteoDe(f.n, "respuesta")}{f.chico ? ", grupo chico" : ""}
                    </span>
                  )}
                  onCheckedChange={(v) => onCambio(alternarGrupo(args, f.codigo, v))} />
                {f.posicion !== null && (
                  <OrdenGrupo etiqueta={f.etiqueta} posicion={f.posicion} total={incluidos.length}
                    onMover={(d) => onCambio(moverGrupo(args, f.codigo, d))} />
                )}
              </div>
              {f.incluido && (
                <>
                  <FilaPadron nombre={f.etiqueta} padron={f.padron}
                    onCambio={(p) => onCambio(conPadron(args, f.etiqueta, p, guarda))} />
                  <CoberturaGrupo n={f.n} padron={f.padron} />
                </>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      {diferencia && <p className="pulso-f6-dato-ayuda pulso-f6-grupos-diferencia" aria-live="polite">{diferencia}</p>}
      <PadronDelCruce cruce={cruce} scope={scope} sinPadron={gruposSinPadron(incluidos)} activo={incluidos.length > 0} />
      {chico && <p className="pulso-f6-dato-ayuda is-aviso" role="note">{chico}</p>}
      {base && (
        <div className="pulso-f6-grupos-base">
          <span className="pulso-f6-grupos-base-rotulo">
            Base en la nota
            <AyudaGlobo rotulo="Base en la nota" detalle={AYUDA_BASE} />
          </span>
          <p className="pulso-f6-grupos-base-texto" aria-live="polite">{base}</p>
        </div>
      )}
    </div>
  );
}
