// El "Libro de códigos" junto a la tabla (prototipo, vista de tabla): un renglón por código con su número,
// su nombre, un ejemplo, sus casos y su barra; arriba "Buscar o crear un código" y al pie cuántas
// respuestas quedan sin código. Se suelta sobre un renglón como sobre una tarjeta. Renombrar, ordenar,
// quitar respuestas y "Parecidas" siguen en la vista de tarjetas de la misma pregunta.

import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { formatoConteo } from "../../../lib/formatoNumero";
import { Search, Tags } from "../../../vendor/lucide-react";
import { zonaDeCodigo } from "../codificar/asignacionEnLote";
import { cifrasDeTarjeta, type TarjetaDeCodigo } from "../codificar/modeloDeCodificar";
import { TarjetaCodigoNuevo } from "../codificar/TarjetaCodigoNuevo";
import { plegar } from "./tablaCodificarModelo";

function RenglonDeCodigo({ tarjeta, casosConTexto, esDestino }: { tarjeta: TarjetaDeCodigo; casosConTexto: number; esDestino: boolean }) {
  const zona = useDroppable({ id: zonaDeCodigo(tarjeta.grupo.id) });
  const cifras = cifrasDeTarjeta(tarjeta);
  const ejemplo = tarjeta.respuestas.filter((r) => r.enBase).slice(0, 3).map((r) => r.texto).join(", ");
  const estilo = {
    "--cv2-chip-accent": tarjeta.codigo.acento,
    "--cc-proporcion": String(casosConTexto > 0 ? Math.min(cifras.casos / casosConTexto, 1) : 0),
  } as CSSProperties;
  return (
    <li
      ref={zona.setNodeRef}
      className="pulso-ct-libro-fila"
      style={estilo}
      data-destino={esDestino ? "" : undefined}
      data-sobre={esDestino && zona.isOver ? "" : undefined}
      data-qa-geometry-member=""
      aria-label={`Código ${tarjeta.codigo.rotulo}, ${formatoConteo(cifras.casos)} ${cifras.casos === 1 ? "caso" : "casos"}`}
    >
      <span className="pulso-ct-numero pulso-cc-codigo-ficha">{tarjeta.codigo.numero ?? tarjeta.grupo.codigo}</span>
      <span className="pulso-ct-libro-texto">
        <b title={tarjeta.codigo.rotulo}>{tarjeta.codigo.nombre}</b>
        {ejemplo ? <small title={ejemplo}>{ejemplo}</small> : null}
      </span>
      <strong className="pulso-ct-libro-casos">{formatoConteo(cifras.casos)}</strong>
      <span className="pulso-cc-codigo-proporcion pulso-ct-libro-barra" aria-hidden="true">
        <span />
      </span>
    </li>
  );
}

export function LibroDeCodigos({
  tarjetas,
  casosConTexto,
  sinCodigo,
  arrastrando,
  siguiente,
  pendientesDeNuevo,
  herramientas,
  onAbrirNuevo,
  onCrear,
  onCancelarNuevo,
}: {
  tarjetas: readonly TarjetaDeCodigo[];
  casosConTexto: number;
  /** Respuestas (casos) que todavía no tienen código: la misma definición que la cabecera. */
  sinCodigo: number;
  arrastrando: boolean;
  siguiente: string;
  pendientesDeNuevo: number | null;
  herramientas?: ReactNode;
  onAbrirNuevo: () => void;
  onCrear: (nombre: string) => void;
  onCancelarNuevo: () => void;
}) {
  const [consulta, setConsulta] = useState("");
  const q = plegar(consulta.trim());
  const visibles = q
    ? tarjetas.filter((t) => plegar(t.codigo.nombre).includes(q) || (t.codigo.numero ?? t.grupo.codigo).startsWith(consulta.trim()))
    : tarjetas;
  // Enter sin un código que coincida crea uno con ese nombre (prototipo: "Buscar o crear un código").
  function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    const nombre = consulta.replace(/\s+/g, " ").trim();
    if (!nombre || visibles.length > 0) return;
    onCrear(nombre);
    setConsulta("");
  }
  return (
    <PanelDeMesa
      zona="codigos"
      titulo="Libro de códigos"
      icono={<Tags size={15} />}
      conteo={tarjetas.length}
      acciones={herramientas}
      pie={(
        <span className="pulso-ct-libro-pie">
          <strong>{formatoConteo(sinCodigo)}</strong> {sinCodigo === 1 ? "respuesta sin código" : "respuestas sin código"}
        </span>
      )}
    >
      <div className="pulso-ct-libro" data-arrastrando={arrastrando ? "" : undefined}>
        <form className="pulso-cv2-search pulso-ct-libro-buscar" onSubmit={alEnviar} role="search">
          <Search size={14} className="pulso-cv2-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="pulso-cv2-search-input"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Buscar o crear un código"
            aria-label="Buscar un código o escribir el nombre de uno nuevo"
          />
        </form>
        {/* C1: un renglón por código; cada uno mide lo que su nombre y su ejemplo. */}
        <ul className="pulso-ct-libro-lista" data-qa-geometry-group="codificacion/libro-de-codigos" data-qa-geometry-contract="intrinsic">
          {visibles.map((t) => (
            <RenglonDeCodigo key={t.grupo.id} tarjeta={t} casosConTexto={casosConTexto} esDestino={arrastrando} />
          ))}
        </ul>
        {q && visibles.length === 0 ? (
          <p className="pulso-ct-libro-nota">Ningún código se llama así. Enter crea "{consulta.trim()}".</p>
        ) : null}
        <TarjetaCodigoNuevo
          numero={siguiente}
          unica={tarjetas.length === 0}
          esDestino={arrastrando}
          pendientes={pendientesDeNuevo}
          onAbrir={onAbrirNuevo}
          onCrear={onCrear}
          onCancelar={onCancelarNuevo}
        />
      </div>
    </PanelDeMesa>
  );
}
