// La ficha de una UMP en maqueta (Gonzalo, 2026-10-31): al abrir la hoja se ve cómo está
// armada —sus partes y los datos de esa UMP— sin generar nada en el servidor. La vista
// previa real (PNG con el mapa) se pide aparte, porque cuesta.

import type { UnidadTerritorial } from "../../../api/materialTerritorial";
import "./maquetaFicha.css";

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-PE"));

export function MaquetaFicha({ unidad }: { unidad: UnidadTerritorial }) {
  const encuestas = unidad.rango_inicio !== null && unidad.rango_fin !== null ? `${unidad.rango_inicio} a ${unidad.rango_fin}` : "—";
  return (
    <div className="rec-maqueta" aria-label={`Estructura de la ficha de ${unidad.label}`}>
      <div className="rec-maqueta-cara">
        <span className="rec-maqueta-cara-rotulo">Cara 1</span>
        <header className="rec-maqueta-cab">
          <span>
            <strong>{unidad.role === "reemplazo" ? "Ficha de reemplazo" : "Ficha de trabajo de campo"}</strong>
            <small>{unidad.distrito} · Zona {unidad.zona || "—"} · Manzana {unidad.manzana || "—"}</small>
          </span>
          <span className="rec-maqueta-codigo">
            <b>{unidad.label}</b>
            <small>Encuestas {encuestas}</small>
          </span>
        </header>
        <section className="rec-maqueta-bloque">
          <h4>A. Datos generales</h4>
          <dl>
            <div><dt>Zona</dt><dd>{unidad.zona || "—"}</dd></div>
            <div><dt>Manzana</dt><dd>{unidad.manzana || "—"}</dd></div>
            <div><dt>Viviendas</dt><dd>{fmt(unidad.viviendas)}</dd></div>
            <div><dt>Encuestador, supervisores, fechas</dt><dd className="is-mano">a mano</dd></div>
          </dl>
        </section>
        <section className="rec-maqueta-bloque">
          <h4>B. Cuota de la hoja</h4>
          <p>Hombres y mujeres por rango de edad, con los totales que la ruta debe cumplir.</p>
        </section>
        <section className="rec-maqueta-bloque rec-maqueta-dos">
          <div>
            <h4>C. Selección de hogares</h4>
            <p>Esquema del recorrido: la manzana, sus aledañas numeradas y la esquina de entrada.</p>
          </div>
          <div>
            <h4>Esquina · sentido · hogar de inicio · salto</h4>
            <p>Cómo se elige cada vivienda.</p>
          </div>
        </section>
        <section className="rec-maqueta-bloque">
          <h4>Procedimiento ante la no respuesta</h4>
          <p>Tres pasos: la siguiente vivienda, una segunda vuelta y las manzanas aledañas.</p>
        </section>
      </div>
      <div className="rec-maqueta-cara">
        <span className="rec-maqueta-cara-rotulo">Cara 2</span>
        <section className="rec-maqueta-bloque rec-maqueta-mapa">
          <h4>Mapa de la manzana</h4>
          <p>La manzana {unidad.manzana || ""} con sus calles y las aledañas por si se agota.</p>
        </section>
      </div>
    </div>
  );
}
