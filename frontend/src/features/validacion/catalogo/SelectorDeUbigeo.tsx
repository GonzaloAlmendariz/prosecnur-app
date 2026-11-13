/**
 * Selector de un lugar del catálogo nacional de ubigeos: busca mientras se
 * escribe (sin tildes ni mayúsculas, por nombre o por código) y deja bajar en
 * cascada, de departamento a provincia y de provincia a distrito. Devuelve el
 * distrito elegido con sus tres niveles y su ubigeo, para reemplazar de una
 * vez todas las columnas de lugar de un caso.
 *
 * No escribe nada: quien lo monta decide qué hacer con el lugar elegido. El
 * motor es `api/R/catalogo_ubigeo.R` (`catalogo_ubigeo_buscar()`,
 * `catalogo_ubigeo_cascada()`).
 */
import { useEffect, useState } from "react";
import {
  apiCatalogoUbigeoBuscar,
  apiCatalogoUbigeoCascada,
  type LugarDelCatalogo,
  type NivelDeCatalogo,
} from "../../../api/catalogoUbigeo";
import { PulsoInput } from "../../../components/PulsoInput";
import "./selectorDeUbigeo.css";

export type ApiDelSelector = {
  buscar: typeof apiCatalogoUbigeoBuscar;
  cascada: typeof apiCatalogoUbigeoCascada;
};

const API_REAL: ApiDelSelector = { buscar: apiCatalogoUbigeoBuscar, cascada: apiCatalogoUbigeoCascada };
const ESPERA_MS = 200;

const ROTULO_DEL_NIVEL: Readonly<Record<NivelDeCatalogo, string>> = {
  departamento: "Departamento",
  provincia: "Provincia",
  distrito: "Distrito",
};

type Posicion = { departamento: string | null; provincia: string | null };

export function SelectorDeUbigeo({
  alElegir,
  ariaLabel = "Buscar un lugar del catálogo de ubigeos",
  api = API_REAL,
  esperaMs = ESPERA_MS,
}: {
  /** El distrito elegido, con departamento, provincia, distrito y ubigeo. */
  alElegir: (lugar: LugarDelCatalogo) => void;
  ariaLabel?: string;
  /** Para pruebas: las llamadas al motor. */
  api?: ApiDelSelector;
  esperaMs?: number;
}) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<LugarDelCatalogo[] | null>(null);
  const [posicion, setPosicion] = useState<Posicion>({ departamento: null, provincia: null });
  const [lista, setLista] = useState<LugarDelCatalogo[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Búsqueda: espera a que se deje de escribir y cancela la anterior.
  useEffect(() => {
    const q = consulta.trim();
    if (!q) {
      setResultados(null);
      return;
    }
    const control = new AbortController();
    const reloj = setTimeout(() => {
      api
        .buscar(q, { nivel: "todos", limite: 20, signal: control.signal })
        .then((r) => {
          setResultados(r);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!control.signal.aborted) setError(e instanceof Error ? e.message : "No se pudo buscar en el catálogo.");
        });
    }, esperaMs);
    return () => {
      clearTimeout(reloj);
      control.abort();
    };
  }, [consulta, api, esperaMs]);

  // Cascada: la lista del nivel en que se está.
  useEffect(() => {
    const control = new AbortController();
    api
      .cascada(posicion.departamento, posicion.provincia, { signal: control.signal })
      .then((r) => {
        setLista(r.lugares);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!control.signal.aborted) setError(e instanceof Error ? e.message : "No se pudo leer el catálogo.");
      });
    return () => control.abort();
  }, [posicion, api]);

  const elegir = (lugar: LugarDelCatalogo) => {
    if (lugar.nivel === "distrito") {
      alElegir(lugar);
      return;
    }
    // Un departamento o una provincia: se baja a su lista.
    setConsulta("");
    setPosicion({ departamento: lugar.departamento, provincia: lugar.nivel === "provincia" ? lugar.provincia : null });
  };

  const enBusqueda = resultados !== null && consulta.trim() !== "";
  const nivelDeLaLista: NivelDeCatalogo = posicion.provincia ? "distrito" : posicion.departamento ? "provincia" : "departamento";
  const visibles = enBusqueda ? resultados : lista;

  return (
    <div className="pulso-selector-ubigeo">
      <PulsoInput
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        placeholder="Distrito, provincia, departamento o ubigeo"
        aria-label={ariaLabel}
        type="search"
      />
      {!enBusqueda ? (
        <nav className="pulso-selector-ubigeo-ruta" aria-label="Nivel del catálogo">
          <button type="button" onClick={() => setPosicion({ departamento: null, provincia: null })} aria-current={nivelDeLaLista === "departamento" ? "true" : undefined}>
            Perú
          </button>
          {posicion.departamento ? (
            <button type="button" onClick={() => setPosicion({ departamento: posicion.departamento, provincia: null })} aria-current={nivelDeLaLista === "provincia" ? "true" : undefined}>
              {posicion.departamento}
            </button>
          ) : null}
          {posicion.provincia ? (
            <button type="button" aria-current="true" onClick={() => undefined}>
              {posicion.provincia}
            </button>
          ) : null}
        </nav>
      ) : null}
      {error ? <p className="pulso-selector-ubigeo-aviso" role="alert">{error}</p> : null}
      {enBusqueda && visibles.length === 0 ? (
        <p className="pulso-selector-ubigeo-aviso">Ningún lugar del catálogo coincide con "{consulta.trim()}".</p>
      ) : null}
      <ul className="pulso-selector-ubigeo-lista" aria-label={enBusqueda ? "Lugares encontrados" : `${ROTULO_DEL_NIVEL[nivelDeLaLista]}s`}>
        {visibles.map((l) => (
          <li key={`${l.nivel}-${l.codigo ?? l.ruta}`}>
            <button type="button" onClick={() => elegir(l)}>
              <span>{enBusqueda ? l.ruta : nombreDelNivel(l)}</span>
              <small>{enBusqueda ? `${ROTULO_DEL_NIVEL[l.nivel]}${l.codigo ? `, ${l.codigo}` : ""}` : l.codigo ?? ""}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function nombreDelNivel(l: LugarDelCatalogo): string {
  if (l.nivel === "distrito") return l.distrito ?? l.ruta;
  if (l.nivel === "provincia") return l.provincia ?? l.ruta;
  return l.departamento ?? l.ruta;
}
