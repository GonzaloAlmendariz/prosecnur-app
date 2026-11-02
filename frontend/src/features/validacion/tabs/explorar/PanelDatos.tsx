import { ClipboardCheck } from "../../../../vendor/lucide-react";
import type { ExploradorFicha } from "../../../../api/validacionExplorar";
import { fmtN, fmtPct } from "./explorarModelo";

/**
 * E11 — «Lo que se ve en los datos». Sólo cifras que la ficha trae; las reglas
 * de validación aún no se aplican por pregunta, así que se dice eso y no se
 * pinta ningún semáforo.
 */
export default function PanelDatos({ ficha, filtrado }: { ficha: ExploradorFicha; filtrado: boolean }) {
  const d = ficha.datos;
  const categorica = ficha.tipo === "so" || ficha.tipo === "sm";
  return (
    <section className="vx-tarjeta vx-panel" aria-label="Lo que se ve en los datos">
      <h4>Lo que se ve en los datos</h4>
      {filtrado && <p>Sobre toda la base, sin los filtros de arriba.</p>}
      <dl className="vx-dl is-cifras">
        <dt>Sin respuesta</dt>
        <dd>
          {fmtN(d.n_sin_respuesta)}
          {d.n_total > 0 ? ` · ${fmtPct((100 * d.n_sin_respuesta) / d.n_total)}` : ""}
        </dd>
        {categorica && (
          <>
            <dt>Casos con códigos fuera de la lista</dt>
            <dd>{fmtN(d.n_fuera_de_lista)}</dd>
          </>
        )}
        {d.n_otro_textos !== null && (
          <>
            <dt>Textos en «Otro»</dt>
            <dd>{fmtN(d.n_otro_textos)}</dd>
          </>
        )}
      </dl>
      <div className="vx-reglas">
        <ClipboardCheck size={16} aria-hidden />
        <span>Reglas de validación: aún no hay ninguna aplicada a esta pregunta.</span>
      </div>
    </section>
  );
}
