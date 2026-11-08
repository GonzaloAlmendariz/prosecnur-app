// «Regla de preguntas» en Datos de la tarjeta del gráfico (ADR 0135 §2, §4 y §8; maqueta graficos-sintesis, Configurar
// › Preguntas). Una lámina de resumen elige sus preguntas con una regla: el tipo (sólo los que tienen sentido para este
// graficador y sus grupos), su cifra como slider sobre el reparto de las candidatas (CorteRegla), el conteo en vivo
// («13 de 47») con el texto de la nota tal como lo redacta el motor, y la lista de candidatas en el orden de la lámina
// con un interruptor por fila para el ajuste a mano (ListaCandidatas).
//
// Conteo optimista: mientras se arrastra la cifra, o el pedido no responde, el conteo, el reparto y las filas son los
// que el cliente calcula con las métricas ya recibidas (repartoRegla.ts, vistaRegla.ts); al llegar la respuesta manda el
// backend. La lógica vive en los módulos .ts; el pedido, en useConteoRegla.ts.

import { useEffect, useId, useRef, useState } from "react";
import { ListChecks } from "../../../../vendor/lucide-react";
import type { ReglaPreguntas as Regla, TipoReglaPreguntas } from "../../../../api/graficosRegla";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { ErrorBlock } from "../../../../components/States";
import { AyudaGlobo } from "../AyudaGlobo";
import { CorteRegla } from "./CorteRegla";
import { LimiteLamina } from "./LimiteLamina";
import { ListaCandidatas, type Resaltada } from "./ListaCandidatas";
import {
  ajustadaAMano, campoCifra, conCifra, conTipo, gruposDeLaLamina, indicadorDe, reglaEfectiva, rotuloMetrica, rotuloTipo, textoConteo,
  tiposOfrecidos, valorCifra, volverALaRegla,
} from "./modeloReglaPreguntas";
import { estadoTope, marcasDeCorte, ordenFilas, repartoRegla, repiteElTope } from "./repartoRegla";
import { useCifraEnVivo } from "./useCifraEnVivo";
import { useConteoRegla } from "./useConteoRegla";
import { enOrden, seleccionVista } from "./vistaRegla";
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

const SIN_FILAS: Readonly<Record<string, boolean>> = {};

export function ReglaPreguntas({ rotulo, ayuda, graficador, args, valor, scope, onCambio }: Props) {
  const id = useId();
  const idRotulo = `${id}-rotulo`;
  const idAyuda = `${id}-ayuda`;
  const idCifra = `${id}-cifra`;
  const regla = reglaEfectiva(graficador, args, valor);
  const grupos = gruposDeLaLamina(graficador, args);
  const tipos = tiposOfrecidos(graficador, grupos, regla?.tipo ?? null);
  const { conteo, cargando, error } = useConteoRegla(graficador, args, scope, !!regla);
  const cifra = regla ? campoCifra(regla.tipo) : null;
  // Interruptores tocados que el motor todavía no confirma; se vacían cuando responde.
  const [filas, setFilas] = useState<Readonly<Record<string, boolean>>>(SIN_FILAS);
  const [resaltada, setResaltada] = useState<Resaltada>(null);
  useEffect(() => { if (!cargando) setFilas(SIN_FILAS); }, [cargando, conteo]);

  // La regla más reciente para la confirmación diferida: entre el arrastre y la espera pudo cambiar una fila.
  const reglaActual = useRef(regla);
  reglaActual.current = regla;
  const vivo = useCifraEnVivo(regla && cifra ? valorCifra(regla) ?? 0 : 0, regla?.tipo ?? "", (v) => {
    if (reglaActual.current) onCambio(conCifra(reglaActual.current, v));
  });

  const reglaViva = regla && cifra ? conCifra(regla, vivo.valor) : regla;
  const calculado = reglaViva && conteo ? repartoRegla(reglaViva, conteo.candidatas) : null;
  const vista = conteo ? seleccionVista(conteo, calculado, vivo.enVivo || cargando, filas) : null;
  const reparto = calculado && vista ? { ...calculado, puntos: calculado.puntos.map((p) => ({ ...p, entra: vista.temas.has(p.tema) })) } : calculado;
  const ordenadas = reglaViva && conteo ? ordenFilas(reglaViva.tipo, conteo.candidatas) : [];
  const seleccionadas = vista && conteo ? (vista.proyectada ? enOrden(vista.temas, ordenadas) : conteo.seleccionadas) : [];
  const textoVisto = conteo ? textoConteo({ seleccionadas, total: conteo.total }) : "";
  const rotuloDeMetrica = regla ? rotuloMetrica(regla.tipo, grupos, indicadorDe(args)) : "";
  // El límite depende del graficador: se recuerda mientras llega el conteo de otra lámina del mismo tipo, para que su
  // sitio no desaparezca y vuelva (C2).
  const topes = useRef<Record<string, number | null>>({});
  if (conteo && conteo.tope_filas !== undefined) topes.current[graficador] = conteo.tope_filas;
  const tope = estadoTope(conteo?.tope_filas ?? topes.current[graficador], seleccionadas.length);
  const avisoTope = conteo?.avisos.find(repiteElTope) ?? null;
  const etiquetas = new Map((conteo?.candidatas ?? []).map((c) => [c.tema, c.etiqueta]));
  const proyectada = !!vista?.proyectada;

  const elegir = (tipo: TipoReglaPreguntas) => onCambio(conTipo(regla, tipo, seleccionadas));
  const alternar = (tema: string, encendida: boolean, nueva: Regla) => {
    setFilas((f) => ({ ...f, [tema]: !encendida }));
    onCambio(nueva);
  };

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

      {regla && cifra && (
        <CorteRegla id={idCifra} tipo={regla.tipo} campo={cifra} valor={vivo.valor} reparto={reparto} rotuloMetrica={rotuloDeMetrica}
          etiquetas={etiquetas} tope={tope} avisoTope={avisoTope} cargando={cargando} resaltada={resaltada} onResaltar={setResaltada}
          onMover={vivo.mover} onSoltar={vivo.soltar} />
      )}

      {!regla && <span className="pulso-f6-dato-ayuda" role="note">Sin regla salen las preguntas declaradas.</span>}

      {regla && error && <ErrorBlock label="No se pudo contar las preguntas" detail={error} />}

      {regla && !error && !conteo && cargando && <CargaDeBloque label="Contando las preguntas" />}

      {regla && reglaViva && !error && conteo && vista && (
        <div className="pulso-f6-regla-resultado" aria-busy={cargando || undefined}>
          <p className="pulso-f6-regla-conteo" role="status">
            <strong className="pulso-f6-regla-cifra-grande">{textoVisto}</strong>
            <span> en la lámina</span>
          </p>
          {conteo.texto_regla && <p className={`pulso-f6-regla-texto${proyectada ? " is-desfasado" : ""}`}>{conteo.texto_regla}</p>}
          {tope && !cifra && <LimiteLamina tope={tope.tope} excedido={tope.excedido} aviso={avisoTope} />}
          {conteo.avisos.filter((a) => !(tope && repiteElTope(a))).map((a) => <span key={a} className="pulso-f6-dato-ayuda" role="note">{a}</span>)}
          {conteo.candidatas.length === 0 ? (
            <EstadoVacio icono={<ListChecks size={16} />} titulo="Sin preguntas candidatas" descripcion="Revisa las bases, el indicador y los filtros." />
          ) : (
            <ListaCandidatas regla={reglaViva} filas={ordenadas} encendida={(t) => vista.temas.has(t)}
              marcas={marcasDeCorte(reglaViva, ordenadas)} reparto={reparto} rotuloMetrica={rotuloDeMetrica}
              etiquetaLista={`Preguntas candidatas, ${textoVisto} en la lámina`} resaltada={resaltada} onResaltar={setResaltada}
              onAlternar={alternar} />
          )}
          {ajustadaAMano(regla) && (
            <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" onClick={() => { setFilas(SIN_FILAS); onCambio(volverALaRegla(reglaViva)); }}>
              Volver a la regla
            </button>
          )}
        </div>
      )}
    </div>
  );
}
