import { ArrowDownLeft, ArrowUpRight, Link2, Unlink } from "../../../vendor/lucide-react";

import type {
  BitacoraEstado,
  BitacoraOrigenVinculo,
  BitacoraResumenDestino,
  BitacoraRetroenlace,
} from "../../../api/bitacora";
import "./vinculos.css";

/**
 * Los vínculos de una entidad, en las dos direcciones (ADR 0047).
 *
 * Salientes: lo que ESTA entidad declaró apuntar.
 * Entrantes: quién la apunta a ella, según el índice derivado.
 *
 * Las dos listas se ven distintas a propósito. Un vínculo saliente se puede
 * quitar desde acá porque este lado es su dueño; uno entrante no, porque
 * pertenece a la otra entidad y borrarlo desde acá sería editar algo que el
 * usuario no está mirando.
 */
export function ListaDeVinculos({
  estado,
  origenTipo,
  origenId,
  salientes,
  onDesvincular,
}: {
  estado: BitacoraEstado;
  origenTipo: BitacoraOrigenVinculo;
  origenId: string;
  salientes: Array<{ target_type: string; target_id: string; relation: string }>;
  onDesvincular: (destinoTipo: string, destinoId: string) => void;
}) {
  const clavePropia = `${origenTipo}:${origenId}`;
  const entrantes: BitacoraRetroenlace[] = estado.vinculos.por_destino[clavePropia] ?? [];

  if (salientes.length === 0 && entrantes.length === 0) {
    return (
      <p className="bit-vinculos-vacio">
        Sin vínculos. Enlazar esto con un hito o una entrada deja el rastro de
        por qué pasó lo que pasó.
      </p>
    );
  }

  return (
    <div className="bit-vinculos">
      {salientes.length > 0 && (
        <section aria-label="Vínculos declarados desde aquí">
          <h5 className="bit-vinculos-titulo">
            <ArrowUpRight size={12} aria-hidden="true" />
            <span>Apunta a</span>
          </h5>
          <ul>
            {salientes.map((v) => {
              const resumen = estado.vinculos.resumenes[`${v.target_type}:${v.target_id}`];
              return (
                <li key={`${v.target_type}:${v.target_id}`} className="bit-vinculo">
                  <Destino resumen={resumen} tipo={v.target_type} id={v.target_id} />
                  <span className="bit-vinculo-relacion">{v.relation}</span>
                  <button
                    type="button"
                    onClick={() => onDesvincular(v.target_type, v.target_id)}
                    aria-label={`Quitar el vínculo con ${resumen?.titulo || v.target_id}`}
                    title="Quitar vínculo"
                  >
                    <Unlink size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {entrantes.length > 0 && (
        <section aria-label="Entidades que apuntan aquí">
          <h5 className="bit-vinculos-titulo">
            <ArrowDownLeft size={12} aria-hidden="true" />
            <span>Referenciado desde</span>
          </h5>
          <ul>
            {entrantes.map((r) => (
              <li key={`${r.source_type}:${r.source_id}`} className="bit-vinculo is-entrante">
                <span className="bit-vinculo-destino">
                  <Link2 size={12} aria-hidden="true" />
                  <span>{r.source_label || r.source_id}</span>
                  <small>{etiquetaTipo(r.source_type)}</small>
                </span>
                <span className="bit-vinculo-relacion">{r.relation}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Destino({
  resumen,
  tipo,
  id,
}: {
  resumen: BitacoraResumenDestino | undefined;
  tipo: string;
  id: string;
}) {
  // Un destino que ya no existe se dice, no se oculta: el ADR pide que no
  // queden referencias rotas SILENCIOSAS, y ocultar es la forma más silenciosa
  // de todas. En la práctica el gc del servidor lo limpia, así que esto es la
  // red por si el payload llega desfasado.
  if (!resumen?.existe) {
    return (
      <span className="bit-vinculo-destino is-huerfano">
        <Unlink size={12} aria-hidden="true" />
        <span>El destino ya no existe</span>
        <small>{id}</small>
      </span>
    );
  }
  return (
    <span className="bit-vinculo-destino">
      <Link2 size={12} aria-hidden="true" />
      <span>{resumen.titulo}</span>
      <small>{etiquetaTipo(tipo)}</small>
    </span>
  );
}

function etiquetaTipo(tipo: string): string {
  if (tipo === "tarea") return "hito";
  if (tipo === "entrada") return "bitácora";
  if (tipo === "nodo") return "nodo";
  if (tipo === "lienzo") return "lienzo";
  return tipo;
}
