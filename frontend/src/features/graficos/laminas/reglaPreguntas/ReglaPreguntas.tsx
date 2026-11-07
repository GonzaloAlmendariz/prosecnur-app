// «Regla de preguntas» en Datos de la tarjeta del gráfico (ADR 0135 §2, §4 y §8; maqueta graficos-sintesis, Configurar
// › Preguntas). Una lámina de resumen elige sus preguntas con una regla: el tipo (sólo los que tienen sentido para este
// graficador y sus grupos), su cifra, el conteo en vivo («13 de 47») con el texto de la nota tal como lo redacta el
// motor, y la lista de candidatas con un interruptor por fila para el ajuste a mano. La lógica vive en
// modeloReglaPreguntas.ts y el pedido en useConteoRegla.ts.

import { useId } from "react";
import { ListChecks } from "../../../../vendor/lucide-react";
import type { ArgMetadata } from "../../../../api/graficos";
import type { ReglaPreguntas as Regla, TipoReglaPreguntas } from "../../../../api/graficosRegla";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { Panel } from "../../../../components/Panel";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { ErrorBlock } from "../../../../components/States";
import { AyudaGlobo } from "../AyudaGlobo";
import { NumeroAcotado } from "../NumeroAcotado";
import {
  ajustadaAMano, alternarFila, campoCifra, conCifra, conTipo, filaBloqueada, gruposDeLaLamina, reglaEfectiva, rotuloMetrica,
  rotuloTipo, textoConteo, textoMetrica, tiposOfrecidos, valorCifra, volverALaRegla,
} from "./modeloReglaPreguntas";
import { useConteoRegla } from "./useConteoRegla";
import "./reglaPreguntas.css";

type Props = {
  rotulo: string;
  /** El texto del «?» (guarda de la tarjeta y descripción del registro). */
  ayuda: string;
  graficador: string;
  args: Readonly<Record<string, unknown>>;
  valor: unknown;
  scope: "active" | "consolidated";
  onCambio: (regla: Regla) => void;
};

export function ReglaPreguntas({ rotulo, ayuda, graficador, args, valor, scope, onCambio }: Props) {
  const id = useId();
  const idRotulo = `${id}-rotulo`;
  const idAyuda = `${id}-ayuda`;
  const idCifra = `${id}-cifra`;
  const regla = reglaEfectiva(graficador, args, valor);
  const grupos = gruposDeLaLamina(graficador, args);
  const tipos = tiposOfrecidos(graficador, grupos, regla?.tipo ?? null);
  const { conteo, cargando, error } = useConteoRegla(graficador, args, scope, !!regla);
  const seleccionadas = conteo?.seleccionadas ?? [];
  const cifra = regla ? campoCifra(regla.tipo) : null;
  const argCifra: ArgMetadata | null = cifra
    ? { name: "regla_cifra", label: cifra.rotulo, tipo_input: "number", grupo: "datos", min: cifra.min, max: cifra.max, step: cifra.paso }
    : null;

  const elegir = (tipo: TipoReglaPreguntas) => onCambio(conTipo(regla, tipo, seleccionadas));

  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-regla" data-campo="regla"
      data-qa-geometry-group="graficos/f6-regla" data-qa-geometry-contract="intrinsic">
      <span className="pulso-f6-dato-rotulo" id={idRotulo}>
        {rotulo}
        <AyudaGlobo id={idAyuda} rotulo={rotulo} detalle={ayuda} />
      </span>
      <GlidingRadioGroup
        value={regla?.tipo ?? ""}
        options={tipos}
        getOptionValue={(t) => t}
        onValueChange={(t) => { if (t) elegir(t as TipoReglaPreguntas); }}
        orientation="vertical"
        className="pulso-f6-regla-tipos"
        aria-labelledby={idRotulo}
        aria-describedby={ayuda ? idAyuda : undefined}
        getOptionProps={() => ({ className: "pulso-f6-regla-tipo" })}
      >
        {(t) => <span>{rotuloTipo(t, graficador)}</span>}
      </GlidingRadioGroup>

      {regla && cifra && argCifra && (
        <div className="pulso-f6-dato pulso-f6-regla-cifra">
          <label className="pulso-f6-dato-rotulo" htmlFor={idCifra}>{cifra.rotulo}</label>
          <NumeroAcotado id={idCifra} rotulo={cifra.rotulo} arg={argCifra} valor={valorCifra(regla)} placeholder=""
            onCambio={(v) => onCambio(conCifra(regla, v))} />
        </div>
      )}

      {!regla && <span className="pulso-f6-dato-ayuda" role="note">Sin regla salen las preguntas declaradas.</span>}

      {regla && error && <ErrorBlock label="No se pudo contar las preguntas" detail={error} />}

      {regla && !error && !conteo && cargando && <CargaDeBloque label="Contando las preguntas" />}

      {regla && !error && conteo && (
        <div className="pulso-f6-regla-resultado" aria-busy={cargando || undefined}>
          <p className="pulso-f6-regla-conteo" role="status">
            <strong className="pulso-f6-regla-cifra-grande">{textoConteo(conteo)}</strong>
            <span> en la lámina</span>
          </p>
          {conteo.texto_regla && <p className="pulso-f6-regla-texto">{conteo.texto_regla}</p>}
          {conteo.avisos.map((a) => <span key={a} className="pulso-f6-dato-ayuda" role="note">{a}</span>)}
          {conteo.candidatas.length === 0 ? (
            <EstadoVacio icono={<ListChecks size={16} />} titulo="Sin preguntas candidatas" descripcion="Revisa las bases, el indicador y los filtros." />
          ) : (
            <Panel variant="subtle" noPadding className="pulso-f6-regla-lista" data-qa-geometry-member>
              <div className="pulso-f6-regla-cabeza" aria-hidden="true">
                <span>Pregunta</span>
                <span>{rotuloMetrica(regla.tipo, grupos)}</span>
              </div>
              <ul className="pulso-f6-regla-filas" data-qa-scroll-owner="regla-preguntas" aria-label={`Preguntas candidatas, ${textoConteo(conteo)} en la lámina`}>
                {conteo.candidatas.map((c) => (
                  <li key={c.tema} className="pulso-f6-regla-fila">
                    <PulsoSwitch size="sm" label={c.etiqueta} checked={c.seleccionada}
                      disabled={filaBloqueada(regla, c.tema, c.seleccionada)}
                      onCheckedChange={() => onCambio(alternarFila(regla, c.tema, c.seleccionada))} />
                    <span className="pulso-f6-regla-metrica">{textoMetrica(c.metrica)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {ajustadaAMano(regla) && (
            <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" onClick={() => onCambio(volverALaRegla(regla))}>
              Volver a la regla
            </button>
          )}
        </div>
      )}
    </div>
  );
}
