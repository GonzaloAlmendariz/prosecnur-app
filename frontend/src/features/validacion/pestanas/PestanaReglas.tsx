/**
 * Pestaña Reglas de Validación (plan de fidelidad, rebanada V1; prototipo
 * `validacion-reglas`): la mesa del catálogo de reglas (`reglas/lista/`) y el
 * panel de regla propia (`reglas/panel/`, `panel=regla`), más los paneles del
 * operativo (`panel=operativo`, `panel=roles`).
 *
 * Reemplaza el montaje de transición de la rebanada V2 de P6, que apilaba el
 * plan del formulario (`instrumento/PlanDelFormulario.tsx`) y las reglas propias
 * (`tabs/ReglasCustomTab.tsx`). Lo que hacían está en la mesa: el plan en "Más
 * acciones" y en el vacío "Leer el formulario", los controles del operativo y
 * los roles en sus paneles, la lista y el interruptor de las propias en su
 * familia, las sugeridas bajo la lista de las propias y "Ejecutar" en "Auditar".
 *
 * Readiness: la marca de la pestaña va en la raíz; mientras el catálogo se lee,
 * la carga de bloque del kit (`CargaDeBloque`, en el esqueleto de la mesa) la
 * retiene.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { preguntasDelCatalogo } from "../reglas/panel/useCatalogoDeReglas";
import { PanelRegla, type AlGuardarRegla } from "../reglas/panel/PanelRegla";
import { FOCO_NUEVA, searchSinPanelRegla, usePanelRegla } from "../reglas/panel/usePanelRegla";
import { comoReglaPropia } from "../reglas/tiposDelMotor";
import { MesaDeReglas } from "../reglas/lista/MesaDeReglas";
import { PanelesDelOperativo } from "../reglas/lista/PanelesDelOperativo";
import { useMesaDeReglas } from "../reglas/lista/useMesaDeReglas";
import "../reglas/lista/lista.css";
import { useInstrumento } from "../instrumento/useInstrumento";
import { searchDePestana, usePestanaValidacion } from "../pestanaDireccionable";
import { useValidacionStore } from "../store";
import type { ExploradorVariable, ReglaSemilla } from "../types";

export default function PestanaReglas() {
  // El plan del formulario y los controles del operativo: Reglas no dibuja la auditoría.
  const inst = useInstrumento({ conAuditoria: false });
  const { irAPestana } = usePestanaValidacion();
  const bumpVersion = useValidacionStore((s) => s.bumpVersion);
  const setPrefill = useValidacionStore((s) => s.setPrefill);
  const panel = usePanelRegla();
  const location = useLocation();
  const navigate = useNavigate();
  const mesa = useMesaDeReglas({
    // "Guardar y auditar" en el panel: al terminar, a Hallazgos (como desde la rebanada V2).
    alTerminarAuditoriaDelPanel: () => {
      bumpVersion();
      irAPestana("hallazgos", { source: "reglas_custom", at: Date.now() });
    },
  });

  // El inventario compartido (`inventarioDeBase.ts`) vale mientras la pestaña
  // está montada: al salir se olvida, para no servir uno viejo si Carga cambió
  // las variables entretanto.
  const setInventario = useValidacionStore((s) => s.setInventario);
  useEffect(() => () => setInventario(null), [setInventario]);

  const lista = mesa.lectura.fase === "lista" ? mesa.lectura : null;
  const { inventario, propias: propiasLeidas, semillas } = mesa.complementos;
  const variables = useMemo<ExploradorVariable[]>(() => {
    if (inventario) return inventario.secciones.flatMap((s) => s.variables.map((v) => ({ ...v, seccion: s.nombre })));
    return lista ? preguntasDelCatalogo(lista.catalogoDelPanel) : [];
  }, [inventario, lista]);

  const propias = propiasLeidas ?? [];
  // La sugerida con que se abre el panel desde "Añadir"; se olvida al cerrarlo.
  const [sugeridaDelPanel, setSugeridaDelPanel] = useState<ReglaSemilla | null>(null);
  useEffect(() => {
    if (!panel.abierto) setSugeridaDelPanel(null);
  }, [panel.abierto]);
  const enEdicion = panel.abierto && panel.foco && panel.foco !== FOCO_NUEVA
    ? propias.find((r) => r.id === panel.foco) ?? null
    : null;
  const guardar: AlGuardarRegla = async (cuerpo, opciones) => {
    await mesa.guardarDesdeElPanel(cuerpo, opciones);
    panel.cerrar();
  };

  return (
    <div className="pulso-validacion-pestana-reglas" data-audit-ready="validacion-reglas">
      <MesaDeReglas
        mesa={mesa}
        inst={inst}
        panel={panel}
        irAPestana={irAPestana}
        onAnadirSugerida={(semilla) => {
          setSugeridaDelPanel(semilla);
          panel.abrirNueva();
        }}
      />
      <PanelesDelOperativo
        inst={inst}
        onReleer={() => {
          void mesa.leerFormulario(inst.onBuildPlan);
        }}
      />
      <PanelRegla
        abierto={panel.abierto}
        onCerrar={panel.cerrar}
        inicial={enEdicion ? comoReglaPropia(enEdicion) : null}
        focoInexistente={propiasLeidas !== undefined && panel.abierto && panel.foco && panel.foco !== FOCO_NUEVA && !enEdicion ? panel.foco : null}
        cargandoPreguntas={!lista && inventario === undefined}
        tipoElegido={panel.tipo}
        pregunta={panel.pregunta}
        onElegirTipo={panel.elegirTipo}
        variables={variables}
        baseNombre={mesa.baseNombre}
        semillas={semillas ?? []}
        nombresEnUso={propias.map((r) => r.nombre)}
        onGuardar={guardar}
        semillaInicial={sugeridaDelPanel}
        onEliminar={enEdicion ? async () => {
          await mesa.eliminarPropia(enEdicion.id);
          panel.cerrar();
        } : undefined}
        onVerEnExplorar={(variable) => {
          // A Explorar sin el panel ni lo que solo él usa (`tipo`, `pregunta`).
          setPrefill("explorar", { var: variable });
          navigate({ pathname: location.pathname, search: searchDePestana(searchSinPanelRegla(location.search), "explorar") });
        }}
        panelProps={panel.props}
        onVerSinEvaluar={() =>
          navigate({
            pathname: location.pathname,
            search: searchDePestana(searchSinPanelRegla(location.search), "reglas", { familia: "sin-evaluar" }),
          })
        }
      />
    </div>
  );
}
