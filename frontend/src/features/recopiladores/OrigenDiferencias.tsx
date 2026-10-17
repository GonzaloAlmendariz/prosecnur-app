import { Link } from "react-router-dom";

import type { CollectionOrigen } from "../../api/recopiladores";
import { EstadoVacio } from "../../components/EstadoVacio";
import { ArrowRight, CheckCircle2, ClipboardList } from "../../vendor/lucide-react";
import { PanelCard, Segmented } from "../xlsformEditor/kit";
import {
  DIRECCION_LISTA,
  avisoDeTruncado,
  filasDeDiferencias,
  opcionesDeFiltro,
  vacioDeLaLista,
  type FiltroDeDiferencias,
} from "./origen";

type Props = {
  origen: CollectionOrigen;
  filtro: FiltroDeDiferencias;
  onFiltro: (filtro: FiltroDeDiferencias) => void;
};

/**
 * Lo que cambió en la fuente desde que se armó el plan, unidad por unidad.
 *
 * C2: el marco —cabecera, filtro y caja— es el mismo con 0, 1 o 2.000
 * diferencias. C3: el vacío dice por qué está vacío y vive dentro de la caja.
 * C4: la caja de filas es la única dueña del scroll.
 */
export function OrigenDiferencias({ origen, filtro, onFiltro }: Props) {
  const sinPlan = origen.estado === "sin_plan";
  const filas = filasDeDiferencias(origen, filtro);
  const truncado = avisoDeTruncado(origen, filtro);
  const opciones = opcionesDeFiltro(origen).map((o) => ({
    value: o.value,
    label: o.label,
    count: o.count.toLocaleString("es-PE"),
  }));

  return (
    <PanelCard
      className="rec-origen-lista"
      fill
      flush
      aria-label="Diferencias con la fuente"
      title="Diferencias"
      meta={sinPlan ? undefined : (
        <Segmented
          aria-label="Filtrar diferencias"
          size="sm"
          value={filtro}
          options={opciones}
          onChange={onFiltro}
        />
      )}
      footer={truncado ? <span className="rec-origen-pie">{truncado}</span> : undefined}
    >
      <div className="rec-origen-filas" data-qa-geometry-capacity="owned">
        {sinPlan ? (
          <EstadoVacio
            className="rec-origen-vacio"
            icono={<ClipboardList size={18} />}
            titulo="Todavía no hay plan"
            descripcion="La lista se arma desde su fuente, en Lista."
            accion={(
              <Link className="pulso-button pulso-button--secondary pulso-button--sm" to={DIRECCION_LISTA}>
                Ir a la lista <ArrowRight size={14} aria-hidden />
              </Link>
            )}
          />
        ) : filas.length === 0 ? (
          <EstadoVacio
            className="rec-origen-vacio"
            icono={<CheckCircle2 size={18} />}
            titulo="Sin diferencias"
            descripcion={vacioDeLaLista(origen, filtro)}
          />
        ) : (
          <table className="rec-origen-tabla">
            <thead>
              <tr>
                <th scope="col">Qué pasa</th>
                <th scope="col">Unidad</th>
                <th scope="col">Detalle</th>
                <th scope="col">Antes</th>
                <th scope="col">Ahora</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.key} data-tipo={fila.tipo}>
                  <td><span className="rec-origen-chip" data-tipo={fila.tipo}>{fila.rotulo}</span></td>
                  <td className="rec-origen-codigo">{fila.codigo}</td>
                  {fila.tipo === "alta" || fila.tipo === "baja" ? (
                    // Entra o sale entera: no hay antes ni ahora, el detalle ocupa el ancho.
                    <td className="rec-origen-que" colSpan={3}>{fila.que || "—"}</td>
                  ) : (
                    <>
                      <td className="rec-origen-que">{fila.que || "—"}</td>
                      <td className="rec-origen-antes">{fila.antes || "—"}</td>
                      <td className="rec-origen-despues">{fila.despues || "—"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PanelCard>
  );
}
