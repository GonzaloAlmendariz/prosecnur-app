/**
 * Los estados de la mesa de Hallazgos que no son un hallazgo abierto
 * (prototipo `hallVacio` y los moldes de carga, `vistas.js:1147-1216`):
 *
 *  - `EsqueletoDeHallazgos`: las tres columnas con su silueta mientras se lee
 *    la cola; la carga de bloque retiene la marca de la pestaña.
 *  - `RevisionPorFamilia`: "Qué se va a revisar" (sin auditar: reglas y
 *    activas por familia) o "Qué se revisó" (sin hallazgos: reglas y casos),
 *    con su total y "Ver las reglas".
 *  - `DecisionVacia`: la columna "Decisión" sin hallazgo elegido, sin nada que
 *    decidir o sin casos a la vista.
 */
import type { ReactNode } from "react";
import { CheckCircle2, Inbox, ListChecks } from "../../../vendor/lucide-react";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { Skeleton } from "../../../components/Skeleton";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { CatalogoCompleto } from "../../../api/validacionCatalogo";
import { filasDeRevision } from "./modeloHallazgos";

function Filas({ n, alto }: { n: number; alto?: number }) {
  return (
    <div className="pulso-hz-esqueleto">
      {Array.from({ length: n }, (_, i) => <Skeleton key={i} forma="fila" alto={alto} />)}
    </div>
  );
}

export function EsqueletoDeHallazgos() {
  return (
    <>
      <PanelDeMesa zona="cola" titulo="Cola" icono={<Inbox size={15} />} ocupado>
        <div className="pulso-hz-filtro">
          <Skeleton forma="fila" alto={32} />
          <Skeleton forma="texto" ancho="60%" />
        </div>
        <Filas n={6} alto={44} />
      </PanelDeMesa>
      <PanelDeMesa zona="hallazgo" titulo="Hallazgo" etiquetaCuerpo="Hallazgo" ocupado>
        {/* La marca de "todavía no" de la pestaña: se va con la cola o con su error. */}
        <CargaDeBloque label="Leyendo la cola de hallazgos" />
        <div className="pulso-hz-esqueleto pulso-hz-esqueleto--cabecera">
          <Skeleton forma="card" alto={96} />
          <Skeleton forma="kpi" alto={96} />
        </div>
        <Filas n={7} />
      </PanelDeMesa>
      <PanelDeMesa zona="decision" titulo="Decisión" ocupado>
        <div className="pulso-hz-esqueleto">
          <Skeleton forma="texto" ancho="40%" />
          <Skeleton forma="fila" alto={36} />
          <Skeleton forma="texto" ancho="34%" />
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} forma="card" alto={54} />)}
        </div>
      </PanelDeMesa>
    </>
  );
}

export function RevisionPorFamilia({
  catalogo,
  auditada,
  aplicadas = null,
  onVerReglas,
}: {
  /** `undefined` mientras llega; `null` si no se pudo leer. */
  catalogo: CatalogoCompleto | null | undefined;
  auditada: boolean;
  /** Reglas que evaluó la última auditoría (`n_reglas_evaluadas`); `null` sin auditoría. */
  aplicadas?: number | null;
  onVerReglas: () => void;
}) {
  const titulo = auditada ? "Qué se revisó" : "Qué se va a revisar";
  const acciones = (
    <PulsoButton variant="secondary" size="sm" onClick={onVerReglas}>
      <ListChecks size={14} aria-hidden="true" />
      Ver las reglas
    </PulsoButton>
  );
  let cuerpo: ReactNode;
  if (catalogo === undefined) {
    cuerpo = <CargaDeBloque label="Leyendo el catálogo de reglas" />;
  } else if (catalogo === null || catalogo.familias.length === 0) {
    cuerpo = (
      <div className="pulso-hz-vacio">
        <EstadoVacio
          icono={<ListChecks size={20} />}
          titulo={catalogo === null ? "No se pudo leer el catálogo de reglas" : "El plan no tiene reglas"}
          descripcion={catalogo === null ? "Las reglas se ven en Reglas." : undefined}
        />
      </div>
    );
  } else {
    const { filas, total } = filasDeRevision(catalogo, auditada ? "casos" : "activas");
    const segunda = auditada ? "Casos" : "Activas";
    cuerpo = (
      <div
        className="pulso-hz-tabla pulso-hz-tabla--familias"
        role="table"
        aria-label={titulo}
        aria-rowcount={filas.length + 2}
        data-qa-geometry-group="validacion/hallazgos-familias"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="pulso-hz-tabla-fila pulso-hz-tabla-cabecera" role="row">
          <span role="columnheader">Origen</span>
          <span role="columnheader">Familia</span>
          <span role="columnheader" data-tipo="cifra">En el plan</span>
          <span role="columnheader" data-tipo="cifra">{segunda}</span>
        </div>
        {[...filas, total].map((f) => (
          <div key={f.clave} className="pulso-hz-tabla-fila" role="row" data-total={f.clave === "total" ? "" : undefined}>
            <span role="cell">{f.origen}</span>
            <span role="cell">{f.familia}</span>
            <span role="cell" data-tipo="cifra">{formatoConteo(f.reglas)}</span>
            <span role="cell" data-tipo="cifra">{f.segunda === null ? "Sin dato" : formatoConteo(f.segunda)}</span>
          </div>
        ))}
      </div>
    );
    // Dos conjuntos distintos: las reglas del plan (esta tabla) y las que la auditoría aplicó (la cabecera).
    if (auditada && aplicadas !== null && aplicadas !== total.reglas) {
      cuerpo = (
        <>
          {cuerpo}
          <p className="pulso-hz-nota pulso-hz-nota--tabla">
            La última auditoría aplicó {formatoConteo(aplicadas)} de las {formatoConteo(total.reglas)} reglas del plan; en Reglas se ven las que quedaron sin evaluar o desactivadas.
          </p>
        </>
      );
    }
  }
  return (
    <PanelDeMesa zona="hallazgo" titulo={titulo} acciones={acciones}>
      {cuerpo}
    </PanelDeMesa>
  );
}

export function DecisionVacia({ titulo, descripcion, accion }: { titulo: string; descripcion: string; accion?: ReactNode }) {
  return (
    <PanelDeMesa zona="decision" titulo="Decisión">
      <div className="pulso-hz-vacio">
        <EstadoVacio
          tamano="normal"
          icono={titulo === "Sin casos a la vista" ? <Inbox size={20} /> : <CheckCircle2 size={20} />}
          titulo={titulo}
          descripcion={descripcion}
          accion={accion}
        />
      </div>
    </PanelDeMesa>
  );
}
