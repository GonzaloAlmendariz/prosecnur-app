import type { ReactNode } from "react";
import type { LogicScope } from "../logic";
import { leerRegla } from "../reglas/leerRegla";
import type { ColumnaRegla, LecturaRegla, Pieza } from "../reglas/piezas";
import { stripMarkdown } from "../helpers/markdown";
import type { BuilderNode } from "../types";
import { GlifoMarca } from "./GlifoMarca";
import { INFO_MARCA, VACIO_MARCA, claveVisible, tieneCasilla, type CasillaRiel, type MarcasNodo } from "./marcasNodo";

// Contenido del panel de una casilla del riel. TODO lo que dice sobre una regla sale del motor (leerRegla, contrato
// en reglas/piezas.ts): si el motor no traduce una regla, el panel lo dice y muestra el código. Nunca se escribe una
// frase propia por regla.

/** Recorte para un rótulo en prosa: corta en el último espacio antes del límite, nunca a mitad de palabra (M5). */
export const corto = (t: string, n = 34) => {
  const x = stripMarkdown(t).replace(/\s+/g, " ").trim();
  if (x.length <= n) return x;
  const corte = x.lastIndexOf(" ", n - 1);
  return `${x.slice(0, corte > n * 0.5 ? corte : n - 1).replace(/[\s,.;:¿¡(«-]+$/, "")}…`;
};

/**
 * Chip de una pregunta u opción citada. El texto largo se recorta con elipsis de CSS (el completo va en el tooltip),
 * y sin etiqueta el chip es el código UNA vez: antes un cálculo sin etiqueta mostraba su código recortado y, al lado,
 * el código entero (M5).
 */
function Chip({ etiqueta, codigo }: { etiqueta: string; codigo: string }) {
  const texto = stripMarkdown(etiqueta).replace(/\s+/g, " ").trim();
  const conTexto = texto !== "" && texto !== codigo;
  return (
    <span className="xfk-pop__ref" title={conTexto ? `${tituloPlano(texto)} · ${codigo}` : codigo}>
      {conTexto ? <span className="xfk-pop__ref-txt"><TituloLegible texto={texto} /></span> : null}
      {codigo ? <code className={conTexto ? undefined : "is-solo"}>{codigo}</code> : null}
    </span>
  );
}

const REF = /\$\{\s*([^}\s]+)\s*\}/g;

/** Un título con `${x}` adentro: cada referencia se cita como chip (su código), nunca como `${x}` crudo (M5). */
export function TituloLegible({ texto }: { texto: string }) {
  const limpio = stripMarkdown(texto).replace(/\s+/g, " ").trim();
  const partes: ReactNode[] = [];
  let desde = 0;
  for (const m of limpio.matchAll(REF)) {
    const i = m.index ?? 0;
    if (i > desde) partes.push(limpio.slice(desde, i));
    partes.push(<code key={i} className="xfk-pop__var">{m[1]}</code>);
    desde = i + m[0].length;
  }
  if (desde < limpio.length) partes.push(limpio.slice(desde));
  return <>{partes}</>;
}

/** El mismo título en texto plano (tooltip, nombre accesible): `${x}` pasa a «etiqueta de x» o, sin ella, a «x». */
export function tituloPlano(texto: string, etiquetaDe?: (name: string) => string | null | undefined): string {
  return stripMarkdown(texto)
    .replace(/\s+/g, " ")
    .trim()
    .replace(REF, (_m, n: string) => `«${(etiquetaDe?.(n) ?? "").trim() || n}»`);
}

export function PiezasLectura({ piezas }: { piezas: readonly Pieza[] }) {
  return (
    <>
      {piezas.map((p, i) => {
        const sep = i > 0 ? " " : "";
        if (p.tipo === "pregunta") return <span key={i}>{sep}<Chip etiqueta={p.etiqueta} codigo={p.name} /></span>;
        if (p.tipo === "opcion") return <span key={i}>{sep}<Chip etiqueta={p.etiqueta} codigo={p.valor} /></span>;
        return <span key={i}>{sep}{p.texto}</span>;
      })}
    </>
  );
}

function Bloque({ lectura, sub, extra }: { lectura: LecturaRegla; sub?: string; extra?: ReactNode }) {
  return (
    <div className="xfk-pop__bloque">
      {sub ? <span className="xfk-pop__sub">{sub}</span> : null}
      {lectura.tecnica
        ? <p className="xfk-pop__tecnica">El motor todavía no traduce esta regla.</p>
        : <p className="xfk-pop__lectura"><PiezasLectura piezas={lectura.piezas} /></p>}
      {extra}
      {lectura.tecnica && lectura.depende.length ? (
        <div className="xfk-pop__dep">
          <span>Depende de</span>
          {lectura.depende.map((d) => <Chip key={d.name} etiqueta={d.etiqueta} codigo={d.name} />)}
        </div>
      ) : null}
    </div>
  );
}

function BloqueFijo({ titulo, nota, vacio }: { titulo: string; nota: string; vacio?: boolean }) {
  return (
    <div className={vacio ? "xfk-pop__bloque is-vacio" : "xfk-pop__bloque"}>
      <strong>{titulo}</strong>
      <p className="xfk-pop__nota">{nota}</p>
    </div>
  );
}

export type CuerpoPanelMarcaProps = {
  clave: CasillaRiel;
  marcas: MarcasNodo;
  nodo: BuilderNode;
  scope: LogicScope;
  idTitulo: string;
  onCerrar?: () => void;
};

export function CuerpoPanelMarca({ clave, marcas, nodo, scope, idTitulo, onCerrar }: CuerpoPanelMarcaProps) {
  const kk = claveVisible(marcas, clave);
  const info = INFO_MARCA[kk];
  const etiqueta = stripMarkdown(nodo.label).trim();
  const titulo = etiqueta || nodo.name;
  const leer = (col: ColumnaRegla, raw: string, n: BuilderNode = nodo) => leerRegla(col, raw, n, scope);
  const partes: ReactNode[] = [];
  const lineas: string[] = [];
  let tecnica = false;

  if (!tieneCasilla(marcas, clave)) {
    const [t, d] = VACIO_MARCA[clave];
    partes.push(<BloqueFijo key="v" titulo={t} nota={d} vacio />);
  } else if (clave === "oblig" && marcas.oblig) {
    if (marcas.oblig.siempre) {
      partes.push(<BloqueFijo key="s" titulo="Siempre" nota="La encuesta no se puede finalizar sin esta respuesta." />);
      lineas.push("required: yes");
    } else {
      const l = leer("required", marcas.oblig.raw);
      // El motor ya dice «Obligatoria si …»: un subtítulo lo repetiría.
      partes.push(<Bloque key="r" lectura={l} />);
      lineas.push(`required: ${marcas.oblig.raw}`);
      tecnica = l.tecnica;
    }
  } else if (clave === "cond") {
    if (marcas.cond) {
      const l = leer("relevant", marcas.cond);
      const esBloque = nodo.kind === "section" || nodo.kind === "repeat";
      partes.push(<Bloque key="c" lectura={l} sub={esBloque ? "La sección aparece si" : "Aparece si"} />);
      lineas.push(`relevant: ${marcas.cond}`);
      tecnica ||= l.tecnica;
    }
    marcas.hered.forEach((h, i) => {
      const l = leer("relevant", h.raw, h.nodo);
      partes.push(<Bloque key={`h${i}`} lectura={l} sub={`Heredada de la sección «${corto(h.etiqueta, 40)}»`} />);
      lineas.push(`relevant de la sección: ${h.raw}`);
      tecnica ||= l.tecnica;
    });
  } else if (clave === "regla" && marcas.regla) {
    const l = leer("constraint", marcas.regla.raw);
    const msg = marcas.regla.mensaje
      ? <p className="xfk-pop__msg"><span>Mensaje del formulario</span>«{marcas.regla.mensaje}»</p>
      : <p className="xfk-pop__nota">El formulario no trae mensaje para quien se equivoca.</p>;
    partes.push(<Bloque key="r" lectura={l} extra={msg} />);
    lineas.push(`constraint: ${marcas.regla.raw}`);
    tecnica = l.tecnica;
  } else if (clave === "calc" && marcas.calc) {
    const l = leer("calculation", marcas.calc);
    partes.push(<Bloque key="k" lectura={l} sub="Se calcula como" />);
    lineas.push(`calculation: ${marcas.calc}`);
    tecnica = l.tecnica;
  } else if (clave === "filtro" && marcas.filtro) {
    const l = leer("choice_filter", marcas.filtro.raw);
    const lista = l.lista || marcas.filtro.lista;
    const extra = lista ? (
      <div className="xfk-pop__dep"><span>Opciones de la lista</span><span className="xfk-pop__ref"><code>{lista}</code></span></div>
    ) : null;
    partes.push(<Bloque key="f" lectura={l} extra={extra} />);
    lineas.push(`choice_filter: ${marcas.filtro.raw}`);
    tecnica = l.tecnica;
  }

  return (
    <>
      <header className="xfk-pop__cab">
        <span className="xfk-pop__icono"><GlifoMarca clave={kk} size={16} /></span>
        <span className="xfk-pop__titulos">
          <span className="xfk-pop__tipo" id={idTitulo}>{info.nombre}</span>
          <span className="xfk-pop__preg" title={tituloPlano(titulo)}>{etiqueta ? <TituloLegible texto={etiqueta} /> : <code className="xfk-pop__var">{nodo.name}</code>}</span>
        </span>
        <button type="button" className="xfk-pop__x" aria-label="Cerrar" onClick={onCerrar}>×</button>
      </header>
      <div className="xfk-pop__cuerpo">
        {partes}
        {lineas.length ? (
          <details className="xfk-pop__codigo" open={tecnica || undefined}>
            <summary>Ver código XLSForm</summary>
            {lineas.map((c, i) => <code key={i} className="xfk-pop__code">{c}</code>)}
          </details>
        ) : null}
      </div>
    </>
  );
}
