// "Qué cambia" (prototipo `carga-actualizar`): las respuestas, el formulario, el
// trabajo ya hecho por fase y las decisiones de limpieza. La misma vista sirve
// antes de aplicar (vista previa) y después (lo que se aplicó).

import type { ReactNode } from "react";
import type {
  CambiosDeActualizacion,
  DecisionDeActualizacion,
  FaseDeActualizacion,
  ItemDeFase,
} from "../../../api/cargaActualizar";
import { Alert } from "../../../components/Alert";
import { CifrasEnTarjeta } from "../../../components/CifrasEnTarjeta";
import { Panel } from "../../../components/Panel";
import { formatoConteoDe } from "../../../lib/formatoNumero";
import { CheckCircle2 } from "../../../vendor/lucide-react";
import {
  cifrasDeCasos,
  detalleDeDecision,
  hayPerdidas,
  itemsQueSeConservan,
  lineaDeIdentificador,
  lineaDeTotales,
  rotuloDeDecision,
  rotuloDeItem,
} from "./actualizarFuenteModel";

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section
      className="pulso-actualizar-seccion"
      aria-labelledby={`actualizar-${id}`}
      data-qa-geometry-group={`carga/actualizar-${id}`}
      data-qa-geometry-contract="intrinsic"
    >
      <h4 id={`actualizar-${id}`} className="pulso-actualizar-sub">{titulo}</h4>
      {children}
    </section>
  );
}

function Items({ items, clase }: { items: readonly ItemDeFase[]; clase: "conserva" | "rehacer" | "pierde" }) {
  if (!items.length) return <span className="pulso-actualizar-nada">Nada</span>;
  return (
    <ul className="pulso-actualizar-items" data-clase={clase}>
      {items.map((it, i) => (
        <li key={`${it.clave}-${i}`}>
          <span>{rotuloDeItem(it)}</span>
          {it.causa ? <small>{it.causa}</small> : null}
        </li>
      ))}
    </ul>
  );
}

function EfectoPorFase({ fases }: { fases: readonly FaseDeActualizacion[] }) {
  const conPerdidas = hayPerdidas(fases);
  return (
    <div className="pulso-actualizar-efecto" role="table" aria-label="Efecto en el trabajo ya hecho" data-columnas={conPerdidas ? 4 : 3}>
      <div role="rowgroup" className="pulso-actualizar-efecto-cab">
        <div role="row">
          <span role="columnheader">Fase</span>
          <span role="columnheader">Se conserva</span>
          <span role="columnheader">Hay que rehacer</span>
          {conPerdidas ? <span role="columnheader">Se pierde</span> : null}
        </div>
      </div>
      <div role="rowgroup">
        {fases.map((f) => (
          <div role="row" key={f.fase}>
            <span role="rowheader" className="pulso-actualizar-fase">{f.nombre}</span>
            <span role="cell"><Items items={itemsQueSeConservan(f.seConserva)} clase="conserva" /></span>
            <span role="cell"><Items items={f.hayQueRehacer} clase="rehacer" /></span>
            {conPerdidas ? <span role="cell"><Items items={f.sePierde} clase="pierde" /></span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Decisiones({ decisiones }: { decisiones: readonly DecisionDeActualizacion[] }) {
  return (
    <ul className="pulso-actualizar-decisiones">
      {decisiones.map((d) => {
        const detalle = detalleDeDecision(d);
        return (
          <li key={d.id} data-destino={d.destino}>
            <div>
              <strong>{rotuloDeDecision(d)}</strong>
              {detalle ? <small>{detalle}</small> : null}
              {d.causa ? <p>{d.causa}</p> : null}
            </div>
            <span className="pulso-actualizar-destino">{d.destino === "conserva" ? "Se conserva" : "Se pierde"}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function QueCambia({
  cambios,
  formulario,
  fases,
  decisiones,
}: {
  cambios: CambiosDeActualizacion;
  formulario: { cambia: boolean; causa: string | null } | null;
  fases: readonly FaseDeActualizacion[];
  decisiones: readonly DecisionDeActualizacion[];
}) {
  const cifras = cifrasDeCasos(cambios.casos);
  const totales = lineaDeTotales(cambios.casos);
  const identificador = cifras ? lineaDeIdentificador(cambios.identificador.columnas, cambios.casos.celdasCambiadas) : null;
  const { columnas } = cambios;
  const hayColumnas = columnas.nuevas.length + columnas.yaNoVienen.length + columnas.conCambios.length + columnas.noComparadas.length > 0;
  return (
    <>
      <Seccion id="respuestas" titulo="En las respuestas">
        {cifras ? (
          <CifrasEnTarjeta grupo="carga/actualizar-cifras" cifras={cifras} />
        ) : (
          <Alert kind="warn">{cambios.casos.causa ?? "El motor no pudo emparejar las respuestas de las dos versiones."}</Alert>
        )}
        {totales || identificador ? (
          <p className="pulso-actualizar-nota">{[totales, identificador].filter(Boolean).join(" ")}</p>
        ) : null}
      </Seccion>

      {hayColumnas ? (
        <Seccion id="columnas" titulo="En las columnas">
          <dl className="pulso-actualizar-columnas">
            {columnas.nuevas.length ? (
              <div><dt>Nuevas</dt><dd>{columnas.nuevas.map((c) => <code key={c}>{c}</code>)}</dd></div>
            ) : null}
            {columnas.yaNoVienen.length ? (
              <div><dt>Ya no vienen</dt><dd>{columnas.yaNoVienen.map((c) => <code key={c}>{c}</code>)}</dd></div>
            ) : null}
            {columnas.conCambios.length ? (
              <div>
                <dt>Con cambios</dt>
                <dd>
                  {columnas.conCambios.map((c) => (
                    <span key={c.columna} className="pulso-actualizar-col">
                      <code>{c.columna}</code>
                      {c.nCasos !== null ? <small>{formatoConteoDe(c.nCasos, "respuesta")}</small> : null}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {columnas.noComparadas.length ? (
              <div>
                <dt>Sin comparar</dt>
                <dd>
                  {columnas.noComparadas.map((c) => (
                    <span key={c.columna} className="pulso-actualizar-col">
                      <code>{c.columna}</code>
                      {c.causa ? <small>{c.causa}</small> : null}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        </Seccion>
      ) : null}

      {formulario ? (
        <Seccion id="formulario" titulo="En el formulario">
          <Panel noPadding className="pulso-actualizar-formulario">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{formulario.causa ?? (formulario.cambia ? "El formulario cambia." : "El formulario no cambia.")}</span>
          </Panel>
        </Seccion>
      ) : null}

      {fases.length ? (
        <Seccion id="fases" titulo="En el trabajo ya hecho">
          <EfectoPorFase fases={fases} />
        </Seccion>
      ) : null}

      {decisiones.length ? (
        <Seccion id="decisiones" titulo="Decisiones de limpieza">
          <Decisiones decisiones={decisiones} />
        </Seccion>
      ) : null}
    </>
  );
}
