import { useEffect, useMemo } from "react";

import type { CollectionStatePayload } from "../../../api/recopiladores";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { AlertTriangle, LayoutGrid, Pencil, RefreshCw } from "../../../vendor/lucide-react";
import { PanelCard } from "../../xlsformEditor/kit";
import { catalogoVisible } from "./estadoCatalogo";
import { FiltroDeFamilias } from "./FiltroDeFamilias";
import { InspectorDeTipo } from "./InspectorDeTipo";
import {
  claveDeVista,
  familiasDelCatalogo,
  filtrarPorFamilia,
  motivoIncompatible,
  paginasDeLaTarjeta,
  paginasDelTipo,
} from "./modeloCatalogo";
import { TarjetaDeTipo } from "./TarjetaDeTipo";
import { useCatalogoDeMateriales } from "./useCatalogoDeMateriales";
import "./catalogoTipos.css";

export const DIRECCION_DEL_EDITOR = "/material-campo?seccion=catalogo&pestana=editor";

type Props = {
  payload: CollectionStatePayload | null;
  onStateRefresh: () => Promise<void>;
  /** Avisa al shell mientras el catálogo o sus miniaturas no han llegado. */
  onCargando?: (cargando: boolean) => void;
  onIr?: (to: string) => void;
};

/**
 * Catálogo › Tipos (ADR 0109 §3 y §7): la galería de tipos de material con su
 * página real, el filtro por familia y el inspector del tipo elegido.
 */
export function CatalogoTipos({ payload, onStateRefresh, onCargando, onIr }: Props) {
  const { estado, dispatch, cargar, pedirVista, usar } = useCatalogoDeMateriales({
    expectedRevision: payload?.state_revision ?? null,
    onStateRefresh,
  });
  const catalogo = catalogoVisible(estado.carga);
  const presets = useMemo(() => catalogo?.presets ?? [], [catalogo]);
  const familias = useMemo(() => familiasDelCatalogo(presets), [presets]);
  const visibles = useMemo(() => filtrarPorFamilia(presets, estado.familia), [presets, estado.familia]);
  const seleccionado = presets.find((p) => p.preset_id === estado.seleccion) ?? null;
  const unitType = payload?.state.plan?.unit_type ?? null;
  const vistaDe = (presetId: string, page: number) => estado.vistas[claveDeVista(presetId, page)];

  const paginasDelSeleccionado = seleccionado
    ? paginasDelTipo(
      seleccionado,
      (() => {
        const v = vistaDe(seleccionado.preset_id, 1);
        return v?.estado === "lista" ? v.vista.pages : null;
      })(),
    )
    : 0;

  // Miniaturas de la galería: la primera página y, si hay dorso, la segunda.
  useEffect(() => {
    for (const preset of visibles) {
      for (const page of paginasDeLaTarjeta(preset)) pedirVista(preset.preset_id, page);
    }
  }, [visibles, pedirVista]);

  // Las páginas del tipo elegido, para el inspector.
  useEffect(() => {
    if (!seleccionado) return;
    for (let page = 1; page <= paginasDelSeleccionado; page += 1) pedirVista(seleccionado.preset_id, page);
  }, [seleccionado, paginasDelSeleccionado, pedirVista]);

  // La vista se declara lista cuando el catálogo llegó y cada tarjeta visible
  // resolvió su miniatura (con imagen o con error): antes el QA mediría esqueletos.
  const miniaturasPendientes = visibles.some((preset) => {
    const vista = vistaDe(preset.preset_id, 1);
    return !vista || vista.estado === "cargando";
  });
  const cargando = estado.carga.estado === "cargando" || (estado.carga.estado === "listo" && miniaturasPendientes);
  useEffect(() => { onCargando?.(cargando); }, [cargando, onCargando]);
  useEffect(() => () => onCargando?.(false), [onCargando]);

  const abrirEditor = () => onIr?.(DIRECCION_DEL_EDITOR);

  if (estado.carga.estado === "error") {
    return (
      <div className="rec-vacio-sin-plan" data-qa-geometry-capacity="owned">
        <EstadoVacio
          tamano="normal"
          icono={<AlertTriangle size={18} />}
          titulo="No se pudo leer el catálogo"
          descripcion={estado.carga.mensaje}
          accion={(
            <PulsoButton variant="secondary" size="sm" onClick={() => { void cargar(); }}>
              <RefreshCw size={14} aria-hidden /> Reintentar
            </PulsoButton>
          )}
        />
      </div>
    );
  }

  if (!catalogo) return <div className="rec-loading" data-qa-geometry-capacity="owned">Leyendo el catálogo…</div>;

  if (!presets.length) {
    return (
      <div className="rec-vacio-sin-plan" data-qa-geometry-capacity="owned">
        <EstadoVacio
          tamano="normal"
          icono={<LayoutGrid size={18} />}
          titulo="El catálogo no tiene tipos"
          descripcion="La plantilla en uso se edita en el editor."
          accion={onIr ? (
            <PulsoButton variant="secondary" size="sm" onClick={abrirEditor}>
              <Pencil size={14} aria-hidden /> Abrir el editor
            </PulsoButton>
          ) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="rec-cat-contenedor">
      <div
        className="rec-cat"
        data-qa-geometry-group="material-campo/catalogo/tipos"
        data-qa-geometry-contract="intrinsic"
      >
        <FiltroDeFamilias
          familias={familias}
          activa={estado.familia}
          onChange={(familia) => dispatch({ type: "familia", familia })}
        />
        <PanelCard
          className="rec-cat-galeria"
          fill
          flush
          aria-label="Tipos de material"
          title="Tipos de material"
          meta={`${visibles.length.toLocaleString("es-PE")} de ${presets.length.toLocaleString("es-PE")}`}
        >
          <ul
            className="rec-cat-grilla"
            data-qa-geometry-group="material-campo/catalogo/tipos-galeria"
            data-qa-geometry-contract="equal"
            data-qa-geometry-capacity="owned"
          >
            {visibles.map((preset) => (
              <li key={preset.preset_id}>
                <TarjetaDeTipo
                  preset={preset}
                  seleccionado={preset.preset_id === estado.seleccion}
                  frente={vistaDe(preset.preset_id, 1)}
                  dorso={vistaDe(preset.preset_id, 2)}
                  motivo={motivoIncompatible(preset, unitType)}
                  onSelect={() => dispatch({ type: "seleccionar", presetId: preset.preset_id })}
                />
              </li>
            ))}
          </ul>
        </PanelCard>
        {seleccionado ? (
          <InspectorDeTipo
            preset={seleccionado}
            paginas={paginasDelSeleccionado}
            vistaDe={(page) => vistaDe(seleccionado.preset_id, page)}
            motivo={motivoIncompatible(seleccionado, unitType)}
            usando={estado.usando === seleccionado.preset_id}
            bloqueoUsar={payload ? null : "Falta leer el estado del módulo."}
            error={estado.errorAccion}
            onUsar={() => { void usar(seleccionado); }}
            onAbrirEditor={abrirEditor}
          />
        ) : (
          <PanelCard className="rec-cat-inspector" fill title="Tipo">
            <div className="rec-contained-empty" data-qa-geometry-capacity="owned">Elige un tipo de la galería.</div>
          </PanelCard>
        )}
      </div>
    </div>
  );
}
