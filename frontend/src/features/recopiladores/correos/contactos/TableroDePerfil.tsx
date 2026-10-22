// El tablero por perfil: una distribución por variable de control, con los
// filtros activos arriba. Las tarjetas son secciones independientes (cada
// variable trae sus categorías): grupo `intrinsic`, cada una con su alto.

import type { ReactNode } from "react";

import type { PerfilDeContactos } from "../../../../api/mailContactos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { BarChart3 } from "../../../../vendor/lucide-react";
import { DistribucionDeVariable } from "./DistribucionDeVariable";
import { FiltrosActivos } from "./FiltrosActivos";
import type { VacioDelPerfil } from "./modeloContactos";
import type { Carga } from "./store";

type Props = {
  perfil: PerfilDeContactos | null;
  carga: Carga;
  error: string;
  vacio: VacioDelPerfil;
  etiquetas: Readonly<Record<string, string>>;
  conFiltros: boolean;
  /** El botón de «Variables de control» (panel direccionable). */
  selector: ReactNode;
  onElegirVariables: () => void;
  onIrAImportar: () => void;
  onQuitarFiltros: () => void;
  onReintentar: () => void;
};

export function TableroDePerfil(p: Props) {
  const perfil = p.perfil;
  const conRespuestas = Boolean(perfil?.respuestas_leidas);
  return (
    <section className="rec-contactos-seccion" aria-labelledby="rec-contactos-perfil-titulo" data-testid="contactos-perfil">
      <header className="rec-contactos-seccion-cabecera">
        <h2 id="rec-contactos-perfil-titulo" className="rec-contactos-titulo">
          <BarChart3 size={16} aria-hidden />
          Perfil de los efectivos
          {perfil && perfil.control.length ? (
            <span className="rec-contactos-titulo-cifra">base {formatoConteo(perfil.base)}</span>
          ) : null}
        </h2>
        <div className="rec-contactos-herramientas">{p.selector}</div>
      </header>

      <FiltrosActivos etiquetas={p.etiquetas} base={p.conFiltros && perfil ? perfil.base : null} />

      {p.error && !perfil ? (
        <div className="rec-contactos-vacio-caja is-error" role="alert" data-qa-geometry-capacity="owned">
          <p>{p.error}</p>
          <PulsoButton variant="secondary" size="sm" onClick={p.onReintentar}>Reintentar</PulsoButton>
        </div>
      ) : p.vacio === "sin-efectivos" ? (
        <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
          <p>Ningún contacto de la lista tiene un correo que se pueda usar, así que no hay perfil que mostrar.</p>
          <PulsoButton variant="secondary" size="sm" onClick={p.onIrAImportar}>Revisar la lista en Personas</PulsoButton>
        </div>
      ) : p.vacio === "sin-candidatas" ? (
        <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
          <p>La lista no trae columnas con categorías (carrera, sexo, sede…) para describir el perfil.</p>
          <PulsoButton variant="secondary" size="sm" onClick={p.onIrAImportar}>Importar otra lista</PulsoButton>
        </div>
      ) : p.vacio === "sin-variables" ? (
        <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
          <p>Elige qué columnas describen el perfil —carrera, sexo, sede…— para ver cómo se reparten los contactos.</p>
          <PulsoButton variant="primary" size="sm" onClick={p.onElegirVariables}>Elegir variables de control</PulsoButton>
        </div>
      ) : p.vacio === "sin-base" ? (
        <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
          <p>Ningún contacto efectivo cumple todos los filtros a la vez.</p>
          <PulsoButton variant="secondary" size="sm" onClick={p.onQuitarFiltros}>Quitar los filtros</PulsoButton>
        </div>
      ) : perfil ? (
        <div
          className="rec-contactos-distribuciones"
          data-qa-geometry-group="material-campo/correo/contactos/distribuciones"
          data-qa-geometry-contract="intrinsic"
          aria-busy={p.carga === "cargando" || undefined}
        >
          {perfil.variables.map((variable) => (
            <DistribucionDeVariable key={variable.key} variable={variable} base={perfil.base} conRespuestas={conRespuestas} />
          ))}
        </div>
      ) : (
        <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
          <p>Leyendo el perfil…</p>
        </div>
      )}
    </section>
  );
}
