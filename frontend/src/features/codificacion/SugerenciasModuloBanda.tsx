// Resumen de la propuesta de módulo de un texto abierto y la confirmación masiva por módulo (TXT-3). Es una propuesta:
// la banda lo dice una vez y cada «Confirmar» se puede deshacer. En CCSS un solo módulo se lleva casi todas las
// propuestas, así que la banda no ofrece «confirmar todo»: se confirma módulo por módulo, viendo cuántas son.

import { Undo2 } from "lucide-react";
import type { CodifSugerenciasSeccion, Grupo, ModuloSugerible } from "../../api/codificacion";
import { formatoConteo } from "../../lib/formatoNumero";
import { pendientesDelModulo, rotuloDePropuesta, type EntradaSugerida } from "./sugerenciasModulo";
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
  const fila = (m: ModuloSugerible) => ({
    m,
    r: rotuloDePropuesta(m),
    total: entradas.filter((e) => e.propuestas.some((p) => p.codigo === m.codigo)).length,
    pendientes: pendientesDelModulo(mapa, grupos, m.codigo),
  });
  // TXT-17: los subtemas de un módulo partido (TXT-11) van dentro de su módulo, que muestra el total de los suyos.
  const filas = datos.modulos
    .filter((m) => !m.padre)
    .map((m) => {
      const subtemas = datos.modulos.filter((s) => s.padre === m.codigo).map(fila).filter((f) => f.total > 0);
      const codigos = new Set([m.codigo, ...subtemas.map((s) => s.m.codigo)]);
      const total = subtemas.length ? entradas.filter((e) => e.propuestas.some((p) => codigos.has(p.codigo))).length : fila(m).total;
      return { ...fila(m), total, subtemas };
    })
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
          {filas.map(({ m, r, total, pendientes, subtemas }) => subtemas.length ? (
            <li key={m.codigo} className="pulso-cv2-modsug-banda-item is-grupo" data-qa-geometry-member="modulo">
              <span className="pulso-cv2-modsug-banda-modulo" title={m.etiqueta}>{r.corto}</span>
              <span className="pulso-cv2-modsug-banda-n">
                {formatoConteo(total)} {total === 1 ? "respuesta" : "respuestas"}
              </span>
              <ul className="pulso-cv2-modsug-banda-subtemas" aria-label={`Subtemas de ${r.corto}`}
                data-qa-geometry-group="codificacion/sugerencias-subtemas" data-qa-geometry-contract="intrinsic">
                {subtemas.map((s) => (
                  <li key={s.m.codigo} className="pulso-cv2-modsug-banda-item is-subtema" data-qa-geometry-member="subtema">
                    <span className="pulso-cv2-modsug-banda-modulo" title={s.r.completo}>{s.r.nombre}</span>
                    <span className="pulso-cv2-modsug-banda-n">{formatoConteo(s.total)}</span>
                    <BotonConfirmar rotulo={s.r.corto} pendientes={s.pendientes} onConfirmar={() => onConfirmarModulo(s.m, s.pendientes)} />
                  </li>
                ))}
              </ul>
            </li>
          ) : (
            <li key={m.codigo} className="pulso-cv2-modsug-banda-item" data-qa-geometry-member="modulo">
              <span className="pulso-cv2-modsug-banda-modulo" title={r.completo}>{r.corto}</span>
              <span className="pulso-cv2-modsug-banda-n">
                {formatoConteo(total)} {total === 1 ? "respuesta" : "respuestas"}
              </span>
              <BotonConfirmar rotulo={r.corto} pendientes={pendientes} onConfirmar={() => onConfirmarModulo(m, pendientes)} />
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

function BotonConfirmar({ rotulo, pendientes, onConfirmar }: { rotulo: string; pendientes: EntradaSugerida[]; onConfirmar: () => void }) {
  return (
    <button
      type="button"
      className="pulso-cv2-modsug-banda-accion"
      disabled={pendientes.length === 0}
      aria-label={pendientes.length === 1
        ? `Confirmar la respuesta sugerida para ${rotulo}`
        : pendientes.length
        ? `Confirmar las ${pendientes.length} respuestas sugeridas para ${rotulo}`
        : `Todas las sugeridas para ${rotulo} están confirmadas`}
      onClick={onConfirmar}
    >
      {pendientes.length ? `Confirmar ${formatoConteo(pendientes.length)}` : "Confirmadas"}
    </button>
  );
}
