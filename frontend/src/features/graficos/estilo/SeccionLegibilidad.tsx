// Legibilidad de los gráficos en Identidad, Letra (O8 del rediseño, 2026-10-15): qué va en negrita y cómo se acomoda la
// leyenda, para todo el informe, en la lámina y en el Word. Por defecto todo sale como hoy (`modeloLegibilidad.ts`).

import type { EstiloCliente } from "../../../api/graficosEstilo";
import { PulsoButton } from "../../../components/PulsoButton";
import { Switch } from "../../../components/Switch";
import { RotateCcw } from "../../../vendor/lucide-react";
import { Segmentado } from "../subpestanas/Segmentado";
import { MarcaModificado } from "./SelloProcedencia";
import {
  conCategorias, conLeyenda, conNegrita, leerCategorias, leerLeyenda, leerNegrita, legibilidadModificada, MODOS_CATEGORIAS,
  MODOS_LEYENDA, ROLES_NEGRITA, sinLegibilidad, type ModoLeyenda,
} from "./modeloLegibilidad";

const ESCALA = ["Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"];

/** Cómo queda una leyenda de cinco etiquetas largas en un panel de media lámina con cada modo. */
function MuestraLeyenda({ modo, negrita }: { modo: ModoLeyenda; negrita: boolean }) {
  const filas = modo === "una_fila" ? [ESCALA] : modo === "dos_filas" ? [ESCALA.slice(0, 3), ESCALA.slice(3)] : [ESCALA.slice(0, 2), ESCALA.slice(2, 4), ESCALA.slice(4)];
  return (
    <div className={`pulso-f6-leg-muestra is-${modo}${negrita ? " is-negrita" : ""}`} aria-hidden="true">
      {filas.map((f, i) => (
        <div key={i} className="pulso-f6-leg-fila">
          {f.map((t) => <span key={t}><i className={`c${ESCALA.indexOf(t)}`} />{t}</span>)}
        </div>
      ))}
    </div>
  );
}

export function SeccionLegibilidad({ estilo, onCambiar }: { estilo: EstiloCliente; onCambiar: (f: (e: EstiloCliente) => EstiloCliente) => void }) {
  const modificada = legibilidadModificada(estilo);
  const leyenda = leerLeyenda(estilo);
  return (
    <section className="pulso-f6-estilo-seccion" aria-labelledby="f6-estilo-legibilidad-titulo" data-qa-geometry-member>
      <header className="pulso-f6-estilo-seccion-cabecera">
        <h3 id="f6-estilo-legibilidad-titulo">Negrita y leyenda</h3>
        <MarcaModificado visible={modificada} />
        {modificada ? (
          <PulsoButton variant="ghost" size="sm" onClick={() => onCambiar(sinLegibilidad)} aria-label="Volver a la negrita y la leyenda por defecto">
            <RotateCcw size={14} aria-hidden="true" />
            Restablecer
          </PulsoButton>
        ) : null}
      </header>
      <p className="pulso-f6-estilo-ayuda">Vale para todos los gráficos del informe, en la lámina y en el Word.</p>

      <div className="pulso-f6-leg-columnas">
        <div className="pulso-f6-leg-grupo" role="group" aria-labelledby="f6-leg-negrita">
          <h4 id="f6-leg-negrita" className="pulso-f6-estilo-subtitulo">Negrita</h4>
          {ROLES_NEGRITA.map((r) => (
            <div key={r.rol} className="pulso-f6-leg-fila-ajuste">
              <label htmlFor={`f6-leg-${r.rol}`}>{r.rotulo}</label>
              <Switch id={`f6-leg-${r.rol}`} checked={leerNegrita(estilo, r.rol)} ariaLabel={`${r.rotulo} en negrita`}
                onToggle={() => onCambiar((e) => conNegrita(e, r.rol, !leerNegrita(e, r.rol)))} />
            </div>
          ))}
          <div className="pulso-f6-leg-fila-ajuste is-apilada">
            <span id="f6-leg-categorias">Categorías</span>
            <Segmentado etiqueta="Categorías en negrita" valor={leerCategorias(estilo)} opciones={MODOS_CATEGORIAS}
              onCambiar={(m) => onCambiar((e) => conCategorias(e, m))} />
          </div>
        </div>

        <div className="pulso-f6-leg-grupo" role="group" aria-labelledby="f6-leg-leyenda">
          <h4 id="f6-leg-leyenda" className="pulso-f6-estilo-subtitulo">Leyenda</h4>
          <Segmentado etiqueta="Cómo se acomoda la leyenda" valor={leyenda} opciones={MODOS_LEYENDA}
            onCambiar={(m) => onCambiar((e) => conLeyenda(e, m))} />
          <p className="pulso-f6-estilo-ayuda">{MODOS_LEYENDA.find((m) => m.clave === leyenda)?.detalle}</p>
          <MuestraLeyenda modo={leyenda} negrita={leerNegrita(estilo, "leyenda")} />
          <p className="pulso-f6-leg-nota">Ejemplo con cinco etiquetas largas en un panel de media lámina.</p>
        </div>
      </div>
    </section>
  );
}
