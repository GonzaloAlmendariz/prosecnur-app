// La pestaña Contactos de una campaña de correo (ADR 0112 §4): quién está en
// la lista, cómo se reparte por perfil y quién respondió, más el enlace
// personal a la encuesta (§2).
//
// Contrato de Superficie:
// - C1: `material-campo/correo/contactos` (intrinsic) con dos grupos dentro:
//   el resumen (`…/resumen`, equal) y las distribuciones (`…/distribuciones`,
//   intrinsic).
// - C3/C5: cada vacío vive en la caja de su sección y dice su causa y su
//   arreglo: sin contactos (→ Personas), sin variables (→ elegirlas), filtros
//   que dejan la base en cero (→ quitarlos).
// - C4: un solo dueño de scroll vertical, el panel de la pestaña; la barra se
//   queda pegada arriba y las tablas se desplazan en horizontal dentro de sí.

import { useEffect, useMemo, type ReactNode } from "react";

import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { RefreshCw, Users } from "../../../../vendor/lucide-react";
import { CruceDeVariables } from "./CruceDeVariables";
import { EnlaceDeEncuesta } from "./EnlaceDeEncuesta";
import { ListaDeContactos } from "./ListaDeContactos";
import { cruceVigente, cuantosFiltros, vacioDelPerfil } from "./modeloContactos";
import { PANEL_CONTACTOS_VARIABLES } from "./panelesContactos";
import { ResumenContactos } from "./ResumenContactos";
import { SelectorDeVariables } from "./SelectorDeVariables";
import { useContactosStore } from "./store";
import { TableroDePerfil } from "./TableroDePerfil";
import { useContactos } from "./useContactos";
import "../correosBarra.css";
import "./contactos.css";

type Props = {
  /** El `campaign_id` de mail-* (sin el prefijo `correo.` del registro). */
  campaignId: string | null;
  /** Volver a la lista, nombre y menú de la campaña. */
  cabecera?: ReactNode;
  onCargando?: (cargando: boolean) => void;
  /** Lleva a Personas, en el editor: ahí se importa la lista. */
  onIrAImportar: () => void;
};

export function ContactosVista({ campaignId, cabecera = null, onCargando, onIrAImportar }: Props) {
  const acciones = useContactos(campaignId);
  const panelVariables = usePanelDireccionable(PANEL_CONTACTOS_VARIABLES);
  const perfil = useContactosStore((s) => s.perfil);
  const perfilCarga = useContactosStore((s) => s.perfilCarga);
  const perfilError = useContactosStore((s) => s.perfilError);
  const lista = useContactosStore((s) => s.lista);
  const listaCarga = useContactosStore((s) => s.listaCarga);
  const listaError = useContactosStore((s) => s.listaError);
  const filtros = useContactosStore((s) => s.filtros);
  const crucePedido = useContactosStore((s) => s.cruce);
  const guardandoControl = useContactosStore((s) => s.guardandoControl);
  const controlError = useContactosStore((s) => s.controlError);
  const refrescar = useContactosStore((s) => s.refrescar);
  const limpiarFiltros = useContactosStore((s) => s.limpiarFiltros);

  useEffect(() => { onCargando?.(acciones.cargando); }, [acciones.cargando, onCargando]);

  const resumen = lista?.resumen ?? null;
  const conFiltros = cuantosFiltros(filtros) > 0;
  const control = perfil?.control ?? [];
  const par = cruceVigente(control, crucePedido);
  const vacio = vacioDelPerfil(resumen, perfil, conFiltros, lista ? lista.cargados : null);
  const sinContactos = vacio === "sin-contactos";
  const etiquetas = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of lista?.columnas ?? []) out[c.key] = c.label;
    for (const c of perfil?.candidatas ?? []) out[c.key] = c.label;
    for (const v of perfil?.variables ?? []) out[v.key] = v.label;
    return out;
  }, [lista?.columnas, perfil?.candidatas, perfil?.variables]);
  const leyendo = perfilCarga === "cargando" || listaCarga === "cargando";

  const selector = (
    <SelectorDeVariables
      panel={panelVariables}
      candidatas={perfil?.candidatas ?? []}
      control={control}
      guardando={guardandoControl}
      error={controlError}
      disabled={!perfil || sinContactos}
      onAplicar={acciones.guardarControl}
    />
  );

  return (
    <div
      className="rec-contactos"
      data-qa-geometry-group="material-campo/correo/contactos"
      data-qa-geometry-contract="intrinsic"
      data-testid="contactos-vista"
    >
      <header className="rec-contactos-barra rec-mail-barra--fina" aria-label="Barra de contactos">
        <span className="rec-barra-izq">{cabecera}</span>
        <span className="rec-barra-der">
          <PulsoButton variant="ghost" size="sm" onClick={refrescar} disabled={leyendo || !campaignId}>
            <RefreshCw size={14} className={leyendo ? "pulso-spin" : undefined} aria-hidden />
            Actualizar
          </PulsoButton>
        </span>
      </header>

      {!campaignId ? (
        <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
          <p>Esta campaña no tiene correo asociado.</p>
        </div>
      ) : sinContactos ? (
        <div className="rec-contactos-vacio" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<Users size={22} />}
            titulo="Esta campaña todavía no tiene contactos"
            descripcion="La lista se importa en Personas, dentro del editor del correo. Con ella aquí se ve quién está, cómo se reparte y quién respondió."
            accion={<PulsoButton variant="primary" size="sm" onClick={onIrAImportar}>Importar la lista</PulsoButton>}
          />
        </div>
      ) : (
        <>
          <div className="rec-contactos-cabeza">
            {resumen ? (
              <ResumenContactos resumen={resumen} respuestasLeidas={Boolean(perfil?.respuestas_leidas) || resumen.respondieron !== null} />
            ) : listaError ? null : (
              <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned"><p>Leyendo la lista…</p></div>
            )}
            <EnlaceDeEncuesta
              efectivos={resumen?.efectivos ?? 0}
              conEnlace={resumen?.con_enlace ?? 0}
              onGenerar={() => { void acciones.generarEnlaces(); }}
            />
          </div>

          <TableroDePerfil
            perfil={perfil}
            carga={perfilCarga}
            error={perfilError}
            vacio={vacio}
            etiquetas={etiquetas}
            conFiltros={conFiltros}
            selector={selector}
            onElegirVariables={panelVariables.abrir}
            onIrAImportar={onIrAImportar}
            onQuitarFiltros={limpiarFiltros}
            onReintentar={refrescar}
          />

          {control.length > 0 && vacio === null ? (
            <CruceDeVariables
              control={control}
              etiquetas={etiquetas}
              par={par}
              cruce={perfil?.cruce ?? null}
              cargando={perfilCarga === "cargando"}
              onElegirVariables={panelVariables.abrir}
            />
          ) : null}

          <ListaDeContactos
            lista={lista}
            control={control}
            respuestasLeidas={Boolean(perfil?.respuestas_leidas)}
            cargando={listaCarga === "cargando"}
            error={listaError}
            conFiltros={conFiltros}
          />
        </>
      )}
    </div>
  );
}
