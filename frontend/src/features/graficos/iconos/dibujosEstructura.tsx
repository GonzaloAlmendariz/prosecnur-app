// Láminas de estructura dibujadas en su tamaño real (13,333 × 7,5 in) para `ComposicionLamina` (F6.2). No tienen ranuras
// en el estándar: se dibujan desde la geometría del motor (api/R/lamina_identidad.R) con sus variantes —portada
// centrada/izquierda/banda (23–25), índice arcos/facetas/círculos/bloques (31…), separador capítulo/subcapítulo (4, 5),
// cierre en sus cinco composiciones (61–65)—. Es un esquema didáctico, no la lámina rasterizada: el visor muestra esa.

type Clase = "tinta" | "titulo" | "suave" | "acento" | "banda" | "banda-clara" | "logo" | "ilustracion" | "papel-claro";

function Caja({ x, y, w, h, c, rx = 0.06 }: { x: number; y: number; w: number; h: number; c: Clase; rx?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={rx} className={`pulso-composicion__${c}`} />;
}

/** Renglón de texto: una barra redondeada. */
function Renglon({ x, y, w, h = 0.12, c = "suave" }: { x: number; y: number; w: number; h?: number; c?: Clase }) {
  return <Caja x={x} y={y} w={w} h={h} c={c} rx={h / 2} />;
}

function Centrado({ y, w, h, c }: { y: number; w: number; h: number; c: Clase }) {
  return <Renglon x={(13.333 - w) / 2} y={y} w={w} h={h} c={c} />;
}

/** Cabecera de lámina de contenido: antetítulo gris y título coral. */
export function Cabecera() {
  return (
    <>
      <Renglon x={0.495} y={0.42} w={2.4} h={0.13} />
      <Renglon x={0.495} y={0.72} w={6.2} h={0.34} c="titulo" />
    </>
  );
}

function Portada({ variante }: { variante: string }) {
  if (variante === "izquierda") {
    return (
      <>
        <Renglon x={1.08} y={2.25} w={2.6} h={0.16} c="titulo" />
        <Renglon x={1.08} y={2.66} w={8.2} h={0.42} c="tinta" />
        <Renglon x={1.08} y={3.2} w={5.6} h={0.42} c="tinta" />
        <Caja x={1.08} y={4.19} w={11.2} h={0.04} c="titulo" rx={0.02} />
        <Renglon x={1.08} y={4.5} w={4.4} h={0.18} c="tinta" />
        <Renglon x={1.08} y={4.9} w={2} h={0.15} />
      </>
    );
  }
  if (variante === "banda") {
    return (
      <>
        <Centrado y={2.25} w={2.6} h={0.16} c="titulo" />
        <Centrado y={2.66} w={8.2} h={0.42} c="tinta" />
        <Centrado y={3.2} w={5.6} h={0.42} c="tinta" />
        <Caja x={0} y={6.25} w={13.333} h={1.25} c="banda" rx={0} />
        <Centrado y={6.6} w={4.4} h={0.17} c="papel-claro" />
        <Centrado y={6.95} w={2} h={0.14} c="papel-claro" />
      </>
    );
  }
  return (
    <>
      <Centrado y={2.12} w={2.6} h={0.16} c="titulo" />
      <Centrado y={2.55} w={8.6} h={0.44} c="tinta" />
      <Centrado y={3.1} w={6} h={0.44} c="tinta" />
      <Centrado y={4.72} w={4.6} h={0.2} c="tinta" />
      <Centrado y={5.2} w={2.2} h={0.18} c="suave" />
    </>
  );
}

/** Ilustración de la columna izquierda del índice, según su composición. */
function IlustracionIndice({ composicion }: { composicion: string }) {
  if (composicion === "facetas") {
    return (
      <>
        <polygon points="0,0 4.2,0 0,3.6" className="pulso-composicion__ilustracion" />
        <polygon points="0,3.6 4.2,0 5.4,3.9" className="pulso-composicion__acento is-suave" />
        <polygon points="0,3.6 5.4,3.9 2.2,7.5 0,7.5" className="pulso-composicion__ilustracion" />
        <polygon points="5.4,3.9 6.2,7.5 2.2,7.5" className="pulso-composicion__acento" />
      </>
    );
  }
  if (composicion === "circulos") {
    return (
      <>
        <circle cx={2.2} cy={2.2} r={1.5} className="pulso-composicion__acento" />
        <circle cx={4.4} cy={4.2} r={1.1} className="pulso-composicion__ilustracion" />
        <circle cx={1.8} cy={5.6} r={1.2} className="pulso-composicion__acento is-suave" />
        <circle cx={4.9} cy={6.6} r={0.6} className="pulso-composicion__ilustracion" />
      </>
    );
  }
  if (composicion === "bloques") {
    return (
      <>
        <Caja x={0.5} y={0.6} w={2.4} h={2.6} c="acento" rx={0.12} />
        <Caja x={3.1} y={0.6} w={2.4} h={1.6} c="ilustracion" rx={0.12} />
        <Caja x={3.1} y={2.4} w={2.4} h={2.6} c="ilustracion" rx={0.12} />
        <Caja x={0.5} y={3.4} w={2.4} h={3.5} c="ilustracion" rx={0.12} />
        <Caja x={3.1} y={5.2} w={2.4} h={1.7} c="acento" rx={0.12} />
      </>
    );
  }
  // Arcos (la 31, por defecto): cuartos de círculo desde la esquina inferior izquierda.
  return (
    <>
      <path d="M0 7.5V1.3A6.2 6.2 0 0 1 6.2 7.5Z" className="pulso-composicion__ilustracion" />
      <path d="M0 7.5V3.3A4.2 4.2 0 0 1 4.2 7.5Z" className="pulso-composicion__acento is-suave" />
      <path d="M0 7.5V5.3A2.2 2.2 0 0 1 2.2 7.5Z" className="pulso-composicion__acento" />
    </>
  );
}

function Indice({ composicion }: { composicion: string }) {
  return (
    <>
      <IlustracionIndice composicion={composicion} />
      <Renglon x={6.65} y={0.98} w={1.9} h={0.42} c="titulo" />
      {[0, 1, 2, 3, 4].map((k) => {
        const y = 2.05 + k * 0.95;
        return (
          <g key={k}>
            <Caja x={6.65} y={y + 0.28} w={0.24} h={0.3} c="titulo" rx={0.04} />
            <circle cx={7.65} cy={y + 0.43} r={0.22} className="pulso-composicion__acento" />
            <Renglon x={8.15} y={y + 0.34} w={[3.6, 2.8, 3.2, 2.4, 3][k]} h={0.2} c="tinta" />
            {k < 4 && <Caja x={6.65} y={y + 0.93} w={6.2} h={0.012} c="suave" rx={0} />}
          </g>
        );
      })}
    </>
  );
}

function Separador({ nivel }: { nivel: string }) {
  if (nivel === "subcapitulo") {
    return (
      <>
        <Renglon x={0.495} y={2.75} w={4.2} h={0.13} />
        <Renglon x={0.495} y={3.15} w={0.75} h={0.42} c="titulo" />
        <Renglon x={1.4} y={3.15} w={6.4} h={0.42} c="tinta" />
        <Renglon x={1.4} y={3.8} w={4.2} h={0.17} />
      </>
    );
  }
  return (
    <>
      <path d="M13.333 0V7.5H8.6C9.6 5.6 10.4 3.4 13.333 0Z" className="pulso-composicion__ilustracion" />
      <path d="M13.333 2.8V7.5H10.6C11.2 6 12.1 4.4 13.333 2.8Z" className="pulso-composicion__acento is-suave" />
      <Renglon x={1} y={2.55} w={1.7} h={0.17} c="titulo" />
      <Caja x={1} y={2.9} w={0.7} h={0.05} c="titulo" rx={0.02} />
      <Renglon x={1} y={3.2} w={6.4} h={0.52} c="tinta" />
      <Renglon x={1} y={4} w={4.4} h={0.2} />
    </>
  );
}

function Contacto({ x, y, claro = false }: { x: number; y: number; claro?: boolean }) {
  return (
    <>
      <circle cx={x} cy={y} r={0.13} className={`pulso-composicion__${claro ? "papel-claro" : "acento"}`} />
      <Renglon x={x + 0.25} y={y - 0.06} w={1.7} h={0.12} c={claro ? "papel-claro" : "suave"} />
    </>
  );
}

function Cierre({ variante }: { variante: string }) {
  const logo = <Caja x={5.17} y={2.5} w={3} h={1.5} c="logo" rx={0.12} />;
  if (variante === "banda_azul" || variante === "banda_clara") {
    const claro = variante === "banda_azul";
    return (
      <>
        {logo}
        <Caja x={0} y={6.1} w={13.333} h={1.4} c={claro ? "banda" : "banda-clara"} rx={0} />
        {[1.6, 5.6, 9.6].map((x) => <Contacto key={x} x={x} y={6.8} claro={claro} />)}
      </>
    );
  }
  if (variante === "contacto") {
    return (
      <>
        {logo}
        <Centrado y={4.55} w={3.4} h={0.14} c="suave" />
        <Centrado y={4.85} w={4.2} h={0.14} c="suave" />
        <Centrado y={5.15} w={2.6} h={0.14} c="suave" />
      </>
    );
  }
  if (variante === "tres_columnas") {
    return (
      <>
        {logo}
        {[2.4, 5.9, 9.4].map((x) => (
          <g key={x}>
            <circle cx={x + 0.85} cy={4.7} r={0.2} className="pulso-composicion__acento" />
            <Renglon x={x} y={5.05} w={1.7} h={0.12} />
          </g>
        ))}
      </>
    );
  }
  return (
    <>
      {logo}
      {[1.08, 5.2, 11.17].map((x) => <Contacto key={x} x={x} y={6.76} />)}
    </>
  );
}

function Objetivo() {
  return (
    <>
      <Cabecera />
      <circle cx={2.2} cy={3.9} r={1.25} className="pulso-composicion__ilustracion" />
      <circle cx={2.2} cy={3.9} r={0.75} className="pulso-composicion__acento is-suave" />
      <circle cx={2.2} cy={3.9} r={0.3} className="pulso-composicion__acento" />
      {[2.6, 3.1, 3.6, 4.1, 4.6].map((y, i) => <Renglon key={y} x={4.4} y={y} w={[7.8, 8.2, 6.6, 7.4, 4.8][i]} h={0.15} c={i === 0 ? "tinta" : "suave"} />)}
    </>
  );
}

function FichaTecnica() {
  return (
    <>
      <Cabecera />
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const y = 1.75 + k * 0.72;
        return (
          <g key={k}>
            <Caja x={0.495} y={y} w={3.2} h={0.56} c="ilustracion" rx={0.05} />
            <Renglon x={0.7} y={y + 0.21} w={1.9} h={0.14} c="tinta" />
            <Renglon x={4} y={y + 0.21} w={[6.4, 4.8, 7.8, 5.2, 6.8, 3.6][k]} h={0.14} />
          </g>
        );
      })}
    </>
  );
}

/** Top Two Box: una barra de cinco puntos con los dos de arriba bajo la llave (recetario p19). */
function TopTwoBox() {
  const tramos: ReadonlyArray<readonly [number, number, Clase]> = [
    [1.2, 1.6, "ilustracion"], [2.84, 1.3, "ilustracion"], [4.18, 1.2, "suave"], [5.42, 2.6, "acento"], [8.06, 2.9, "acento"],
  ];
  return (
    <>
      <Cabecera />
      <Renglon x={1.2} y={1.8} w={9.4} h={0.15} />
      <Renglon x={1.2} y={2.15} w={6.8} h={0.15} />
      {tramos.map(([x, w, c]) => <Caja key={x} x={x} y={3.6} w={w} h={0.9} c={c} rx={0.04} />)}
      <path d="M5.42 3.35V3.05H10.96V3.35" className="pulso-composicion__llave" />
      <Renglon x={7.2} y={2.7} w={2} h={0.18} c="tinta" />
      {tramos.map(([x, w]) => <Renglon key={`r-${x}`} x={x + w / 2 - 0.45} y={4.8} w={0.9} h={0.12} />)}
    </>
  );
}

/** Redondeo: la misma distribución con los dos métodos y su suma al lado (recetario p20–21). */
function Redondeo() {
  const fila = (y: number) => (
    <>
      {([[1.2, 0.4], [1.64, 1.4], [3.08, 4.4], [7.52, 2.6], [10.16, 0.4]] as const).map(([x, w], i) => (
        <Caja key={x} x={x} y={y} w={w} h={0.7} c={i === 2 ? "acento" : "ilustracion"} rx={0.04} />
      ))}
      <Renglon x={11.1} y={y + 0.24} w={1.2} h={0.22} c="titulo" />
    </>
  );
  return (
    <>
      <Cabecera />
      <Renglon x={1.2} y={1.75} w={8} h={0.15} />
      <Renglon x={1.2} y={2.5} w={2.2} h={0.15} c="tinta" />
      {fila(2.8)}
      <Renglon x={1.2} y={4.25} w={2.2} h={0.15} c="tinta" />
      {fila(4.55)}
    </>
  );
}

/** ¿Hay dibujo de estructura para este tipo? */
export function tieneDibujoEstructura(tipo: string): boolean {
  return tipo in DIBUJOS;
}

const DIBUJOS: Readonly<Record<string, (variante: string | null) => JSX.Element>> = {
  p_slide_portada: (v) => <Portada variante={v ?? "centrada"} />,
  p_slide_indice: (v) => <Indice composicion={v ?? "arcos"} />,
  p_slide_seccion: (v) => <Separador nivel={v ?? "capitulo"} />,
  p_slide_cierre: (v) => <Cierre variante={v ?? "contraportada"} />,
  p_slide_objetivo_icono: () => <Objetivo />,
  p_slide_tabla_tecnica: () => <FichaTecnica />,
  p_slide_top_two_box: () => <TopTwoBox />,
  p_slide_redondeo: () => <Redondeo />,
};

export function DibujoEstructura({ tipo, variante }: { tipo: string; variante: string | null }): JSX.Element | null {
  const dibujo = DIBUJOS[tipo];
  return dibujo ? dibujo(variante) : null;
}
