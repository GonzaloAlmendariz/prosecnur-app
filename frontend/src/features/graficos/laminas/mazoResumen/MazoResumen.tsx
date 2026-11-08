// «Armar el resumen ejecutivo» (`panel=resumen-ejecutivo`; ADR 0135, maqueta graficos-sintesis, Mazo). Propone en
// orden las láminas de resumen que el estudio admite (modeloMazo.ts), una tarjeta por lámina, sin ninguna elegida: el
// analista marca las que quiere y las inserta en un solo paso de deshacer detrás de la lámina del foco (al final si el
// informe está vacío). Las láminas nacen sin título ni antetítulo: los escribe el analista.

import { useCallback, useId, useMemo, useRef, type RefObject } from "react";
import { ListChecks, Presentation } from "../../../../vendor/lucide-react";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { OverlayBase } from "../../../../components/Dialog";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";
import { ErrorBlock } from "../../../../components/States";
import { toast } from "../../../../components/toasterStore";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { usePlanStore } from "../../store";
import { destinoAlCerrarEnDocumento } from "../selectores/focoAlCerrar";
import { ResumenFranja } from "./ResumenFranja";
import { useMazoResumenUi } from "./mazoResumenStore";
import { deshacerInsercion } from "./deshacerMazo";
import { EdicionReglaMazo } from "./EdicionReglaMazo";
import { mensajeInsertadas, rotuloInsertar, unirPublicos } from "./modeloMazo";
import { PANEL_RESUMEN_EJECUTIVO } from "./panelResumen";
import { SeleccionMazo } from "./SeleccionMazo";
import { ListaTarjetasMazo } from "./ListaTarjetasMazo";
import { useMazoResumen } from "./useMazoResumen";
import "./mazoResumen.css";

/** El toast de la inserción dura más que uno de éxito: trae «Deshacer» y el analista tiene que alcanzar a verlo. */
const DURACION_DESHACER_MS = 8000;

type Props = {
  /** La lámina del foco: las nuevas van detrás de ella. `null` con el informe vacío (van al final). */
  posicion: number | null;
  /** Cierra el panel en una sola navegación y deja el foco en `posicion` (si se da). */
  cerrar: (posicion?: number) => void;
};

export function MazoResumen({ posicion, cerrar }: Props) {
  const panel = usePanelDireccionable(PANEL_RESUMEN_EJECUTIVO);
  const mazo = useMazoResumen(panel.abierto);
  const ui = useMazoResumenUi();
  // Se resuelve al cerrar, con la lámina que quedó en pantalla (quien abrió el panel pudo desmontarse).
  const retorno = useMemo<RefObject<HTMLElement>>(() => ({ get current() { return destinoAlCerrarEnDocumento(null); } }), []);

  const idLateral = `${useId()}-lateral`;
  const columna = useRef<HTMLDivElement>(null);
  const enEdicion = mazo.propuestas.find((p) => p.id === ui.editando && !p.falta);
  const graficadorEnEdicion = enEdicion?.graficador ?? null;
  // Al cerrar el lateral el foco vuelve al «Editar» de su tarjeta (el lateral se desmonta con el foco dentro).
  const cerrarEdicion = useCallback(() => {
    const id = useMazoResumenUi.getState().editando;
    useMazoResumenUi.getState().editar(null);
    if (!id) return;
    requestAnimationFrame(() => {
      const botones = columna.current?.querySelectorAll<HTMLElement>("[data-editar-mazo]") ?? [];
      Array.from(botones).find((b) => b.dataset.editarMazo === id)?.focus();
    });
  }, []);

  const n = mazo.elegidas.length;
  const sinEscala = mazo.publicos.length > 0 && mazo.publicos.every((b) => (mazo.escalas[b] ?? 0) === 0);
  const pidenDivide = mazo.elegidas.filter((p) => p.falta).length;

  const insertar = () => {
    const plan = usePlanStore.getState();
    const largoAntes = plan.plan.slides.length;
    const seleccionAntes = plan.selectedSlideId;
    const insercion = mazo.insertar(posicion);
    if (!insercion) return;
    const primera = (posicion ?? largoAntes) + 1;
    toast.exito(mensajeInsertadas(insercion.ids.length), {
      detalle: `Desde la lámina ${formatoConteo(primera)}.${pidenDivide ? " Aperturas internas pide la pregunta que divide en Datos." : ""}`,
      duracion: DURACION_DESHACER_MS,
      accion: { label: "Deshacer", onSelect: () => {
        deshacerInsercion(usePlanStore.getState(), insercion);
        if (seleccionAntes && usePlanStore.getState().plan.slides.some((s) => s.id === seleccionAntes)) usePlanStore.getState().select(seleccionAntes);
      } },
    });
    cerrar(primera);
  };

  const listo = !mazo.cargando;
  // Los vacíos y el error son terminales: publican su motivo, no `false`.
  const marca = mazo.error ? "vacio:error" : mazo.bases.length === 0 ? "vacio:sin-bases" : sinEscala ? "vacio:sin-escala"
    : mazo.propuestas.length === 0 ? "vacio:sin-laminas" : "graficos-resumen-ejecutivo";
  const cuerpo = mazo.error ? (
    <ErrorBlock label="No se pudieron leer las preguntas del estudio" detail={mazo.error} />
  ) : !listo ? (
    <CargaDeBloque label="Leyendo el estudio" />
  ) : mazo.bases.length === 0 ? (
    <EstadoVacio icono={<Presentation size={16} aria-hidden="true" />} titulo="El estudio todavía no tiene bases" />
  ) : sinEscala ? (
    <EstadoVacio icono={<ListChecks size={16} aria-hidden="true" />} titulo="Estos públicos no tienen preguntas de escala"
      descripcion="Las láminas de resumen leen preguntas de opción única con cuatro opciones o más." />
  ) : mazo.propuestas.length === 0 ? (
    <EstadoVacio icono={<Presentation size={16} aria-hidden="true" />} titulo="Este registro no ofrece láminas de resumen" />
  ) : (
    <>
    <SeleccionMazo elegidas={n} total={mazo.propuestas.length}
      onTodas={() => ui.elegirTodas(mazo.propuestas.map((p) => p.id))} onNinguna={ui.elegirNinguna} />
    <ListaTarjetasMazo
      propuestas={mazo.propuestas}
      elegidas={ui.elegidas}
      editando={ui.editando}
      scope={mazo.scope}
      idLateral={idLateral}
      onAlternar={ui.alternarElegida}
      onEditar={(id) => { if (ui.editando === id) cerrarEdicion(); else ui.editar(id); }}
      onOrdenar={ui.ordenarPropuestas}
    />
    </>
  );

  return (
    <OverlayBase
      variante={{ tipo: "dialogo", size: "lg", alto: "fijo" }}
      open={panel.abierto}
      onOpenChange={(abierto) => { if (!abierto) cerrar(); }}
      panelProps={panel.props}
      title="Armar el resumen ejecutivo"
      subtitle={mazo.publicos.length
        ? `${formatoConteo(mazo.propuestas.length)} ${mazo.propuestas.length === 1 ? "lámina propuesta" : "láminas propuestas"} con ${unirPublicos(mazo.publicos)}`
        : "Láminas de resumen propuestas con los datos del estudio"}
      icon={<Presentation size={16} aria-hidden="true" />}
      returnFocusTo={retorno}
      className="pulso-f6-mazo"
      flush
      stepper={listo && mazo.bases.length > 0 ? (
        <ResumenFranja
          abierta={ui.franjaAbierta}
          onAlternar={ui.alternarFranja}
          bases={mazo.bases}
          publicos={mazo.publicos}
          indicadores={mazo.indicadores}
          indicador={mazo.indicador}
          referencia={ui.referencia}
          onPublico={(b) => ui.alternarPublico(b, mazo.bases)}
          onMoverPublico={(desde, hasta) => ui.moverPublico(desde, hasta, mazo.bases)}
          onIndicador={ui.elegirIndicador}
          onReferencia={ui.ponerReferencia}
        />
      ) : undefined}
      footerStatus={posicion ? `Van después de la lámina ${formatoConteo(posicion)}` : "Van al final del informe"}
      footer={(
        <>
          <PulsoButton variant="secondary" onClick={() => cerrar()}>Cancelar</PulsoButton>
          <PulsoButton variant="primary" onClick={insertar} disabled={!listo || marca !== "graficos-resumen-ejecutivo" || n === 0}>{rotuloInsertar(n)}</PulsoButton>
        </>
      )}
    >
      {/* Dos columnas: las tarjetas (dueñas del vacío y de su scroll) y, al editar una regla, el lateral con el suyo. */}
      <div
        className={`pulso-f6-mazo-cuerpo${enEdicion && graficadorEnEdicion ? " is-editando" : ""}`}
        data-audit-ready={listo || mazo.error ? marca : "false"}
        data-qa-surface="graficos/resumen-ejecutivo"
        data-qa-geometry-group="graficos/f6-mazo-cuerpo"
        data-qa-geometry-contract="intrinsic"
      >
        <div ref={columna} className="pulso-f6-mazo-columna" data-qa-geometry-member data-qa-geometry-capacity="owned">
          {cuerpo}
        </div>
        {enEdicion && graficadorEnEdicion && (
          <EdicionReglaMazo
            id={idLateral}
            propuesta={{ ...enEdicion, graficador: graficadorEnEdicion }}
            scope={mazo.scope}
            onRegla={(r) => ui.ponerRegla(enEdicion.id, r)}
            onCerrar={cerrarEdicion}
          />
        )}
      </div>
    </OverlayBase>
  );
}
