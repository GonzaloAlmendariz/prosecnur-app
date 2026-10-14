// Panel «¿Qué lámina?» (`panel=tipo-lamina`; dirección F6 §4.3). Izquierda, la pregunta del analista (intenciones);
// centro, las composiciones candidatas dibujadas desde el estándar con los gráficos de la lámina del foco acomodados;
// derecha, el detalle y el botón. Dos modos: cambiar el tipo de la lámina del foco (conserva sus gráficos y avisa los
// que no caben) o insertar una lámina nueva detrás de ella.

import { useEffect, useId, useMemo, useRef } from "react";
import type { GraficadorRef, Slide, SlideType } from "../../../../api/graficos";
import { toast } from "../../../../components/toasterStore";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { CATALOGO_LAMINAS } from "../../iconos/catalogoTipos.generated";
import { ESTANDAR_LAMINAS } from "../../iconos/estandarLaminas.generated";
import { BASE_DERIVADA } from "../../iconos/composicion";
import { payloadPorDefecto, usePlanStore } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { graficosDeLamina, graficosPorSlot, planearCambioTipo, requiereConfirmacion, type CambioTipoLamina } from "./cambioTipoLamina";
import { DetalleTipoLamina } from "./DetalleTipoLamina";
import { usoDeTarjeta } from "./detalleLamina";
import { DialogoSelector } from "./DialogoSelector";
import { destinoAlCerrarEnDocumento } from "./focoAlCerrar";
import { nombreCampo, nombreGrafico, nombreLamina, nombreSlot } from "./etiquetas";
import { PANEL_TIPO_LAMINA } from "./panelesSelectores";
import { useSelectoresUi } from "./selectoresStore";
import { TarjetaTipoLamina } from "./TarjetaTipoLamina";
import { conVariante, INTENCIONES, intencionDe, rotuloRanuras, varianteDe, variantesDe, type IntencionLamina } from "./tiposLamina";

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
  const intencion: IntencionLamina = ui.intencion ?? (tipoActual ? intencionDe(tipoActual) : null) ?? "una";

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
  const tipos = useMemo(() => intenciones.find((i) => i.id === intencion)?.tipos ?? [], [intenciones, intencion]);
  const candidato: SlideType | null = ui.candidato ?? (tipoActual && tipos.includes(tipoActual) ? tipoActual : tipos[0] ?? null);

  const cambios = useMemo(() => {
    const m = new Map<SlideType, CambioTipoLamina>();
    if (modo !== "cambiar" || !slide) return m;
    for (const t of tipos) m.set(t, planearCambioTipo(slide, t, { clavesDestino: slidesById[t]?.args.map((a) => a.name) }));
    return m;
  }, [modo, slide, tipos, slidesById]);
  const conGraficos = modo === "cambiar" && !!slide && graficosDeLamina(slide).length > 0;

  const variantesDeTipo = (t: SlideType) => {
    const arg = slidesById[t]?.args.find((a) => a.name === "variante");
    return variantesDe(t, arg?.choices);
  };
  const varianteInicial = (t: SlideType): string | null =>
    slide && t === tipoActual ? varianteDe(slide) : variantesDeTipo(t)?.defecto ?? null;
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
    const nombre = nombreLamina(candidato, slidesById[candidato]);
    if (modo === "insertar") {
      const base = { tipo: candidato, payload: payloadPorDefecto(candidato) };
      const payload = variante ? conVariante(base, variante) : base.payload;
      const indice = posicion ?? usePlanStore.getState().plan.slides.length;
      insertSlideAt(candidato, payload, indice);
      toast.exito(`Lámina ${indice + 1} insertada: ${nombre}`);
      cerrarYOlvidar(indice + 1);
      return;
    }
    if (!slide || !cambio || posicion === null) return;
    if (requiereConfirmacion(cambio, ui.confirmando)) {
      ui.setConfirmando(true);
      return;
    }
    const payload = variante && variantesDeTipo(candidato)
      ? conVariante({ tipo: candidato, payload: cambio.payload }, variante)
      : cambio.payload;
    const id = slide.id;
    setSlideTipo(id, candidato, payload);
    const quitados = cambio.sobrantes.length;
    toast.aviso(
      cambio.mismoTipo ? `Lámina ${posicion}: otra composición` : `Lámina ${posicion}: ahora es «${nombre}»`,
      {
        detalle: quitados
          ? `${quitados === 1 ? "Se quitó 1 gráfico" : `Se quitaron ${quitados} gráficos`} que no cabían.`
          : cambio.conservados.length ? "Sus gráficos se conservaron." : undefined,
        accion: { label: "Deshacer", onSelect: () => { undo(); select(id); } },
      },
    );
    cerrarYOlvidar(posicion);
  };

  const graficosDe = (t: SlideType): Record<string, string> => {
    const c = cambios.get(t);
    return c ? graficosPorSlot(c) : {};
  };
  const nombreG = (g: GraficadorRef) => nombreGrafico(g, graficadoresById);
  const metaOrigen = slide ? slidesById[slide.tipo] : undefined;

  return (
    <DialogoSelector
      abierto={panel.abierto}
      onCerrar={() => cerrarYOlvidar()}
      panelProps={panel.props}
      auditReady="f6-selector-lamina"
      antetitulo={modo === "insertar" ? (posicion ? `Insertar después de la lámina ${posicion}` : "Primera lámina del informe") : `Lámina ${posicion}`}
      titulo="¿Qué lámina?"
      descripcion={modo === "insertar"
        ? "Elige qué quieres mostrar y la composición que lo resuelve."
        : "Cambia la composición: los gráficos que ya configuraste pasan a la lámina nueva."}
      focoInicialRef={focoInicialRef}
      destinoAlCerrar={() => destinoAlCerrarEnDocumento(null)}
      pregunta={(
        <fieldset className="pulso-f6-opciones">
          <legend className="pulso-f6-selector-leyenda">¿Qué quieres mostrar?</legend>
          {intenciones.map((i) => (
            <label key={i.id} className="pulso-f6-opcion">
              <input
                ref={i.id === intencion ? focoInicialRef : undefined}
                type="radio"
                className="pulso-f6-radio-oculto"
                name={`${grupo}-intencion`}
                value={i.id}
                checked={i.id === intencion}
                disabled={i.tipos.length === 0}
                onChange={() => ui.elegirIntencion(i.id)}
              />
              <strong>{i.label}</strong>
              <span className="pulso-f6-opcion-cuenta">{i.tipos.length}</span>
              <span>{i.descripcion}</span>
            </label>
          ))}
        </fieldset>
      )}
      galeria={(
        <section aria-labelledby={`${grupo}-galeria`}>
          <div className="pulso-f6-galeria-cabeza">
            <h3 id={`${grupo}-galeria`}>{intenciones.find((i) => i.id === intencion)?.label}</h3>
            <span>{conGraficos ? `${rotuloCuenta(tipos.length)}, con los gráficos de esta lámina` : rotuloCuenta(tipos.length)}</span>
          </div>
          {tipos.length === 0 ? (
            <p className="pulso-f6-selector-vacio" data-qa-geometry-capacity="owned">Este backend todavía no ofrece láminas de este grupo.</p>
          ) : (
            <ul
              className="pulso-f6-tarjetas is-laminas"
              role="radiogroup"
              aria-labelledby={`${grupo}-galeria`}
              data-qa-geometry-group="graficos/f6-selector-lamina-tarjetas"
              data-qa-geometry-contract="equal"
              data-qa-geometry-capacity="owned"
            >
              {tipos.map((t) => (
                <li key={t} data-qa-geometry-member>
                  <TarjetaTipoLamina
                    nombreGrupo={`${grupo}-candidato`}
                    tipo={t}
                    nombre={nombreLamina(t, slidesById[t])}
                    meta={rotuloRanuras(t)}
                    uso={usoDeTarjeta(t, ESTANDAR_LAMINAS[t]?.uso, slidesById[t]?.descripcion)}
                    graficos={graficosDe(t)}
                    variante={varianteInicial(t)}
                    elegida={t === candidato}
                    actual={t === tipoActual}
                    sobrantes={cambios.get(t)?.mismoTipo ? 0 : cambios.get(t)?.sobrantes.length ?? 0}
                    onElegir={() => ui.elegirCandidato(t, varianteInicial(t))}
                    onAplicar={() => { if (t !== candidato) ui.elegirCandidato(t, varianteInicial(t)); else aplicar(); }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      detalle={candidato ? (
        <DetalleTipoLamina
          tipo={candidato}
          nombre={nombreLamina(candidato, slidesById[candidato])}
          descripcion={slidesById[candidato]?.descripcion ?? ""}
          graficos={graficosDe(candidato)}
          variantes={variantesDeTipo(candidato)}
          variante={variante}
          onVariante={(v) => { if (ui.candidato !== candidato) ui.elegirCandidato(candidato, v); else ui.elegirVariante(v); }}
          modo={modo}
          cambio={cambio}
          varianteActual={slide && candidato === tipoActual ? varianteDe(slide) : null}
          confirmando={ui.confirmando}
          nombreGrafico={nombreG}
          nombreSlot={(s) => nombreSlot(s, slidesById[candidato] ?? metaOrigen)}
          nombreCampo={(c) => nombreCampo(c, metaOrigen)}
          onAplicar={aplicar}
          onVolver={() => ui.setConfirmando(false)}
        />
      ) : (
        <p className="pulso-f6-selector-vacio" data-qa-geometry-capacity="owned">Elige una composición para ver su detalle.</p>
      )}
    />
  );
}

const rotuloCuenta = (n: number): string => `${n} ${n === 1 ? "composición" : "composiciones"}`;
