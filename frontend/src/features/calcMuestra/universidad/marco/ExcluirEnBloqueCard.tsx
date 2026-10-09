/**
 * Apagar una lista entera de cursos-horario pegándola.
 *
 * Vive AQUÍ, sobre el selector de facultad, y no dentro de `AulasFinalesCard`,
 * porque una lista real cruza facultades: en el segundo sorteo de HSVG 2026 la
 * DAA se llevó 120 cursos-horario repartidos por todo el marco. La tarjeta por
 * facultad sigue siendo la puerta para apagar uno mirándolo; ésta es la puerta
 * para traer una decisión que ya se tomó fuera.
 *
 * Lo que el pegado no reconoce se enseña, nunca se descarta en silencio: una
 * lista sacada de un Excel trae encabezados, filas en blanco y códigos de otro
 * semestre, y creer que se excluyeron 120 habiendo excluido 96 es justo el
 * defecto que esta pantalla existe para evitar.
 */
import { useState } from "react";
import { ClipboardList } from "../../../../vendor/lucide-react";
import type { CriteriosSeleccionMarco } from "../../../../api/client";
import { excluirEnBloque, type ExclusionEnBloque } from "../criterios/aulasFinalesModel";
import "./excluirEnBloque.css";

export function ExcluirEnBloqueCard({
  seleccion,
  clavesDelMarco,
  onExcluir,
}: {
  seleccion: CriteriosSeleccionMarco;
  /** `classroom_id` de todo el marco, en crudo o en text_key. */
  clavesDelMarco: readonly string[];
  onExcluir: (siguiente: CriteriosSeleccionMarco) => void;
}) {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<ExclusionEnBloque | null>(null);

  function aplicar() {
    const r = excluirEnBloque(seleccion, texto, clavesDelMarco);
    setResultado(r);
    if (r.excluidas.length) {
      onExcluir(r.seleccion);
      setTexto("");
    }
  }

  return (
    <section className="cmv2-exbloque" aria-label="Apagar una lista de cursos-horario">
      <header className="cmv2-exbloque-head">
        <ClipboardList size={14} aria-hidden="true" />
        <span>
          <strong>Apagar una lista</strong>
          <small>pega los códigos de curso-horario que no entran al marco</small>
        </span>
      </header>
      <textarea
        className="cmv2-exbloque-area"
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
        rows={3}
        spellCheck={false}
        aria-label="Códigos de curso-horario a apagar"
        placeholder={"1inf46_1081\n1inf26_0881\n…"}
      />
      <div className="cmv2-exbloque-pie">
        <button type="button" className="cmv2-btn" onClick={aplicar} disabled={!texto.trim()}>
          Apagar los pegados
        </button>
        <small>
          Uno por línea, o separados por coma, tabulador o punto y coma. Sólo
          apaga: los que ya estaban encendidos y no aparezcan aquí siguen igual.
        </small>
      </div>
      {resultado && (
        <p className="cmv2-exbloque-saldo" role="status">
          {resultado.excluidas.length > 0 && (
            <span data-parte="ok">
              <b>{resultado.excluidas.length}</b> apagados
            </span>
          )}
          {resultado.yaEstaban.length > 0 && (
            <span data-parte="repe">
              <b>{resultado.yaEstaban.length}</b> ya lo estaban
            </span>
          )}
          {resultado.desconocidas.length > 0 && (
            <span data-parte="ojo">
              <b>{resultado.desconocidas.length}</b> sin correspondencia en el marco:{" "}
              {resultado.desconocidas.slice(0, 4).join(", ")}
              {resultado.desconocidas.length > 4 && ` y ${resultado.desconocidas.length - 4} más`}
            </span>
          )}
          {resultado.excluidas.length === 0
            && resultado.yaEstaban.length === 0
            && resultado.desconocidas.length === 0 && <span>No había nada que apagar.</span>}
        </p>
      )}
    </section>
  );
}
