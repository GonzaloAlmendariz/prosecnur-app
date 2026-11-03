// Los contadores de la franja de Fuentes.
//
// Cuentan lo que las otras dos franjas de la pantalla NO dicen, y ahí está el
// arreglo. El ANTES tenía tres problemas juntos:
//
//   · «FUENTES 13/13» aparecía aquí por tercera vez —la barra de módulo ya lo
//     dice como «ACTIVAS» y el workbench como «FUENTES»— (A7);
//   · «BASE 4» convivía a veinte píxeles de otra franja que decía
//     «BASE 1,277»: fuentes de universo contra registros del corte, misma
//     etiqueta, dos números (A6);
//   · «Plataforma» nombraba el proveedor en vez de lo que se cuenta.
//
// Contrato: docs/plan-fuentes-legibles-2026-07.md R3.

import { Layers3, ListChecks } from "../../../../../vendor/lucide-react";
import { formatoConteo } from "../../../../../lib/formatoNumero";

export function FranjaDeFuentes({
  universo,
  encuestas,
  barrido,
}: {
  universo: number;
  encuestas: number;
  barrido: number;
}) {
  return (
    <div className="mon-acr-source-status-metrics">
      <span className={universo ? "is-ready" : "is-warning"}>
        <Layers3 size={14} />
        <em>Universo</em>
        <strong>{formatoConteo(universo)}</strong>
        <small>{universo === 1 ? "base conectada" : "bases conectadas"}</small>
      </span>
      <span className={encuestas ? "is-ready" : "is-warning"}>
        <ListChecks size={14} />
        <em>Encuestas</em>
        <strong>{formatoConteo(encuestas)}</strong>
        <small>{barrido ? `${formatoConteo(barrido)} de barrido` : "sin barrido"}</small>
      </span>
    </div>
  );
}
