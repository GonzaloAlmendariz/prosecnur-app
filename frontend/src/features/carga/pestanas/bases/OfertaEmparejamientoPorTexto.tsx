// Junto al aviso de una base que no calza con el formulario: ofrece emparejar
// sus columnas por el texto de la pregunta y abre la propuesta (ítem 4).
import { LoadingBlock } from "../../../../components/States";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Link2 } from "../../../../vendor/lucide-react";
import { EmparejamientoPorTextoDialog } from "./EmparejamientoPorTextoDialog";
import { rotuloOfertaEmparejamiento } from "./emparejamientoTextoModelo";
import { useEmparejamientoTexto } from "./useEmparejamientoTexto";

export function OfertaEmparejamientoPorTexto() {
  const { fase, propuesta, error, abierto, abrir, cerrar, aplicar } = useEmparejamientoTexto();
  if (fase === "inactivo") return null;
  if (fase === "leyendo") return <LoadingBlock variant="inline" label="Comparando los encabezados con el texto de las preguntas" />;
  if (fase === "error") {
    return <p className="pulso-emparejamiento-oferta-nota">No se pudo comparar con el texto de las preguntas: {error}</p>;
  }
  if (!propuesta) return null;
  const r = propuesta.resumen;
  if (r.n_propuestas + r.n_dudosas + r.n_ambiguas === 0) {
    return (
      <p className="pulso-emparejamiento-oferta-nota">
        Ningún encabezado de la base coincide con el texto de una pregunta del formulario.
      </p>
    );
  }
  return (
    <div className="pulso-emparejamiento-oferta">
      <PulsoButton variant="secondary" onClick={abrir}>
        <Link2 size={15} aria-hidden="true" />
        {rotuloOfertaEmparejamiento(r)}
      </PulsoButton>
      {abierto ? <EmparejamientoPorTextoDialog propuesta={propuesta} onAceptar={aplicar} onCerrar={cerrar} /> : null}
    </div>
  );
}
