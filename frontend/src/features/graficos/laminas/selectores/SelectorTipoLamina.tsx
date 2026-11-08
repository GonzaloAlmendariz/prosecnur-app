// Panel «¿Qué quieres contar?» (`panel=tipo-lamina`; ADR 0135 §1, maqueta graficos-sintesis «Main»). Izquierda, la
// pregunta del estudio (intencionesContar.ts) y, al pie, «Ver por tipo de gráfico» con las familias de siempre
// (tiposLamina.ts); centro, las tarjetas; derecha, el detalle y el botón. Cada tarjeta dice su clase (Gráfico, Lámina o
// Lámina de resumen). El buscador de la cabecera filtra todas las tarjetas por nombre y por lo que responden. Dos modos:
// cambiar la lámina del foco (conserva sus gráficos y avisa los que no caben o se reemplazan) o insertar una nueva
// detrás de ella, elegidos en el segmentado de la cabecera. Una tarjeta es un tipo o un tipo con su payload de partida
// (opcionesLamina.ts). El detalle trae la ficha «Datos» (qué usa el gráfico y qué tiene el estudio) y «Comparar» pone
// dos tarjetas lado a lado dentro del mismo diálogo.

import { LayoutTemplate, MousePointer2, Presentation, Search } from "../../../../vendor/lucide-react";
import { useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import type { GraficadorRef, Slide } from "../../../../api/graficos";
import { toast } from "../../../../components/toasterStore";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoButton } from "../../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { CATALOGO_GRAFICOS, CATALOGO_LAMINAS } from "../../iconos/catalogoTipos.generated";
import { ESTANDAR_LAMINAS } from "../../iconos/estandarLaminas.generated";
import { BASE_DERIVADA } from "../../iconos/composicion";
import { payloadPorDefecto, usePlanStore } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { useVariables } from "../../useVariables";
import { useLocation } from "react-router-dom";
import { useGraficosReportScope } from "../../reportScope";
import { propuestasDe, usePadronPropuesto } from "../gruposPadron/usePadronPropuesto";
import { graficosDeLamina, graficosPorSlot, planearCambioTipo, requiereConfirmacion, type CambioTipoLamina } from "./cambioTipoLamina";
import { DetalleTarjetaContar } from "./DetalleTarjetaContar";
import { DetalleTipoLamina } from "./DetalleTipoLamina";
import { usoDeTarjeta } from "./detalleLamina";
import { DialogoSelector } from "./DialogoSelector";
import { destinoAlCerrarEnDocumento } from "./focoAlCerrar";
import { nombreCampo, nombreGrafico, nombreLamina, nombreSlot } from "./etiquetas";
import { PANEL_TIPO_LAMINA } from "./panelesSelectores";
import { MODO_LAMINA_POR_DEFECTO, useSelectoresUi } from "./selectoresStore";
import { TarjetaTipoLamina } from "./TarjetaTipoLamina";
import { conVariante, INTENCIONES, intencionDe, rotuloRanuras, varianteDe, variantesDe, type IntencionLamina } from "./tiposLamina";
import {
  cambioConOpcion, conOpcion, opcionDeLamina, opcionesDe, presetDe, tipoDeOpcion, type EstudioDelSelector, type OpcionLamina,
} from "./opcionesLamina";
import {
  casaBusqueda, INTENCIONES_CONTAR, intencionDeTarjeta, tarjetaContar, tarjetaContarDeLamina, tarjetasDe, type IntencionContarId,
} from "./intencionesContar";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { BarraComparar } from "./BarraComparar";
import { ControlModoLamina } from "./ControlModoLamina";
import { laminasDeResumen, usaDeTarjeta } from "./fichaDatos";
import { FichaDatosCierre } from "./FichaDatosCierre";
import { FichaDatosTarjeta } from "./FichaDatosTarjeta";
import { modoEfectivo, puedeEntrarEnComparacion } from "./modoYComparacion";
import { useInventarioSelector } from "./useInventarioSelector";
import { opcionesQuePiden } from "./modeloMiniaturasSelector";
import { useMiniaturasSelector } from "./useMiniaturasSelector";
import { VistaComparar, type ColumnaComparar } from "./VistaComparar";
import { formatoConteo } from "../../../../lib/formatoNumero";

const FUERA_DEL_CATALOGO = new Set(CATALOGO_LAMINAS.filter((s) => !s.en_selector).map((s) => s.name));

type Props = {
  /** Lámina del foco (null con el informe vacío: sólo se puede insertar). */
  slide: Slide | null;
  posicion: number | null;
  /** Cierra el panel en una sola navegación y deja el foco en `posicion` (si se da). */
  cerrar: (posicion?: number) => void;
  /** Abre «Armar el resumen ejecutivo» en lugar de este panel (sólo al insertar). */
  onArmarResumen?: () => void;
};

export function SelectorTipoLamina({ slide, posicion, cerrar, onArmarResumen }: Props) {
  const panel = usePanelDireccionable(PANEL_TIPO_LAMINA);
  const { slidesById, graficadoresById, registry } = useGraficosRegistry();
  const ui = useSelectoresUi();
  const setSlideTipo = usePlanStore((s) => s.setSlideTipo);
  const insertSlideAt = usePlanStore((s) => s.insertSlideAt);
  const undo = usePlanStore((s) => s.undo);
  const select = usePlanStore((s) => s.select);
  // S8: el cierre con hallazgos toma sus cifras de las láminas de resumen del informe; su ficha dice cuántas hay.
  const laminasResumen = usePlanStore((s) => laminasDeResumen(s.plan.slides));
  const grupo = useId();
  const focoInicialRef = useRef<HTMLInputElement>(null);
  // ADR 0135 §2: las láminas de resumen nacen con su regla y, si dependen de las bases, con sus `vars` (`base$*`).
  const { sources, baseActiva } = useVariables();
  const nombresBases = sources.map((s) => s.name).join("|");
  // U3: la cobertura nace con la propuesta de padrón y meta; se pide sólo si el registro ofrece la cobertura.
  const scope = useGraficosReportScope(useLocation().search);
  const conCobertura = registry ? "p_cobertura" in graficadoresById : CATALOGO_GRAFICOS.some((g) => g.name === "p_cobertura");
  const padron = propuestasDe(usePadronPropuesto(scope, conCobertura && nombresBases !== ""));
  useInventarioSelector(panel.abierto, scope);
  const estudio = useMemo<EstudioDelSelector>(
    () => ({ bases: nombresBases ? nombresBases.split("|") : [], baseActiva, padron }), [nombresBases, baseActiva, padron]);

  const modo = modoEfectivo(ui.modoLamina, !!slide);
  const tipoActual = modo === "cambiar" && slide ? slide.tipo : null;
  const opcionActual: OpcionLamina | null = modo === "cambiar" && slide ? opcionDeLamina(slide) : null;
  const tarjetaActual: OpcionLamina | null = modo === "cambiar" && slide ? tarjetaContarDeLamina(slide)?.clave ?? null : null;
  const intencion: IntencionLamina = ui.intencion ?? (tipoActual ? intencionDe(tipoActual) : null) ?? "una";
  // Al cambiar una lámina que no es una tarjeta por intención, el selector abre en su familia de «Ver por tipo».
  const porTipo = ui.porTipo ?? (modo === "cambiar" && !tarjetaActual);
  const busqueda = ui.busqueda.trim();

  // Lo que el registro de esta sesión ofrece: sin los retirados del selector y, con el registro cargado, sin los que
  // este backend no conoce todavía.
  const intenciones = useMemo(() => INTENCIONES.map((i) => ({
    ...i,
    tipos: i.tipos.filter((tipo) => {
      if (FUERA_DEL_CATALOGO.has(tipo) || tipo in BASE_DERIVADA) return false;
      if (!registry) return true;
      const meta = slidesById[tipo];
      return !!meta && meta.en_selector !== false;
    }),
  })), [registry, slidesById]);
  // Las tarjetas por intención sólo si el registro trae su lámina y su gráfico; sin registro, el catálogo generado.
  const contarOfrecidas = useMemo(() => {
    const graficadores = new Set(registry ? Object.keys(graficadoresById) : CATALOGO_GRAFICOS.map((g) => g.name));
    const laminas = new Set(registry ? Object.keys(slidesById) : CATALOGO_LAMINAS.map((l) => l.name));
    return INTENCIONES_CONTAR.map((i) => ({ ...i, lista: tarjetasDe(i, graficadores, laminas).map((t) => t.clave as OpcionLamina) }));
  }, [registry, graficadoresById, slidesById]);
  const contar: IntencionContarId = ui.contar
    ?? (tarjetaActual ? intencionDeTarjeta(tarjetaActual) : null)
    ?? contarOfrecidas.find((i) => i.lista.length > 0)?.id
    ?? "resumir";
  const nombreDe = (op: OpcionLamina): string => nombreDeOpcion(op, slidesById);
  const usoDe = (op: OpcionLamina): string => usoDeOpcion(op, slidesById);
  const opciones = useMemo(() => {
    if (busqueda) {
      const todas = [...contarOfrecidas.flatMap((i) => i.lista), ...intenciones.flatMap((i) => opcionesDe(i))];
      return [...new Set(todas)].filter((op) =>
        casaBusqueda(busqueda, [nombreDeOpcion(op, slidesById), usoDeOpcion(op, slidesById), presetDe(op)?.pide]));
    }
    if (porTipo) {
      const i = intenciones.find((x) => x.id === intencion);
      return i ? opcionesDe(i) : [];
    }
    return contarOfrecidas.find((i) => i.id === contar)?.lista ?? [];
  }, [busqueda, porTipo, intenciones, intencion, contarOfrecidas, contar, slidesById]);
  const esActual = (op: OpcionLamina): boolean => op === opcionActual || op === tarjetaActual;
  const candidato: OpcionLamina | null = ui.candidato ?? opciones.find(esActual) ?? opciones[0] ?? null;
  const comparar = ui.comparar;

  const cambios = useMemo(() => {
    const m = new Map<OpcionLamina, CambioTipoLamina>();
    if (modo !== "cambiar" || !slide) return m;
    const actual = opcionDeLamina(slide);
    const tarjeta = tarjetaContarDeLamina(slide)?.clave ?? null;
    // También las tarjetas en «Comparar», que pueden venir de otra intención que la que se ve.
    for (const op of new Set([...opciones, ...comparar])) {
      const t = tipoDeOpcion(op);
      const c = planearCambioTipo(slide, t, { clavesDestino: slidesById[t]?.args.map((a) => a.name) });
      // Otra tarjeta del mismo tipo (Hallazgos clave ⇄ Hallazgos por capítulo, Panorama ⇄ Contraste) es un cambio, con
      // su payload de partida; si trae otro gráfico, el de antes se avisa como sobrante.
      m.set(op, op === actual || op === tarjeta ? c : cambioConOpcion(op, c, estudio));
    }
    return m;
  }, [modo, slide, opciones, comparar, slidesById, estudio]);
  const conGraficos = modo === "cambiar" && !!slide && graficosDeLamina(slide).length > 0;

  const variantesDeTipo = (op: OpcionLamina) => {
    const t = tipoDeOpcion(op);
    const arg = slidesById[t]?.args.find((a) => a.name === "variante");
    return variantesDe(t, arg?.choices);
  };
  const varianteInicial = (op: OpcionLamina): string | null =>
    slide && op === opcionActual ? varianteDe(slide) : variantesDeTipo(op)?.defecto ?? null;
  const variante = candidato ? ui.variante ?? varianteInicial(candidato) : null;
  const cambio = candidato ? cambios.get(candidato) ?? null : null;
  // La lámina real sólo para la enfocada o las dos comparadas; la galería se queda con sus glifos.
  const miniaturas = useMiniaturasSelector({
    opciones: opcionesQuePiden(candidato, comparar, ui.viendoComparacion && comparar.length === 2),
    inventario: ui.inventario, estudio, scope, activo: panel.abierto,
  });

  // Cerrar por fuera (Escape, velo, otro enlace, «atrás») deja el selector listo para la próxima vez: sin confirmación
  // pendiente y en el modo por defecto, para que un enlace posterior sin intención no herede un «cambiar».
  const estabaAbiertoRef = useRef(panel.abierto);
  useEffect(() => {
    if (!panel.abierto) {
      useSelectoresUi.getState().setConfirmando(false);
      if (estabaAbiertoRef.current) useSelectoresUi.getState().prepararLamina(MODO_LAMINA_POR_DEFECTO);
    }
    estabaAbiertoRef.current = panel.abierto;
  }, [panel.abierto]);

  // Al salir de la vista partida, el botón que la abrió ya no existe: el foco vuelve a «Ver lado a lado» o, si la barra
  // se fue con la tarjeta quitada, al título de la galería.
  const viendo = ui.viendoComparacion && comparar.length === 2;
  const veiaRef = useRef(viendo);
  const galeriaTituloRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (veiaRef.current && !viendo) {
      const dialogo = galeriaTituloRef.current?.closest<HTMLElement>(".pulso-f6-selector");
      const destino = dialogo?.querySelector<HTMLElement>("[data-ver-comparacion]") ?? galeriaTituloRef.current;
      destino?.focus({ preventScroll: true });
    }
    veiaRef.current = viendo;
  }, [viendo]);

  const cerrarYOlvidar = (pos?: number) => {
    // Lo que queda para la próxima apertura sin intención (un enlace): insertar, nunca «cambiar» heredado.
    useSelectoresUi.getState().prepararLamina(MODO_LAMINA_POR_DEFECTO);
    cerrar(pos);
  };

  // `desdeComparar`: «Usar esta» de la vista partida, con la variante de partida de esa tarjeta. Si el cambio pierde
  // gráficos o textos, la tarjeta pasa al detalle con el aviso y el segundo paso de confirmación.
  const aplicarOpcion = (op: OpcionLamina, desdeComparar = false) => {
    const tipo = tipoDeOpcion(op);
    const nombre = nombreDe(op);
    const varianteOp = desdeComparar ? varianteInicial(op) : variante;
    const cambioOp = desdeComparar ? cambios.get(op) ?? null : cambio;
    if (modo === "insertar") {
      const base = { tipo, payload: conOpcion(op, payloadPorDefecto(tipo), estudio) };
      const payload = varianteOp ? conVariante(base, varianteOp) : base.payload;
      const indice = posicion ?? usePlanStore.getState().plan.slides.length;
      insertSlideAt(tipo, payload, indice);
      toast.exito(`Lámina ${indice + 1} insertada: ${nombre}`);
      cerrarYOlvidar(indice + 1);
      return;
    }
    if (!slide || !cambioOp || posicion === null || op === tarjetaActual) return;
    if (desdeComparar && requiereConfirmacion(cambioOp, false)) {
      ui.verComparacion(false);
      ui.elegirCandidato(op, varianteOp);
      ui.setConfirmando(true);
      return;
    }
    if (requiereConfirmacion(cambioOp, ui.confirmando)) {
      ui.setConfirmando(true);
      return;
    }
    const payload = varianteOp && variantesDeTipo(op)
      ? conVariante({ tipo, payload: cambioOp.payload }, varianteOp)
      : cambioOp.payload;
    const id = slide.id;
    setSlideTipo(id, tipo, payload);
    const quitados = cambioOp.sobrantes.length;
    toast.aviso(
      cambioOp.mismoTipo ? `Lámina ${posicion}: otra composición` : `Lámina ${posicion}: ahora es “${nombre}”`,
      {
        detalle: quitados
          ? `${quitados === 1 ? "Se quitó 1 gráfico" : `Se quitaron ${quitados} gráficos`} que no cabían.`
          : cambioOp.conservados.length ? "Sus gráficos se conservaron." : undefined,
        accion: { label: "Deshacer", onSelect: () => { undo(); select(id); } },
      },
    );
    cerrarYOlvidar(posicion);
  };
  const aplicar = () => { if (candidato) aplicarOpcion(candidato); };

  const graficosDe = (op: OpcionLamina): Record<string, string> => {
    const c = cambios.get(op);
    return c ? graficosPorSlot(c) : {};
  };
  const nombreG = (g: GraficadorRef) => nombreGrafico(g, graficadoresById);
  const metaOrigen = slide ? slidesById[slide.tipo] : undefined;

  const tituloGaleria = busqueda
    ? `Resultados de “${busqueda}”`
    : porTipo ? intenciones.find((i) => i.id === intencion)?.label ?? "" : contarOfrecidas.find((i) => i.id === contar)?.nombre ?? "";
  const cuentaGaleria = busqueda || !porTipo
    ? `${formatoConteo(opciones.length)} ${opciones.length === 1 ? "lámina" : "láminas"}`
    : conGraficos ? `${rotuloCuenta(opciones.length)}, con los gráficos de esta lámina` : rotuloCuenta(opciones.length);
  const tarjetaCandidata = tarjetaContar(candidato);
  // S1: el `usa` de la tarjeta manda sobre el del graficador cuando la composición lo exige.
  const usaDe = (op: OpcionLamina) => usaDeTarjeta(presetDe(op));
  const fichaDe = (op: OpcionLamina): ReactNode => {
    const usa = usaDe(op);
    if (usa) return <FichaDatosTarjeta usa={usa} inventario={ui.inventario} />;
    const sinGrafico = presetDe(op)?.usaSinGrafico;
    return sinGrafico ? <FichaDatosCierre usa={sinGrafico} laminasResumen={laminasResumen} /> : null;
  };
  const columnaComparar = (op: OpcionLamina): ColumnaComparar => {
    const preset = presetDe(op);
    const t = tipoDeOpcion(op);
    const c = cambios.get(op);
    return {
      opcion: op, tipo: t, nombre: nombreDe(op), clase: preset?.clase ?? "lamina", glifo: preset?.grafico?.graficador,
      usa: usaDe(op), usaSinGrafico: preset?.usaSinGrafico, admite: rotuloRanuras(t), actual: esActual(op), sobrantes: c && !c.mismoTipo ? c.sobrantes.length : 0,
      miniatura: miniaturas[op],
    };
  };

  return (
    <DialogoSelector
      abierto={panel.abierto}
      onCerrar={() => cerrarYOlvidar()}
      panelProps={panel.props}
      auditReady="f6-selector-lamina"
      antetitulo={modo === "insertar" ? (posicion ? `Insertar después de la lámina ${posicion}` : "Primera lámina del informe") : `Lámina ${posicion}`}
      titulo="¿Qué quieres contar?"
      descripcion={modo === "insertar"
        ? "Elige por la pregunta del estudio o por el tipo de gráfico."
        : "Los gráficos que ya configuraste pasan a la lámina nueva."}
      focoInicialRef={focoInicialRef}
      destinoAlCerrar={() => destinoAlCerrarEnDocumento(null)}
      modo={<ControlModoLamina modo={modo} hayLamina={!!slide} onModo={(m) => ui.cambiarModoLamina(m)} />}
      comparacion={viendo ? (
        <VistaComparar
          columnas={comparar.map((op) => columnaComparar(op))}
          inventario={ui.inventario}
          laminasResumen={laminasResumen}
          modo={modo}
          onUsar={(op) => aplicarOpcion(op, true)}
          onQuitar={(op) => ui.alternarComparar(op)}
          onVolver={() => ui.verComparacion(false)}
        />
      ) : undefined}
      accion={modo === "insertar" && onArmarResumen ? (
        <PulsoButton variant="secondary" size="sm" onClick={onArmarResumen} data-armar-resumen="">
          <Presentation size={14} aria-hidden="true" />
          Armar el resumen ejecutivo
        </PulsoButton>
      ) : undefined}
      buscador={(
        <label className="pulso-f6-selector-buscar">
          <Search size={14} aria-hidden="true" />
          <span className="pulso-sr-only">Buscar por pregunta o tipo</span>
          <PulsoInput type="search" size="sm" value={ui.busqueda} placeholder="Buscar por pregunta o tipo"
            onChange={(e) => ui.buscar(e.target.value)} />
        </label>
      )}
      pregunta={(
        <div className="pulso-f6-navegacion">
          <fieldset className="pulso-f6-opciones">
            <legend className="pulso-f6-selector-leyenda">Según la pregunta del estudio</legend>
            {contarOfrecidas.map((i) => (
              <label key={i.id} className="pulso-f6-opcion" data-intencion-contar={i.id}>
                <input
                  ref={!porTipo && i.id === contar ? focoInicialRef : undefined}
                  type="radio"
                  className="pulso-f6-radio-oculto"
                  name={`${grupo}-vista`}
                  value={i.id}
                  checked={!porTipo && i.id === contar}
                  disabled={i.lista.length === 0}
                  onChange={() => ui.elegirContar(i.id)}
                />
                <strong>{i.nombre}</strong>
                <span className="pulso-f6-opcion-cuenta">{formatoConteo(i.lista.length)}</span>
                <span>{i.ayuda}</span>
              </label>
            ))}
            <label className="pulso-f6-opcion is-secundaria" data-intencion-contar="por-tipo">
              <input
                ref={porTipo ? focoInicialRef : undefined}
                type="radio"
                className="pulso-f6-radio-oculto"
                name={`${grupo}-vista`}
                value="por-tipo"
                checked={porTipo}
                onChange={() => ui.verPorTipo()}
              />
              <strong>Ver por tipo de gráfico</strong>
              <span className="pulso-f6-opcion-cuenta">{formatoConteo(intenciones.length)}</span>
              <span>Composiciones por familia.</span>
            </label>
          </fieldset>
          {porTipo && (
            <fieldset className="pulso-f6-opciones is-familias">
              <legend className="pulso-sr-only">Familias de composiciones</legend>
              {intenciones.map((i) => (
                <label key={i.id} className="pulso-f6-opcion">
                  <input
                    type="radio"
                    className="pulso-f6-radio-oculto"
                    name={`${grupo}-intencion`}
                    value={i.id}
                    checked={i.id === intencion}
                    disabled={i.tipos.length === 0}
                    onChange={() => ui.elegirIntencion(i.id)}
                  />
                  <strong>{i.label}</strong>
                  <span className="pulso-f6-opcion-cuenta">{formatoConteo(opcionesDe(i).length)}</span>
                  <span>{i.descripcion}</span>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      )}
      galeria={(
        <section aria-labelledby={`${grupo}-galeria`}>
          <div className="pulso-f6-galeria-cabeza">
            <h3 id={`${grupo}-galeria`} ref={galeriaTituloRef} tabIndex={-1}>{tituloGaleria}</h3>
            <span>{cuentaGaleria}</span>
            <BarraComparar marcadas={comparar.length} onVer={() => ui.verComparacion(true)} />
          </div>
          {opciones.length === 0 ? (
            <EstadoVacio
              icono={<LayoutTemplate size={16} aria-hidden="true" />}
              titulo={busqueda ? "Ninguna lámina responde a esa búsqueda" : "Todavía no hay láminas de este grupo"}
            />
          ) : (
            <ul
              className="pulso-f6-tarjetas is-laminas"
              role="radiogroup"
              aria-labelledby={`${grupo}-galeria`}
              data-qa-geometry-group="graficos/f6-selector-lamina-tarjetas"
              data-qa-geometry-contract="equal"
              data-qa-geometry-capacity="owned"
            >
              {opciones.map((op) => {
                const t = tipoDeOpcion(op);
                const preset = presetDe(op);
                return (
                  <li key={op} data-qa-geometry-member>
                    <TarjetaTipoLamina
                      nombreGrupo={`${grupo}-candidato`}
                      opcion={op}
                      tipo={t}
                      nombre={nombreDe(op)}
                      clase={preset?.clase ?? "lamina"}
                      meta={preset?.grafico || preset?.clase === "resumen" ? "" : rotuloRanuras(t)}
                      uso={usoDe(op)}
                      glifo={preset?.grafico?.graficador}
                      graficos={graficosDe(op)}
                      variante={varianteInicial(op)}
                      elegida={op === candidato}
                      actual={esActual(op)}
                      sobrantes={cambios.get(op)?.mismoTipo ? 0 : cambios.get(op)?.sobrantes.length ?? 0}
                      onElegir={() => ui.elegirCandidato(op, varianteInicial(op))}
                      onAplicar={() => { if (op !== candidato) ui.elegirCandidato(op, varianteInicial(op)); else aplicar(); }}
                      comparar={{
                        marcada: comparar.includes(op),
                        puede: puedeEntrarEnComparacion(comparar, op),
                        onAlternar: () => ui.alternarComparar(op),
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      detalle={candidato && tarjetaCandidata ? (
        <DetalleTarjetaContar
          tarjeta={tarjetaCandidata}
          modo={modo}
          actual={candidato === tarjetaActual}
          cambio={cambio}
          confirmando={ui.confirmando}
          nombreGrafico={nombreG}
          nombreSlot={(s) => nombreSlot(s, slidesById[tarjetaCandidata.tipo] ?? metaOrigen)}
          nombreCampo={(c) => nombreCampo(c, metaOrigen)}
          ficha={fichaDe(candidato)}
          miniatura={miniaturas[candidato]}
          onAplicar={aplicar}
          onVolver={() => ui.setConfirmando(false)}
        />
      ) : candidato ? (
        <DetalleTipoLamina
          tipo={tipoDeOpcion(candidato)}
          nombre={nombreDe(candidato)}
          descripcion={presetDe(candidato)?.descripcion ?? slidesById[tipoDeOpcion(candidato)]?.descripcion ?? ""}
          graficos={graficosDe(candidato)}
          variantes={variantesDeTipo(candidato)}
          variante={variante}
          onVariante={(v) => { if (ui.candidato !== candidato) ui.elegirCandidato(candidato, v); else ui.elegirVariante(v); }}
          modo={modo}
          cambio={cambio}
          varianteActual={slide && candidato === opcionActual ? varianteDe(slide) : null}
          confirmando={ui.confirmando}
          nombreGrafico={nombreG}
          nombreSlot={(s) => nombreSlot(s, slidesById[tipoDeOpcion(candidato)] ?? metaOrigen)}
          nombreCampo={(c) => nombreCampo(c, metaOrigen)}
          ficha={fichaDe(candidato)}
          onAplicar={aplicar}
          onVolver={() => ui.setConfirmando(false)}
        />
      ) : (
        <EstadoVacio icono={<MousePointer2 size={16} aria-hidden="true" />} titulo="Elige una lámina para ver su detalle" />
      )}
    />
  );
}

type RegistroLaminas = ReturnType<typeof useGraficosRegistry>["slidesById"];

function nombreDeOpcion(op: OpcionLamina, slidesById: RegistroLaminas): string {
  return presetDe(op)?.nombre ?? nombreLamina(tipoDeOpcion(op), slidesById[tipoDeOpcion(op)]);
}

function usoDeOpcion(op: OpcionLamina, slidesById: RegistroLaminas): string {
  const t = tipoDeOpcion(op);
  return presetDe(op)?.uso ?? usoDeTarjeta(t, ESTANDAR_LAMINAS[t]?.uso, slidesById[t]?.descripcion);
}

const rotuloCuenta = (n: number): string => `${n} ${n === 1 ? "composición" : "composiciones"}`;
