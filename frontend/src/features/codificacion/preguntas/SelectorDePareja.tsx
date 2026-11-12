// Emparejar sin arrastrar: la pregunta abierta elige con cuál va. Al elegir pasa lo mismo que al
// soltarla encima (un texto con una cerrada queda emparejado de inmediato).

import { rotuloSinMarcador, sinMarcadores } from "../sugerenciasModulo";
import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { PreguntaAbierta } from "../../../api/codificacion";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { tipoEnPalabras } from "../../../components/procesamiento/BloquePregunta";
import { FichaPregunta } from "../../../components/procesamiento/FichaPregunta";
import { textoPlano } from "../../../lib/textoPlano";
import { Link2, Search, X } from "../../../vendor/lucide-react";
import { tipoDeFicha } from "./modeloUnidades";

export function candidatasQueCoinciden(candidatas: readonly PreguntaAbierta[], consulta: string): PreguntaAbierta[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return [...candidatas];
  return candidatas.filter(
    (c) =>
      c.parent.toLowerCase().includes(q) ||
      c.parent_label.toLowerCase().includes(q) ||
      textoPlano(c.section_label).toLowerCase().includes(q),
  );
}

function ficha(p: PreguntaAbierta) {
  const etiqueta = sinMarcadores(textoPlano(p.parent_label));
  return <FichaPregunta tipo={tipoDeFicha(p.tipo)} codigo={etiqueta ? p.parent : undefined} etiqueta={etiqueta || p.parent} />;
}

export function SelectorDePareja({ origen, candidatas, onElegir, onCancelar }: {
  origen: PreguntaAbierta;
  candidatas: PreguntaAbierta[];
  onElegir: (pregunta: PreguntaAbierta) => void;
  onCancelar: () => void;
}) {
  const [consulta, setConsulta] = useState("");
  const visibles = useMemo(() => candidatasQueCoinciden(candidatas, consulta), [candidatas, consulta]);

  return (
    <Dialog.Root open onOpenChange={(abierto) => { if (!abierto) onCancelar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-cv2-overlay pulso-preg-velo" />
        <Dialog.Content className="pulso-cv2-dialog pulso-codificacion-relation-target-dialog">
          <header className="pulso-codificacion-relation-target-head">
            <span className="pulso-codificacion-import-icon" aria-hidden="true"><Link2 size={18} /></span>
            <div>
              <Dialog.Title asChild>
                <h2>Emparejar pregunta</h2>
              </Dialog.Title>
              <Dialog.Description>Elige la pregunta con la que se empareja.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="pulso-icon" aria-label="Cerrar">
                <X size={14} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>

          <p className="pulso-preg-selector-origen">{ficha(origen)}</p>

          <div className="pulso-cv2-search pulso-codificacion-relation-search">
            <Search size={14} className="pulso-cv2-search-icon" aria-hidden="true" />
            <input
              type="search"
              value={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              className="pulso-cv2-search-input"
              placeholder="Buscar pregunta"
              aria-label="Buscar entre las preguntas para emparejar"
            />
          </div>

          <ul className="pulso-codificacion-relation-target-list pulso-preg-selector-lista" aria-label="Preguntas para emparejar">
            {visibles.length === 0 ? (
              <li>
                <EstadoVacio
                  icono={<Search size={16} />}
                  titulo={candidatas.length === 0 ? "Sin preguntas sueltas para emparejar" : "Ninguna pregunta coincide con la búsqueda"}
                />
              </li>
            ) : (
              visibles.map((candidata) => (
                <li key={candidata.parent}>
                  <button type="button" className="pulso-preg-selector-opcion" onClick={() => onElegir(candidata)}>
                    {ficha(candidata)}
                    <span className="pulso-preg-lado-pie">
                      <span>{tipoEnPalabras(tipoDeFicha(candidata.tipo))}</span>
                      <span>{rotuloSinMarcador(textoPlano(candidata.section_label)) || "Sin sección"}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
