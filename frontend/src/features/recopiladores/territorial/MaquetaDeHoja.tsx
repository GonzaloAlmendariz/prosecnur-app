// Maquetas de las hojas de papel de una UMP (pasada de diseño, 2 nov 2026): la hoja de
// ruteo, la de consolidados y la de zona, armadas con los datos de la UMP elegida y sin
// generar nada en el servidor. Mismo lenguaje que `MaquetaFicha`; el PDF real se pide
// desde el panel de al lado.

import type { UnidadTerritorial } from "../../../api/materialTerritorial";
import "./maquetaFicha.css";
import "./maquetaDeHoja.css";

const rango = (u: UnidadTerritorial) =>
  u.rango_inicio !== null && u.rango_fin !== null ? `${u.rango_inicio} a ${u.rango_fin}` : "—";

function Cabecera({ unidad, titulo }: { unidad: UnidadTerritorial; titulo: string }) {
  return (
    <header className="rec-maqueta-cab">
      <span>
        <strong>{titulo}</strong>
        <small>{unidad.distrito}, zona {unidad.zona || "—"}, manzana {unidad.manzana || "—"}</small>
      </span>
      <span className="rec-maqueta-codigo">
        <b>{unidad.label}</b>
        <small>Encuestas {rango(unidad)}</small>
      </span>
    </header>
  );
}

function FilasVacias({ columnas, filas }: { columnas: readonly string[]; filas: number }) {
  // Grilla y no <table>: es un dibujo de la hoja, no datos (ratchet tablasDelKit).
  return (
    <div className="rec-maqueta-filas" style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(0, 1fr))` }} aria-hidden>
      {columnas.map((c) => <b key={c}>{c}</b>)}
      {Array.from({ length: filas * columnas.length }, (_, i) => <i key={i} />)}
    </div>
  );
}

export function MaquetaDeRuteo({ unidad, caras }: { unidad: UnidadTerritorial; caras: number }) {
  return (
    <div className="rec-maqueta rec-maqueta--hoja" aria-label={`Estructura de la hoja de ruteo de ${unidad.label}`}>
      <div className="rec-maqueta-cara">
        <span className="rec-maqueta-cara-rotulo">{caras === 1 ? "Una cara" : "Cara 1 de 2"}</span>
        <Cabecera unidad={unidad} titulo="Hoja de ruteo" />
        <section className="rec-maqueta-bloque">
          <h4>Encuestador asignado</h4>
          <p>Sale impreso con el de la asignación de la Entrega; si falta, va a mano.</p>
        </section>
        <section className="rec-maqueta-bloque">
          <h4>Una fila por vivienda visitada</h4>
          <FilasVacias columnas={["Dirección", "N.º", "Código", "Nombre", "Edad", "Sexo"]} filas={6} />
        </section>
      </div>
    </div>
  );
}

const CODIGOS = ["1", "2", "3", "4", "5", "6", "7", "8", "99"] as const;

export function MaquetaDeConsolidados({ unidad }: { unidad: UnidadTerritorial }) {
  const inicio = unidad.rango_inicio;
  const fin = unidad.rango_fin;
  const numerados = inicio !== null && fin !== null && fin >= inicio ? Array.from({ length: Math.min(fin - inicio + 1, 8) }, (_, i) => inicio + i) : [];
  return (
    <div className="rec-maqueta rec-maqueta--hoja" aria-label={`Estructura de la hoja de consolidados de ${unidad.label}`}>
      <div className="rec-maqueta-cara">
        <span className="rec-maqueta-cara-rotulo">Cierre del recorrido</span>
        <Cabecera unidad={unidad} titulo="Hoja de consolidados" />
        <section className="rec-maqueta-bloque">
          <h4>Visitas por código de resultado</h4>
          <div className="rec-maqueta-codigos">
            {CODIGOS.map((c) => (
              <span key={c} data-efectiva={c === "8" || undefined}><b>{c}</b><i aria-hidden /></span>
            ))}
          </div>
          <p>Con las no aplicadas, las efectivas y el total de intentos al pie.</p>
        </section>
        <section className="rec-maqueta-bloque">
          <h4>Registro de encuestados</h4>
          {numerados.length ? (
            <ol className="rec-maqueta-registro">
              {numerados.map((n) => <li key={n}><b>{n}</b><i aria-hidden /></li>)}
            </ol>
          ) : (
            <p>Numerado con los cuestionarios de la UMP.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export function MaquetaDeZona({ unidades, zona }: { unidades: readonly UnidadTerritorial[]; zona: string }) {
  const titulares = unidades.filter((u) => u.role === "titular");
  const reemplazos = unidades.filter((u) => u.role !== "titular");
  const primera = unidades[0];
  return (
    <div className="rec-maqueta rec-maqueta--zona" aria-label={`Estructura de la hoja de la zona ${zona}`}>
      <div className="rec-maqueta-cara">
        <span className="rec-maqueta-cara-rotulo">Página apaisada</span>
        <header className="rec-maqueta-cab">
          <span>
            <strong>Hoja de zona</strong>
            <small>{primera?.distrito ?? "—"}, zona {zona || "—"}</small>
          </span>
          <span className="rec-maqueta-codigo">
            <b>{titulares.length} {titulares.length === 1 ? "ruta" : "rutas"}</b>
            <small>{reemplazos.length} de reemplazo</small>
          </span>
        </header>
        <div className="rec-maqueta-zona">
          <section className="rec-maqueta-bloque rec-maqueta-plano" aria-label="Mapa de la zona">
            {titulares.map((u, i) => <span key={u.unit_id} className="rec-maqueta-pin">{i + 1}</span>)}
            {reemplazos.map((u) => <span key={u.unit_id} className="rec-maqueta-pin is-reemplazo">R</span>)}
          </section>
          <section className="rec-maqueta-bloque">
            <h4>Rutas</h4>
            <ol className="rec-maqueta-rutas">
              {titulares.map((u) => <li key={u.unit_id}><b>{u.label}</b><span>manzana {u.manzana || "—"}</span></li>)}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
