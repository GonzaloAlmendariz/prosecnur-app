// Resumen de la propuesta de módulo de un texto abierto y la confirmación masiva por módulo (TXT-3). Es una propuesta:
// la banda lo dice una vez y cada «Confirmar» se puede deshacer. En CCSS un solo módulo se lleva casi todas las
// propuestas, así que la banda no ofrece «confirmar todo»: se confirma módulo por módulo, viendo cuántas son.

import { Undo2 } from "lucide-react";
import type { CodifSugerenciasSeccion, Grupo, ModuloSugerible } from "../../api/codificacion";
import { formatoConteo } from "../../lib/formatoNumero";
import { pendientesDelModulo, rotuloModulo, type EntradaSugerida } from "./sugerenciasModulo";
import "./sugerenciasModulo.css";

export type UltimaConfirmacion = { modulo: string; n: number };

type Props = {
  datos: CodifSugerenciasSeccion;
  mapa: ReadonlyMap<string, EntradaSugerida>;
  grupos: readonly Grupo[];
  ultima: UltimaConfirmacion | null;
  onConfirmarModulo: (modulo: ModuloSugerible, entradas: EntradaSugerida[]) => void;
  onDeshacer: () => void;
};

export function SugerenciasModuloBanda({ datos, mapa, grupos, ultima, onConfirmarModulo, onDeshacer }: Props) {
  const entradas = [...mapa.values()];
  const sinModulo = entradas.filter((e) => e.candidatoOtro).length;
  const filas = datos.modulos
    .map((m) => ({
      m,
      r: rotuloModulo(m.etiqueta),
      total: entradas.filter((e) => e.propuestas.some((p) => p.codigo === m.codigo)).length,
      pendientes: pendientesDelModulo(mapa, grupos, m.codigo),
    }))
    .filter((f) => f.total > 0);
  return (
    <section
      className="pulso-cv2-modsug-banda"
      aria-labelledby="pulso-cv2-modsug-banda-titulo"
      data-qa-geometry-group="codificacion/sugerencias"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="pulso-cv2-modsug-banda-head">
        <strong id="pulso-cv2-modsug-banda-titulo">Módulo sugerido</strong>
        <span>Es una propuesta, según las palabras que cada comentario comparte con los módulos del formulario. Revísala antes de confirmar.</span>
      </div>
      {filas.length === 0 ? (
        <p className="pulso-cv2-modsug-banda-vacia">Ningún comentario comparte palabras con los módulos del formulario.</p>
      ) : (
        <ul className="pulso-cv2-modsug-banda-lista" data-qa-geometry-group="codificacion/sugerencias-modulos" data-qa-geometry-contract="intrinsic">
          {filas.map(({ m, r, total, pendientes }) => (
            <li key={m.codigo} className="pulso-cv2-modsug-banda-item" data-qa-geometry-member="modulo">
              <span className="pulso-cv2-modsug-banda-modulo" title={m.etiqueta}>{r.corto}</span>
              <span className="pulso-cv2-modsug-banda-n">
                {formatoConteo(total)} {total === 1 ? "respuesta" : "respuestas"}
              </span>
              <button
                type="button"
                className="pulso-cv2-modsug-banda-accion"
                disabled={pendientes.length === 0}
                aria-label={pendientes.length === 1
                  ? `Confirmar la respuesta sugerida para ${r.corto}`
                  : pendientes.length
                  ? `Confirmar las ${pendientes.length} respuestas sugeridas para ${r.corto}`
                  : `Todas las sugeridas para ${r.corto} están confirmadas`}
                onClick={() => onConfirmarModulo(m, pendientes)}
              >
                {pendientes.length ? `Confirmar ${formatoConteo(pendientes.length)}` : "Confirmadas"}
              </button>
            </li>
          ))}
          {sinModulo > 0 && (
            <li className="pulso-cv2-modsug-banda-item is-sin" data-qa-geometry-member="modulo">
              <span className="pulso-cv2-modsug-banda-modulo">Sin módulo claro</span>
              <span className="pulso-cv2-modsug-banda-n">
                {formatoConteo(sinModulo)} {sinModulo === 1 ? "respuesta" : "respuestas"}
              </span>
            </li>
          )}
        </ul>
      )}
      {/* El anuncio lo hace la región viva del codificador; aquí queda el deshacer a mano. */}
      {ultima && (
        <p className="pulso-cv2-modsug-banda-estado">
          {ultima.n === 1 ? "Se confirmó 1 respuesta" : `Se confirmaron ${formatoConteo(ultima.n)} respuestas`} en {ultima.modulo}.{" "}
          <button type="button" className="pulso-cv2-modsug-deshacer" onClick={onDeshacer}>
            <Undo2 size={12} aria-hidden="true" /> Deshacer
          </button>
        </p>
      )}
    </section>
  );
}
