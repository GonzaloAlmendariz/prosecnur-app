// Panel «Tipo de lámina» (`panel=tipo-lamina`; ADR 0135 §1, revisado por el ADR 0139). Izquierda, las familias de
// composiciones (tiposLamina.ts) y, al pie, las recomendaciones por pregunta del estudio, que señalan tipos del catálogo
// de gráficos (intencionesContar.ts); centro, las tarjetas; derecha, el detalle y el botón. Cada tarjeta dice su clase
// (Gráfico o Lámina). El buscador de la cabecera filtra todas las tarjetas por nombre y por lo que responden. Dos modos:
// cambiar la lámina del foco (conserva sus gráficos y avisa los que no caben o se reemplazan) o insertar una nueva
// detrás de ella, elegidos en el segmentado de la cabecera. Una tarjeta es un tipo o un tipo con su payload de partida
// (opcionesLamina.ts). El detalle trae la ficha «Datos» (qué usa el gráfico y qué tiene el estudio) y «Comparar» pone
// dos tarjetas lado a lado dentro del mismo diálogo.

// Hojas del selector en el orden de la cascada que tenían en una sola hoja: estas importaciones van antes que los
// componentes para que el bundle las emita en este orden aunque un hijo (HuecoMiniatura) se evalúe antes que el diálogo.
import "./selectores.css";
import "./controlModo.css";
import "./fichaDatos.css";
import "./comparar.css";
import "./huecoMiniatura.css";

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
import { fraseTarjetaContar, usoDeTarjeta } from "./detalleLamina";
import { DialogoSelector } from "./DialogoSelector";
import { destinoAlCerrarEnDocumento } from "./focoAlCerrar";
import { nombreCampo, nombreGrafico, nombreLamina, nombreSlot } from "./etiquetas";
import { PANEL_TIPO_LAMINA } from "./panelesSelectores";
import { MODO_LAMINA_POR_DEFECTO, useSelectoresUi } from "./selectoresStore";
import { TarjetaTipoLamina } from "./TarjetaTipoLamina";
import { conVariante, INTENCIONES, intencionDe, rotuloRanuras, USA_SIN_GRAFICO, varianteDe, variantesDe, type IntencionLamina } from "./tiposLamina";
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
import { escalaDominante, indicadoresDelEstudio } from "../mazoResumen/modeloMazo";

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
  // R5-2: el indicador por defecto del estudio (Top Two Box de su escala dominante, el mismo del mazo). Sin él, el
  // panorama, el contraste y las fortalezas nacen sin `corte` y no se dibujan.
  const indicador = indicadoresDelEstudio(escalaDominante(sources, sources.map((s) => s.name)))[0] ?? null;
  // Por contenido: `sources` cambia de identidad sin cambiar de escala.
  const firmaIndicador = JSON.stringify(indicador ? { etiqueta: indicador.etiqueta, codigos: indicador.codigos } : null);
  const estudio = useMemo<EstudioDelSelector>(() => ({
    bases: nombresBases ? nombresBases.split("|") : [], baseActiva, padron,
    indicador: JSON.parse(firmaIndicador) as EstudioDelSelector["indicador"],
  }), [nombresBases, baseActiva, padron, firmaIndicador]);

  const modo = modoEfectivo(ui.modoLamina, !!slide);
  const tipoActual = modo === "cambiar" && slide ? slide.tipo : null;
  const opcionActual: OpcionLamina | null = modo === "cambiar" && slide ? opcionDeLamina(slide) : null;
  const tarjetaActual: OpcionLamina | null = modo === "cambiar" && slide ? tarjetaContarDeLamina(slide)?.clave ?? null : null;
  const intencion: IntencionLamina = ui.intencion ?? (tipoActual ? intencionDe(tipoActual) : null) ?? "una";
  // ADR 0139: abre en los tipos de lámina; sólo al cambiar una lámina que ya es una recomendación abre en ésta.
  const porTipo = ui.porTipo ?? !(modo === "cambiar" && !!tarjetaActual);
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
    inventario: ui.inventario, estudio, scope, activo: panel.abierto, fuentes: sources,
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
  const cuentaGaleria = busqueda
    ? `${formatoConteo(opciones.length)} ${opciones.length === 1 ? "resultado" : "resultados"}`
    : !porTipo ? `${formatoConteo(opciones.length)} ${opciones.length === 1 ? "recomendación" : "recomendaciones"}`
    : conGraficos ? `${rotuloCuenta(opciones.length)}, con los gráficos de esta lámina` : rotuloCuenta(opciones.length);
  const tarjetaCandidata = tarjetaContar(candidato);
  // S1: el `usa` de la tarjeta manda sobre el del graficador cuando la composición lo exige.
  const usaDe = (op: OpcionLamina) => usaDeTarjeta(presetDe(op));
  // R14-4: la tarjeta de la familia «Hallazgos» (sin preset) y la recomendación leen el mismo USA_SIN_GRAFICO.
  const sinGraficoDe = (op: OpcionLamina) => presetDe(op)?.usaSinGrafico ?? USA_SIN_GRAFICO[tipoDeOpcion(op)];
  const fichaDe = (op: OpcionLamina): ReactNode => {
    const usa = usaDe(op);
    if (usa) return <FichaDatosTarjeta usa={usa} inventario={ui.inventario} />;
    const sinGrafico = sinGraficoDe(op);
    return sinGrafico ? <FichaDatosCierre usa={sinGrafico} laminasResumen={laminasResumen} /> : null;
  };
  const columnaComparar = (op: OpcionLamina): ColumnaComparar => {
    const preset = presetDe(op);
    const t = tipoDeOpcion(op);
    const c = cambios.get(op);
    return {
      opcion: op, tipo: t, nombre: nombreDe(op), clase: preset?.clase ?? "lamina", glifo: preset?.grafico?.graficador,
      usa: usaDe(op), usaSinGrafico: sinGraficoDe(op), admite: rotuloRanuras(t), actual: esActual(op), sobrantes: c && !c.mismoTipo ? c.sobrantes.length : 0,
      miniatura: miniaturas[op],
    };
  };

  return (
    <DialogoSelector
      abierto={panel.abierto}
      onCerrar={() => cerrarYOlvidar()}
      panelProps={panel.props}
      auditReady="f6-selector-lamina"
      antetitulo={modo === "insertar"
        ? (posicion ? { texto: "Insertar después de la", corto: "Tras la", fijo: `lámina ${posicion}` } : "Primera lámina del informe")
        : `Lámina ${posicion}`}
      titulo="Tipo de lámina"
      descripcion={modo === "insertar"
        ? "Elige una composición o una recomendación de gráficos."
        : "Los gráficos que ya configuraste pasan a la lámina nueva."}
      focoInicialRef={focoInicialRef}
      destinoAlCerrar={() => destinoAlCerrarEnDocumento(null)}
      modo={<ControlModoLamina modo={modo} hayLamina={!!slide} onModo={(m) => ui.cambiarModoLamina(m)} />}
      // R9-19: en «Comparar», Escape vuelve a la lista; no cierra el selector entero.
      alEscape={viendo ? () => ui.verComparacion(false) : undefined}
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
          {/* Un solo grupo de radios en dos fieldsets: las flechas recorren familias y recomendaciones seguidas. */}
          <fieldset className="pulso-f6-opciones">
            <legend className="pulso-f6-selector-leyenda">Tipo de lámina</legend>
            {intenciones.map((i) => (
              <label key={i.id} className="pulso-f6-opcion" data-familia-lamina={i.id}>
                <input
                  ref={porTipo && i.id === intencion ? focoInicialRef : undefined}
                  type="radio"
                  className="pulso-f6-radio-oculto"
                  name={`${grupo}-vista`}
                  value={`tipo:${i.id}`}
                  checked={porTipo && i.id === intencion}
                  disabled={i.tipos.length === 0}
                  onChange={() => ui.elegirIntencion(i.id)}
                />
                <strong>{i.label}</strong>
                <span className="pulso-f6-opcion-cuenta">{formatoConteo(opcionesDe(i).length)}</span>
                <span>{i.descripcion}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="pulso-f6-opciones is-recomendaciones">
            <legend className="pulso-f6-selector-leyenda">Recomendaciones</legend>
            {contarOfrecidas.map((i) => (
              <label key={i.id} className="pulso-f6-opcion" data-intencion-contar={i.id}>
                <input
                  ref={!porTipo && i.id === contar ? focoInicialRef : undefined}
                  type="radio"
                  className="pulso-f6-radio-oculto"
                  name={`${grupo}-vista`}
                  value={`rec:${i.id}`}
                  checked={!porTipo && i.id === contar}
                  disabled={i.lista.length === 0}
                  onChange={() => ui.elegirContar(i.id)}
                />
                <strong>{i.nombre}</strong>
                <span className="pulso-f6-opcion-cuenta">{formatoConteo(i.lista.length)}</span>
                <span>{i.ayuda}</span>
              </label>
            ))}
          </fieldset>
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
                      meta={preset?.grafico || sinGraficoDe(op) ? "" : rotuloRanuras(t)}
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
          frase={fraseTarjetaContar(tarjetaCandidata, slidesById[tarjetaCandidata.tipo]?.descripcion)}
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
