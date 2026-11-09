// «Regla de preguntas» en Datos de la tarjeta del gráfico (ADR 0135 §2, §4 y §8; maqueta graficos-sintesis, Configurar
// › Preguntas). Una lámina de resumen elige sus preguntas con una regla: el tipo (sólo los que tienen sentido para este
// graficador y sus grupos), su cifra como slider sobre el reparto de las candidatas (CorteRegla), el conteo en vivo
// («13 de 47») con el texto de la nota tal como lo redacta el motor, y la lista de candidatas en el orden de la lámina
// con un interruptor por fila para el ajuste a mano (ListaCandidatas).
//
// Conteo optimista: mientras se arrastra la cifra, o el pedido no responde, el conteo, el reparto y las filas son los
// que el cliente calcula con las métricas ya recibidas (repartoRegla.ts, vistaRegla.ts); al llegar la respuesta manda el
// backend. La lógica vive en los módulos .ts; el pedido, en useConteoRegla.ts.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ListChecks } from "../../../../vendor/lucide-react";
import { CODIGO_REGLA_INVALIDA, type ReglaPreguntas as Regla, type TipoReglaPreguntas } from "../../../../api/graficosRegla";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { ErrorBlock } from "../../../../components/States";
import { AyudaGlobo } from "../AyudaGlobo";
import { brechaSinPreguntas, FALTA_CRUCE, sinCruce } from "../brecha/modeloBrechaGrupos";
import { CorteRegla } from "./CorteRegla";
import { LimiteLamina } from "./LimiteLamina";
import { ListaCandidatas, type Resaltada } from "./ListaCandidatas";
import {
  ajustadaAMano, aManoVacia, argsDelConteo, campoCifra, conteoSinElegidas, ELIGE_UNA, conCifra, conTipo, gruposDeLaLamina, indicadorDe, recordarCifra, reglaEfectiva, rotuloMetrica, rotuloTipo,
  textoConteo, tiposOfrecidos, valorCifra, volverALaRegla, type CifrasRecordadas,
} from "./modeloReglaPreguntas";
import { avisosFueraDelLimite, estadoLimite } from "./limiteRegla";
import { marcasDeCorte, ordenFilas, repartoRegla } from "./repartoRegla";
import { useCifraEnVivo } from "./useCifraEnVivo";
import { useConteoRegla } from "./useConteoRegla";
import { enOrden, seleccionVista } from "./vistaRegla";
import "./reglaPreguntas.css";
import { PulsoButton } from "../../../../components/PulsoButton";
import { useLaminasUi } from "../laminasStore";

type Props = {
  rotulo: string;
  /** El texto del «?» (guarda de la tarjeta y descripción del registro). */
  ayuda: string;
  graficador: string;
  args: Readonly<Record<string, unknown>>;
  valor: unknown;
  scope: "active" | "consolidated";
  onCambio: (regla: Regla) => void;
  /** La lámina: si su última vista previa falló, el conteo no promete «N de M en la lámina» (R9-2). */
  slideId?: string;
};

const SIN_FILAS: Readonly<Record<string, boolean>> = {};

export function ReglaPreguntas({ rotulo, ayuda, graficador, args, valor, scope, onCambio, slideId }: Props) {
  const id = useId();
  const idRotulo = `${id}-rotulo`;
  const idAyuda = `${id}-ayuda`;
  const idCifra = `${id}-cifra`;
  const regla = reglaEfectiva(graficador, args, valor);
  const grupos = gruposDeLaLamina(graficador, args);
  const tipos = tiposOfrecidos(graficador, grupos, regla?.tipo ?? null);
  // R8-3: «Elegidas a mano» vacía pide las candidatas con el tipo que las lista todas y ninguna sale encendida.
  const vacia = aManoVacia(regla);
  // R8-7: «Dos grupos de una base» sin la variable que divide no se cuenta: el motor respondería con el texto del
  // contraste entre públicos. Se dice lo que falta y se lleva a «Dividir por».
  const faltaCruce = graficador === "p_dumbbell" && sinCruce(args);
  const pedido = useConteoRegla(graficador, argsDelConteo(graficador, args, regla), scope, !!regla && !faltaCruce);
  const { cargando } = pedido;
  const conteo = vacia && pedido.conteo ? conteoSinElegidas(pedido.conteo) : pedido.conteo;
  const error = vacia && pedido.error && pedido.codigo === CODIGO_REGLA_INVALIDA ? null : pedido.error;
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
  const ordenadas = reglaViva && conteo ? ordenFilas(reglaViva.tipo, conteo.candidatas, conteo.seleccionadas) : [];
  const seleccionadas = vista && conteo ? (vista.proyectada ? enOrden(vista.temas, ordenadas) : conteo.seleccionadas) : [];
  const textoVisto = conteo ? textoConteo({ seleccionadas, total: conteo.total }) : "";
  const rotuloDeMetrica = regla ? rotuloMetrica(regla.tipo, grupos, indicadorDe(args)) : "";
  // El límite depende del graficador: se recuerda mientras llega el conteo de otra lámina del mismo tipo, para que su
  // sitio no desaparezca y vuelva (C2).
  const topes = useRef<Record<string, number | null>>({});
  if (conteo && conteo.tope_filas !== undefined) topes.current[graficador] = conteo.tope_filas;
  const limite = estadoLimite(conteo, conteo?.tope_filas ?? topes.current[graficador], seleccionadas.length);
  const etiquetas = new Map((conteo?.candidatas ?? []).map((c) => [c.tema, c.etiqueta]));
  const proyectada = !!vista?.proyectada;
  // R8-1: la brecha guardada sin `vars` sale vacía aunque la regla cuente; no se promete «13 de 73 en la lámina».
  const saleVacia = graficador === "p_dumbbell" && brechaSinPreguntas(args);
  // R9-2: si el motor no pudo dibujar la lámina, lo que sale no es «N de M»: es el error, con su motivo.
  const fallo = useLaminasUi((s) => (slideId ? s.erroresPreview?.[slideId] ?? null : null));

  // R9-9 (C2): la explicación de la regla reserva el alto más grande que ya tuvo en esta lámina; al cambiar de tipo, o
  // cuando la cifra hace que parta en otra línea, no salta 18 px. Se mide el texto real, no dos líneas fijas.
  const texto = useRef<HTMLParagraphElement>(null);
  const altoTexto = useRef<{ graficador: string; alto: number }>({ graficador, alto: 0 });
  if (altoTexto.current.graficador !== graficador) altoTexto.current = { graficador, alto: 0 };

  // R8-3 (C2): mientras se espera el conteo, la zona del resultado guarda el alto que tuvo la última vez; al llegar no
  // empuja todo lo de abajo 50 a 90 px. Un ref y no estado: se mide después de pintar y sólo se lee al esperar.
  const zona = useRef<HTMLDivElement>(null);
  const altoReservado = useRef(0);
  const esperando = !!regla && !faltaCruce && !error && cargando;
  const irADividir = () => {
    const campo = zona.current?.closest(".pulso-f6-datos")?.querySelector<HTMLElement>('[data-campo="cruce"]');
    const control = campo?.querySelector<HTMLElement>("button, input");
    if (typeof campo?.scrollIntoView === "function") campo.scrollIntoView({ block: "nearest" });
    control?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (!esperando && zona.current) altoReservado.current = zona.current.offsetHeight;
    if (texto.current) altoTexto.current.alto = Math.max(altoTexto.current.alto, texto.current.scrollHeight);
  });

  // La cifra de cada tipo, para devolverla al volver a él (R3). Un ref y no estado: nada se pinta con ella.
  const cifras = useRef<CifrasRecordadas>({});
  cifras.current = recordarCifra(cifras.current, regla);
  const elegir = (tipo: TipoReglaPreguntas) => onCambio(conTipo(regla, tipo, seleccionadas, cifras.current));
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
          etiquetas={etiquetas} limite={limite} cargando={cargando} resaltada={resaltada} onResaltar={setResaltada}
          onMover={vivo.mover} onSoltar={vivo.soltar} />
      )}

      {!regla && <span className="pulso-f6-dato-ayuda" role="note">Sin regla salen las preguntas declaradas.</span>}

      <div ref={zona} className={`pulso-f6-regla-zona${esperando ? " is-esperando" : ""}`}
        style={esperando && altoReservado.current ? { minHeight: altoReservado.current } : undefined}>
      {regla && faltaCruce && (
        <p className="pulso-f6-dato-ayuda" role="status">
          {`${FALTA_CRUCE} `}
          <PulsoButton variant="link" size="sm" onClick={irADividir}>Ir a "Dividir por"</PulsoButton>
        </p>
      )}
      {regla && !faltaCruce && error && <ErrorBlock label="No se pudo contar las preguntas" detail={error} />}

      {regla && !faltaCruce && !error && !conteo && cargando && <CargaDeBloque label="Contando las preguntas" />}

      {regla && reglaViva && !faltaCruce && !error && conteo && vista && (
        <div className="pulso-f6-regla-resultado" aria-busy={cargando || undefined}>
          {vacia ? (
            <p className="pulso-f6-regla-conteo is-accion" role="status">{ELIGE_UNA}</p>
          ) : fallo ? (
            <p className="pulso-f6-regla-conteo is-vacia" role="alert">No se pudo dibujar la lámina: {fallo}</p>
          ) : saleVacia ? (
            <p className="pulso-f6-regla-conteo is-vacia" role="status">La lámina sale vacía: faltan sus preguntas.</p>
          ) : (
            <p className="pulso-f6-regla-conteo" role="status">
              <strong className="pulso-f6-regla-cifra-grande">{textoVisto}</strong>
              <span> en la lámina</span>
            </p>
          )}
          {conteo.texto_regla && (
            <p ref={texto} className={`pulso-f6-regla-texto${proyectada ? " is-desfasado" : ""}`}
              style={altoTexto.current.alto ? { minHeight: altoTexto.current.alto } : undefined}>{conteo.texto_regla}</p>
          )}
          {limite && !cifra && <LimiteLamina limite={limite} />}
          {avisosFueraDelLimite(conteo.avisos, limite).map((a) => <span key={a} className="pulso-f6-dato-ayuda" role="note">{a}</span>)}
          {conteo.candidatas.length === 0 ? (
            <EstadoVacio icono={<ListChecks size={16} />} titulo="Sin preguntas candidatas" descripcion="Revisa las bases, el indicador y los filtros." />
          ) : (
            <ListaCandidatas regla={reglaViva} filas={ordenadas} encendida={(t) => vista.temas.has(t)}
              marcas={marcasDeCorte(reglaViva, ordenadas)} reparto={reparto} rotuloMetrica={rotuloDeMetrica}
              etiquetaLista={`Preguntas candidatas, ${textoVisto} en la lámina`} resaltada={resaltada} onResaltar={setResaltada}
              onAlternar={alternar} />
          )}
          {ajustadaAMano(regla) && (
            <PulsoButton variant="secondary" size="sm" className="pulso-f6-dato-accion" onClick={() => { setFilas(SIN_FILAS); onCambio(volverALaRegla(reglaViva)); }}>
              Volver a la regla
            </PulsoButton>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
