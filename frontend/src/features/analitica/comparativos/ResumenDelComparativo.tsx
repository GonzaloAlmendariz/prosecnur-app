// El resumen del último comparativo generado, en un panel lateral
// (`?panel=comparativo-resumen`): las filas que quedaron fuera del libro y por
// qué, los avisos del motor y, por pregunta, dónde no es comparable, las
// casillas sin casos, las mediciones sin variable, los casos sin correspondencia
// y las opciones no ofrecidas. Es lo que antes iba bajo los botones de generar.

import { Link } from "react-router-dom";

import type { ComparativoOmitida, ComparativoResultado, ComparativoTipo } from "../../../api/analitica";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { Sideover } from "../../../components/Sideover";
import { rotuloDeMatriz } from "../../../lib/rotuloDeMatriz";
import { AlertTriangle, FileText } from "../../../vendor/lucide-react";
import { nombreDeSerie } from "../../carga/nombreDeSerie";
import { PANEL_COMPARATIVO_RESUMEN } from "../panelesAnalitica";
import { ComparativosAvisos } from "../panes/ComparativosAvisos";
import {
  avisosGenerales,
  cantidad,
  celdaNa,
  celdaNoOfrecidas,
  celdaSinVariable,
  detalleDeOmitida,
  direccionDeOmitida,
  especialesSinMapa,
  omitidasDe,
  rotuloDe,
  textoMotivoOmision,
  totalSinMapa,
  type CeldaResumen,
} from "../panes/comparativosModel";

export function ResumenDelComparativo({ resultado }: {
  resultado: { tipo: ComparativoTipo; datos: ComparativoResultado } | null;
}) {
  const datos = resultado?.datos ?? null;
  const serie = nombreDeSerie((datos?.periodos ?? []).map((p) => p.rotulo));
  return (
    <Sideover
      panel={PANEL_COMPARATIVO_RESUMEN}
      title={resultado ? (resultado.tipo === "cruces" ? "Comparativo de cruces generado" : "Comparativo simple generado") : "Resumen del comparativo"}
      subtitle={datos ? (
        <>
          {cantidad(datos.resumen.n_preguntas, "pregunta", "preguntas")} en {cantidad(datos.periodos.length, serie.singular, serie.plural)}
          {datos.periodos.length ? ` (${datos.periodos.map((p) => p.rotulo).join(", ")})` : ""}
        </>
      ) : undefined}
      icon={<FileText size={16} aria-hidden="true" />}
      alto={resultado ? "ventana" : "contenido"}
      className="comparativos-resumen-panel"
    >
      {resultado && datos ? (
        <div className="comparativos-resumen">
          <PreguntasOmitidas omitidas={omitidasDe(datos.resumen)} periodos={datos.periodos} />
          <ComparativosAvisos avisos={avisosGenerales(datos.resumen.avisos)} />
          <TablaDelResumen tipo={resultado.tipo} datos={datos} />
        </div>
      ) : (
        <EstadoVacio
          icono={<FileText size={16} />}
          titulo="Sin comparativo generado"
          descripcion="El resumen aparece al generar un comparativo en Archivos."
        />
      )}
    </Sideover>
  );
}

function TablaDelResumen({ tipo, datos }: { tipo: ComparativoTipo; datos: ComparativoResultado }) {
  return (
    <div
      role="table"
      className="comparativos-resumen-tabla"
      aria-label="Resumen por pregunta"
      data-qa-geometry-group="analitica/comparativos-resumen"
      data-qa-geometry-contract="intrinsic"
    >
      <div role="rowgroup">
        <div role="row" className="comparativos-resumen-fila comparativos-resumen-fila--cabecera">
          <span role="columnheader">Pregunta</span>
          <span role="columnheader" title="Bases donde la pregunta no es comparable (n.c.)">No comparable en</span>
          <span role="columnheader" title="Bases o casillas sin casos o sin respuesta sustantiva (n.a.)">Sin casos en</span>
          <span role="columnheader" title="Bases donde la pregunta no tiene variable; salen como n.c.">Sin variable en</span>
          <span role="columnheader" title="Casos cuya respuesta no tiene destino en la escala común, por base">Sin correspondencia</span>
          <span role="columnheader" title="Opciones de la escala común que esa base no ofrecía">Opciones no ofrecidas</span>
        </div>
      </div>
      <div role="rowgroup">
        {datos.resumen.preguntas.map((p, i) => {
          const especiales = p.sin_mapa.filter((s) => s.n_especial_sin_mapa > 0);
          return (
            <div key={`${p.titulo}-${i}`} role="row" className="comparativos-resumen-fila">
              <span role="rowheader" className="comparativos-resumen-pregunta">
                {p.titulo}
                {p.n_reducidas ? (
                  <small>{cantidad(p.n_reducidas, "columna de cruce", "columnas de cruce")} con base reducida</small>
                ) : null}
              </span>
              <span role="cell"><ListaCelda items={p.n_c.map((x) => rotuloDe(x, datos.periodos))} /></span>
              <span role="cell"><CeldaCubierta celda={celdaNa(p, tipo, datos.periodos)} /></span>
              <span role="cell"><ListaCelda items={celdaSinVariable(p, datos.periodos)} /></span>
              <span role="cell">
                {totalSinMapa(p) ? (
                  <ListaCelda
                    items={p.sin_mapa.filter((s) => s.n_sin_mapa > 0).map((s) => (
                      `${rotuloDe(s.base, datos.periodos)}: ${cantidad(s.n_sin_mapa, "caso", "casos")}${s.codigos_sin_mapa.length ? ` (códigos ${s.codigos_sin_mapa.join(", ")})` : ""}`
                    ))}
                  />
                ) : <CeldaNada />}
                {especiales.length ? (
                  <ListaCelda
                    items={especiales.map((s) => (
                      `${rotuloDe(s.base, datos.periodos)}: ${s.n_especial_sin_mapa} especiales fuera de la escala${especialesSinMapa(s).length ? ` (${especialesSinMapa(s).join(", ")})` : ""}`
                    ))}
                  />
                ) : null}
              </span>
              <span role="cell"><CeldaCubierta celda={celdaNoOfrecidas(p, tipo, datos.periodos)} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Lo que quedó fuera del comparativo y por qué. Va antes de los demás avisos:
 * una pregunta omitida es una tabla que el usuario esperaba y no está en el archivo.
 */
function PreguntasOmitidas({ omitidas, periodos }: {
  omitidas: ComparativoOmitida[];
  periodos: ComparativoResultado["periodos"];
}) {
  if (!omitidas.length) return null;
  return (
    <section className="pulso-comparativos-omitidas" aria-labelledby="comparativos-omitidas-titulo">
      <header>
        <AlertTriangle size={15} aria-hidden="true" />
        <h4 id="comparativos-omitidas-titulo">
          {omitidas.length === 1 ? "1 fila quedó fuera del comparativo" : `${omitidas.length} filas quedaron fuera del comparativo`}
        </h4>
        <p>
          {omitidas.length === 1
            ? 'No tiene tabla en el archivo. El libro la lista en la hoja "Preguntas omitidas".'
            : 'No tienen tabla en el archivo. El libro las lista en la hoja "Preguntas omitidas".'}
        </p>
      </header>
      <ul
        className="pulso-comparativos-omitidas-lista"
        data-qa-geometry-group="comparativos-omitidas"
        data-qa-geometry-contract="intrinsic"
      >
        {omitidas.map((o, i) => (
          <li key={`${o.fila}-${o.base}-${i}`} data-qa-geometry-member>
            <div className="pulso-comparativos-omitida-cabeza">
              <strong>{rotuloDeMatriz(o.titulo)}</strong>
              <span className="pulso-comparativos-omitida-tipo">{o.tipo === "cruce" ? "Variable de cruce" : "Pregunta"}</span>
            </div>
            <p className="pulso-comparativos-omitida-motivo">
              {textoMotivoOmision(o.motivo, o.ausentes)}
              {o.base ? `. Base afectada: ${rotuloDe(o.base, periodos)}.` : "."}
            </p>
            {detalleDeOmitida(o, periodos) ? (
              <p className="pulso-comparativos-omitida-detalle">{detalleDeOmitida(o, periodos)}</p>
            ) : null}
            <Link className="pulso-comparativos-aviso-accion" to={direccionDeOmitida(o)}>Revisar en Equivalencias</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Celda sin nada que listar: un guion atenuado; el lector de pantalla oye "Ninguna". */
function CeldaNada() {
  return (
    <span className="pulso-comparativos-nada">
      <span aria-hidden="true">-</span>
      <span className="pulso-sr-only">Ninguna</span>
    </span>
  );
}

function ListaCelda({ items }: { items: string[] }) {
  if (!items.length) return <CeldaNada />;
  return (
    <ul className="pulso-comparativos-celda-lista">
      {items.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}
    </ul>
  );
}

/** "Ninguna" solo si el resumen cubre el caso; si no lo cubre, se dice. */
function CeldaCubierta({ celda }: { celda: CeldaResumen }) {
  if (!celda.items.length) {
    return celda.cubierto
      ? <CeldaNada />
      : <span className="pulso-comparativos-nada" title="El resumen no lo reporta para este comparativo">sin dato</span>;
  }
  return (
    <>
      <ListaCelda items={celda.items} />
      {celda.cubierto ? null : <small className="pulso-comparativos-reducidas">Puede haber más en las variables de cruce</small>}
    </>
  );
}
