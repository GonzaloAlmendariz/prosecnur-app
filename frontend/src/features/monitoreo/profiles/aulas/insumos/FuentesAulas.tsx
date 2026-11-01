import { memo, useState } from "react";
import { BookOpen, Database, FileSpreadsheet, Lock, Upload, Users } from "lucide-react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import type { ContextoDeInsumos } from "./contextoDeInsumos";
import { fmt } from "../kpisDeAulas";
import { construirFuentes, readinessDeFuentes, type FilaDeFuente, type Tono } from "./fuentesModelo";
import "./insumos.css";

const ICONO: Record<string, typeof Database> = {
  plan: FileSpreadsheet,
  libro: BookOpen,
  padron: Users,
};

function Chip({ texto, tono }: { texto: string; tono: Tono }) {
  return <span className="aulas-ins-chip" data-tono={tono}>{texto}</span>;
}

function Fila({ f }: { f: FilaDeFuente }) {
  const Icono = ICONO[f.clave] ?? Database;
  return (
    <tr>
      <th scope="row">
        <span className="aulas-ins-fuente">
          <Icono size={15} aria-hidden="true" />
          <span>
            <b>{f.fuente}</b>
            {f.condicional ? <span className="aulas-ins-chip" data-tono="neutro">Condicional</span> : null}
            {f.sub ? <small>{f.sub}</small> : null}
          </span>
        </span>
      </th>
      <td className="is-trae">{f.trae}</td>
      <td className="is-num">{f.volumen}</td>
      <td className="is-num">{f.lectura || "—"}</td>
      <td><Chip texto={f.estado.texto} tono={f.estado.tono} /></td>
    </tr>
  );
}

/**
 * Insumos › Fuentes (ficha I1). Izquierda: «Fuentes del estudio» y el recibo de
 * la última lectura del libro. Derecha: el libro del operativo (qué hojas son
 * del equipo y cuáles escribe la app) y cómo se une cada respuesta a su
 * curso-horario. Ningún botón de esta pestaña escribe en un Sheets.
 */
function FuentesAulasImpl({ dashboard, cargando, contexto }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  contexto: ContextoDeInsumos;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const m = construirFuentes(dashboard, contexto.config, contexto.fuentes);

  return (
    <section
      className="aulas-ins"
      aria-label="Fuentes"
      aria-busy={cargando || undefined}
      data-audit-ready={readinessDeFuentes(cargando)}
      data-qa-geometry-group="aulas-insumos-fuentes"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="aulas-ins-izquierda" data-qa-geometry-member="izquierda" data-qa-geometry-group="aulas-insumos-fuentes-izquierda" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-ins-fuentes-titulo" data-qa-geometry-member="fuentes">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-ins-fuentes-titulo">Fuentes del estudio</h3>
            <span className="aulas-ins-acciones">
              <button
                type="button"
                className="pulso-button pulso-button--secondary pulso-button--sm"
                onClick={() => setConfirmando(true)}
                disabled={contexto.ocupado}
              >
                <Upload size={14} aria-hidden="true" /> Importar plan
              </button>
            </span>
          </header>
          {confirmando ? (
            <div className="aulas-ins-confirmar" role="alertdialog" aria-label="Confirmar importación del plan">
              <p>
                {m.planImportado && m.cursosDelPlan
                  ? `Reemplaza los ${fmt(m.cursosDelPlan)} cursos-horario del plan con la selección vigente de Cálculo de muestra. Lo registrado en campo se conserva.`
                  : "Trae titulares, reservas y banco de la selección vigente de Cálculo de muestra."}
              </p>
              <span className="aulas-ins-acciones">
                <button type="button" className="pulso-button pulso-button--secondary pulso-button--sm" onClick={() => setConfirmando(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="pulso-button is-primary pulso-button--sm"
                  onClick={() => { setConfirmando(false); contexto.importarPlan(); }}
                >
                  Importar
                </button>
              </span>
            </div>
          ) : null}
          <div className="aulas-ins-tabla-marco" data-qa-geometry-capacity="owned">
            <table className="aulas-ins-tabla" aria-labelledby="aulas-ins-fuentes-titulo">
              <thead>
                <tr>
                  <th scope="col">Fuente</th>
                  <th scope="col" className="is-trae">Qué trae</th>
                  <th scope="col" className="is-num">Volumen</th>
                  <th scope="col" className="is-num">Última lectura</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {m.filas.map((f) => <Fila key={f.clave} f={f} />)}
              </tbody>
            </table>
          </div>
          <p className="aulas-ins-pie">{m.pie}</p>
        </section>

        <section className="aulas-ins-panel" aria-labelledby="aulas-ins-recibo-titulo" data-qa-geometry-member="recibo">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-ins-recibo-titulo">Recibo de la última lectura del libro</h3>
            {m.recibo?.importadoEn ? <span className="aulas-ins-sub">{m.recibo.importadoEn}</span> : null}
          </header>
          {m.recibo ? (
            <dl className="aulas-ins-recibo" data-qa-geometry-group="aulas-insumos-recibo" data-qa-geometry-contract="equal">
              {m.recibo.comprobaciones.map((c) => (
                <div key={c.clave} data-qa-geometry-member={c.clave} title={c.detalle || undefined}>
                  <dt>{c.rotulo}</dt>
                  <dd><Chip texto={c.resultado} tono={c.tono} /></dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">
              Todavía no se leyó el libro del operativo: el recibo aparece con la primera lectura.
            </p>
          )}
        </section>

        <details className="aulas-ins-mas">
          <summary>Más operaciones del plan</summary>
          {contexto.operaciones}
        </details>
      </div>

      <div className="aulas-ins-derecha" data-qa-geometry-member="derecha" data-qa-geometry-group="aulas-insumos-fuentes-derecha" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-ins-libro-titulo" data-qa-geometry-member="libro">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-ins-libro-titulo">Libro del operativo</h3>
            {m.libro?.publicadoEn ? <span className="aulas-ins-sub">publicado {m.libro.publicadoEn}</span> : null}
          </header>
          {m.libro ? (
            <>
              <p className="aulas-ins-grupo"><Lock size={13} aria-hidden="true" /> Hojas del equipo · solo lectura</p>
              <ul className="aulas-ins-hojas">
                {m.libro.equipo.map((h) => <li key={h.hoja} data-de="equipo">{h.hoja}</li>)}
              </ul>
              <p className="aulas-ins-grupo">Hojas que escribe la app</p>
              <ul className="aulas-ins-hojas">
                {m.libro.app.map((h) => <li key={h.hoja} data-de="app">{h.hoja}</li>)}
              </ul>
            </>
          ) : (
            <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">
              El libro todavía no se publicó desde la app: cuando se publique, aquí se separan las hojas del equipo de las que escribe la app.
            </p>
          )}
        </section>

        <section className="aulas-ins-panel" aria-labelledby="aulas-ins-union-titulo" data-qa-geometry-member="union">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-ins-union-titulo">Cómo se une cada respuesta a su curso-horario</h3>
          </header>
          {m.union ? (
            <>
              <dl className="aulas-ins-union" data-qa-geometry-group="aulas-insumos-union" data-qa-geometry-contract="equal">
                {m.union.pasos.map((p) => (
                  <div key={p.clave} data-qa-geometry-member={p.clave}>
                    <dt>{p.rotulo}</dt>
                    <dd data-tono={p.tono}>{fmt(p.valor)}</dd>
                  </div>
                ))}
              </dl>
              <p className="aulas-ins-pie">{m.union.nota}</p>
            </>
          ) : (
            <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">
              Sin respuestas leídas todavía.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

export const FuentesAulas = memo(FuentesAulasImpl);
