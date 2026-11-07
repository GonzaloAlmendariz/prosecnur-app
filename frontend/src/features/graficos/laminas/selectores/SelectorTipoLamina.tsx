// Panel «¿Qué quieres contar?» (`panel=tipo-lamina`; ADR 0135 §1, maqueta graficos-sintesis «Main»). Izquierda, la
// pregunta del estudio (intencionesContar.ts) y, al pie, «Ver por tipo de gráfico» con las familias de siempre
// (tiposLamina.ts); centro, las tarjetas; derecha, el detalle y el botón. Cada tarjeta dice su clase (Gráfico, Lámina o
// Lámina de resumen). El buscador de la cabecera filtra todas las tarjetas por nombre y por lo que responden. Dos modos:
// cambiar la lámina del foco (conserva sus gráficos y avisa los que no caben o se reemplazan) o insertar una nueva
// detrás de ella. Una tarjeta es un tipo o un tipo con su payload de partida (opcionesLamina.ts).

import { LayoutTemplate, MousePointer2, Search } from "../../../../vendor/lucide-react";
import { useEffect, useId, useMemo, useRef } from "react";
import type { GraficadorRef, Slide } from "../../../../api/graficos";
import { toast } from "../../../../components/toasterStore";
import { PulsoInput } from "../../../../components/PulsoInput";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { CATALOGO_GRAFICOS, CATALOGO_LAMINAS } from "../../iconos/catalogoTipos.generated";
import { ESTANDAR_LAMINAS } from "../../iconos/estandarLaminas.generated";
import { BASE_DERIVADA } from "../../iconos/composicion";
import { payloadPorDefecto, usePlanStore } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { graficosDeLamina, graficosPorSlot, planearCambioTipo, requiereConfirmacion, type CambioTipoLamina } from "./cambioTipoLamina";
import { DetalleTarjetaContar } from "./DetalleTarjetaContar";
import { DetalleTipoLamina } from "./DetalleTipoLamina";
import { usoDeTarjeta } from "./detalleLamina";
import { DialogoSelector } from "./DialogoSelector";
import { destinoAlCerrarEnDocumento } from "./focoAlCerrar";
import { nombreCampo, nombreGrafico, nombreLamina, nombreSlot } from "./etiquetas";
import { PANEL_TIPO_LAMINA } from "./panelesSelectores";
import { useSelectoresUi } from "./selectoresStore";
import { TarjetaTipoLamina } from "./TarjetaTipoLamina";
import { conVariante, INTENCIONES, intencionDe, rotuloRanuras, varianteDe, variantesDe, type IntencionLamina } from "./tiposLamina";
import { cambioConOpcion, conOpcion, opcionDeLamina, opcionesDe, presetDe, tipoDeOpcion, type OpcionLamina } from "./opcionesLamina";
import {
  casaBusqueda, INTENCIONES_CONTAR, intencionDeTarjeta, tarjetaContar, tarjetaContarDeLamina, tarjetasDe, type IntencionContarId,
} from "./intencionesContar";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { formatoConteo } from "../../../../lib/formatoNumero";

const FUERA_DEL_CATALOGO = new Set(CATALOGO_LAMINAS.filter((s) => !s.en_selector).map((s) => s.name));

type Props = {
  /** Lámina del foco (null con el informe vacío: sólo se puede insertar). */
  slide: Slide | null;
  posicion: number | null;
  /** Cierra el panel en una sola navegación y deja el foco en `posicion` (si se da). */
  cerrar: (posicion?: number) => void;
};

export function SelectorTipoLamina({ slide, posicion, cerrar }: Props) {
  const panel = usePanelDireccionable(PANEL_TIPO_LAMINA);
  const { slidesById, graficadoresById, registry } = useGraficosRegistry();
  const ui = useSelectoresUi();
  const setSlideTipo = usePlanStore((s) => s.setSlideTipo);
  const insertSlideAt = usePlanStore((s) => s.insertSlideAt);
  const undo = usePlanStore((s) => s.undo);
  const select = usePlanStore((s) => s.select);
  const grupo = useId();
  const focoInicialRef = useRef<HTMLInputElement>(null);

  const modo = ui.modoLamina === "cambiar" && slide ? "cambiar" : "insertar";
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

  const cambios = useMemo(() => {
    const m = new Map<OpcionLamina, CambioTipoLamina>();
    if (modo !== "cambiar" || !slide) return m;
    const actual = opcionDeLamina(slide);
    const tarjeta = tarjetaContarDeLamina(slide)?.clave ?? null;
    for (const op of opciones) {
      const t = tipoDeOpcion(op);
      const c = planearCambioTipo(slide, t, { clavesDestino: slidesById[t]?.args.map((a) => a.name) });
      // Otra tarjeta del mismo tipo (Hallazgos clave ⇄ Hallazgos por capítulo, Panorama ⇄ Contraste) es un cambio, con
      // su payload de partida; si trae otro gráfico, el de antes se avisa como sobrante.
      m.set(op, op === actual || op === tarjeta ? c : cambioConOpcion(op, c));
    }
    return m;
  }, [modo, slide, opciones, slidesById]);
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

  // Cerrar por fuera (Escape, velo, otro enlace) deja el selector listo para la próxima vez.
  useEffect(() => {
    if (!panel.abierto) useSelectoresUi.getState().setConfirmando(false);
  }, [panel.abierto]);

  const cerrarYOlvidar = (pos?: number) => {
    useSelectoresUi.getState().prepararLamina("cambiar");
    cerrar(pos);
  };

  const aplicar = () => {
    if (!candidato) return;
    const tipo = tipoDeOpcion(candidato);
    const nombre = nombreDe(candidato);
    if (modo === "insertar") {
      const base = { tipo, payload: conOpcion(candidato, payloadPorDefecto(tipo)) };
      const payload = variante ? conVariante(base, variante) : base.payload;
      const indice = posicion ?? usePlanStore.getState().plan.slides.length;
      insertSlideAt(tipo, payload, indice);
      toast.exito(`Lámina ${indice + 1} insertada: ${nombre}`);
      cerrarYOlvidar(indice + 1);
      return;
    }
    if (!slide || !cambio || posicion === null || candidato === tarjetaActual) return;
    if (requiereConfirmacion(cambio, ui.confirmando)) {
      ui.setConfirmando(true);
      return;
    }
    const payload = variante && variantesDeTipo(candidato)
      ? conVariante({ tipo, payload: cambio.payload }, variante)
      : cambio.payload;
    const id = slide.id;
    setSlideTipo(id, tipo, payload);
    const quitados = cambio.sobrantes.length;
    toast.aviso(
      cambio.mismoTipo ? `Lámina ${posicion}: otra composición` : `Lámina ${posicion}: ahora es “${nombre}”`,
      {
        detalle: quitados
          ? `${quitados === 1 ? "Se quitó 1 gráfico" : `Se quitaron ${quitados} gráficos`} que no cabían.`
          : cambio.conservados.length ? "Sus gráficos se conservaron." : undefined,
        accion: { label: "Deshacer", onSelect: () => { undo(); select(id); } },
      },
    );
    cerrarYOlvidar(posicion);
  };

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
            <h3 id={`${grupo}-galeria`}>{tituloGaleria}</h3>
            <span>{cuentaGaleria}</span>
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
                      meta={preset?.grafico ? "" : rotuloRanuras(t)}
                      uso={usoDe(op)}
                      glifo={preset?.grafico?.graficador}
                      graficos={graficosDe(op)}
                      variante={varianteInicial(op)}
                      elegida={op === candidato}
                      actual={esActual(op)}
                      sobrantes={cambios.get(op)?.mismoTipo ? 0 : cambios.get(op)?.sobrantes.length ?? 0}
                      onElegir={() => ui.elegirCandidato(op, varianteInicial(op))}
                      onAplicar={() => { if (op !== candidato) ui.elegirCandidato(op, varianteInicial(op)); else aplicar(); }}
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
