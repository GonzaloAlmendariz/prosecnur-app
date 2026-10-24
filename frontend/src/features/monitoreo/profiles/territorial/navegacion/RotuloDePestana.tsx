import { createContext, useContext, type ReactNode } from "react";

/**
 * El rótulo de la pestaña dentro de la propia pestaña (estándar §2a-bis,
 * Gonzalo 2026-10-24): «SECCIÓN · GRUPO / Pestaña» no ocupa una fila suelta;
 * comparte fila con la barra de herramientas de la pestaña o encabeza su
 * primera tarjeta. El rail ya marca la pestaña activa: no lleva ícono.
 *
 * La página lo provee; cada pestaña propia decide dónde va con
 * `<RotuloDePestana />`. Sin proveedor (tests, vistas sueltas) no pinta nada.
 */
export type RotuloDePestanaValor = {
  antetitulo: string;
  titulo: string;
  subvistas: Array<{ panel: string | null; etiqueta: string }>;
  panel: string | null;
  onSubvista: (panel: string | null) => void;
};

const Contexto = createContext<RotuloDePestanaValor | null>(null);

export function RotuloDePestanaProvider({ valor, children }: { valor: RotuloDePestanaValor; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function RotuloDePestana() {
  const valor = useContext(Contexto);
  if (!valor) return null;
  return (
    <span className="mon-ter-rotulo">
      <span className="mon-ter-rotulo-copia">
        <small>{valor.antetitulo}</small>
        <h2>{valor.titulo}</h2>
      </span>
      {valor.subvistas.length > 1 ? (
        <span className="mon-ter-rotulo-subvistas" role="group" aria-label="Vista de la pestaña">
          {valor.subvistas.map((item) => {
            const elegida = (item.panel ?? null) === (valor.panel ?? null);
            return (
              <button
                key={item.panel ?? "principal"}
                type="button"
                aria-pressed={elegida}
                className={elegida ? "is-active" : ""}
                data-subvista={item.panel ?? "principal"}
                onClick={() => {
                  if (!elegida) valor.onSubvista(item.panel);
                }}
              >
                {item.etiqueta}
              </button>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}
