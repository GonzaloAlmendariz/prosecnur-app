import { useMemo, useState } from "react";

import { Search } from "../../../../vendor/lucide-react";
import { cifra, type FilaBorrador, normalizarBusqueda, porcentaje, textoAMeta } from "./avanceCuotasModelo";

// Tabla editable de metas por categoría, dentro del panel de la cuota. La
// lista va completa (hasta ~150 categorías) con filtro por texto; el cuerpo
// del panel es su único dueño de scroll y la cabecera de la tabla queda fija.

const UMBRAL_FILTRO = 12;

export function AvanceCuotasEditorMetas({
  filas,
  deshabilitado,
  onMeta,
}: {
  filas: FilaBorrador[];
  deshabilitado: boolean;
  onMeta: (categoria: string, meta: string) => void;
}) {
  const [filtro, setFiltro] = useState("");
  const visibles = useMemo(() => {
    const f = normalizarBusqueda(filtro);
    return f ? filas.filter((x) => normalizarBusqueda(x.categoria).includes(f)) : filas;
  }, [filas, filtro]);

  return (
    <div className="mon-cuotas-editor">
      {filas.length > UMBRAL_FILTRO ? (
        <label className="mon-cuotas-buscar">
          <Search size={14} aria-hidden />
          <span className="pulso-sr-only">Filtrar categorías</span>
          <input
            type="search"
            value={filtro}
            placeholder={`Filtrar ${cifra(filas.length)} categorías`}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </label>
      ) : null}
      <table className="mon-cuotas-editor-tabla">
        <thead>
          <tr>
            <th scope="col">Categoría</th>
            <th scope="col" className="is-num">Universo</th>
            <th scope="col" className="is-num">Meta</th>
            <th scope="col" className="is-num">De su universo</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((f) => {
            const meta = textoAMeta(f.meta);
            return (
              <tr key={f.categoria}>
                <th scope="row">{f.categoria}</th>
                <td className="is-num">{cifra(f.universo)}</td>
                <td className="is-num">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={f.meta}
                    disabled={deshabilitado}
                    aria-label={`Meta de ${f.categoria}`}
                    onChange={(e) => onMeta(f.categoria, e.target.value)}
                  />
                </td>
                <td className="is-num mon-cuotas-tenue">{f.universo ? porcentaje(meta / f.universo) : "—"}</td>
              </tr>
            );
          })}
          {!visibles.length ? (
            <tr>
              <td colSpan={4} className="mon-cuotas-tenue">Ninguna categoría contiene «{filtro}».</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
