// «Armar el resumen ejecutivo» (`panel=resumen-ejecutivo`; ADR 0135, maqueta graficos-sintesis, Mazo). Propone en
// orden las láminas de resumen que el estudio admite (modeloMazo.ts), una tarjeta por lámina, y las inserta todas en un
// solo paso de deshacer detrás de la lámina del foco (al final si el informe está vacío). Los títulos quedan por
// escribir: los escribe el analista.

import { useMemo, type RefObject } from "react";
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
import { FranjaMazo } from "./FranjaMazo";
import { useMazoResumenUi } from "./mazoResumenStore";
import { rotuloInsertar, unirPublicos } from "./modeloMazo";
import { PANEL_RESUMEN_EJECUTIVO } from "./panelResumen";
import { TarjetaMazo } from "./TarjetaMazo";
import { useMazoResumen } from "./useMazoResumen";
import "./mazoResumen.css";

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

  const n = mazo.incluidas.length;
  const sinEscala = mazo.publicos.length > 0 && mazo.publicos.every((b) => (mazo.escalas[b] ?? 0) === 0);
  const pidenDivide = mazo.incluidas.filter((p) => p.falta).length;

  const insertar = () => {
    const plan = usePlanStore.getState();
    const largoAntes = plan.plan.slides.length;
    const seleccionAntes = plan.selectedSlideId;
    const nuevas = mazo.insertar(posicion);
    if (!nuevas.length) return;
    const primera = (posicion ?? largoAntes) + 1;
    toast.exito(`${nuevas.length === 1 ? "1 lámina insertada" : `${formatoConteo(nuevas.length)} láminas insertadas`} desde la lámina ${formatoConteo(primera)}`, {
      detalle: pidenDivide ? "Aperturas internas pide la pregunta que divide en Datos." : "Los títulos quedan por escribir.",
      accion: { label: "Deshacer", onSelect: () => {
        usePlanStore.getState().undo();
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
    <ul
      className="pulso-f6-mazo-tarjetas"
      aria-label="Láminas propuestas"
      data-qa-geometry-group="graficos/f6-mazo-tarjetas"
      data-qa-geometry-contract="equal"
      data-qa-geometry-capacity="owned"
    >
      {mazo.propuestas.map((p, i) => (
        <li key={p.id} data-qa-geometry-member>
          <TarjetaMazo
            numero={i + 1}
            propuesta={p}
            incluida={!mazo.quitadas.has(p.id)}
            editando={ui.editando === p.id}
            scope={mazo.scope}
            onAlternar={() => ui.alternarQuitada(p.id)}
            onEditar={() => ui.editar(ui.editando === p.id ? null : p.id)}
            onRegla={(r) => ui.ponerRegla(p.id, r)}
          />
        </li>
      ))}
    </ul>
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
      stepper={listo && mazo.bases.length > 0 ? (
        <FranjaMazo
          bases={mazo.bases}
          publicos={mazo.publicos}
          indicadores={mazo.indicadores}
          indicador={mazo.indicador}
          referencia={ui.referencia}
          onPublico={(b) => ui.alternarPublico(b, mazo.bases)}
          onMoverPublico={(b, d) => ui.moverPublico(b, d, mazo.bases)}
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
      <div
        className="pulso-f6-mazo-cuerpo"
        data-audit-ready={listo || mazo.error ? marca : "false"}
        data-qa-surface="graficos/resumen-ejecutivo"
      >
        {cuerpo}
      </div>
    </OverlayBase>
  );
}
