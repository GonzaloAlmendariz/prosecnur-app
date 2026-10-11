// Panel lateral «Cómo se emparejaron las preguntas de <fuente>» (ADR 0094,
// ítem 15 del checklist `codificacion-sm-2026-10-11`).
//
// Direccionable: `?panel=emparejamiento&foco=<survey_id>`. Lo abre «Ver
// preguntas» en cada tarjeta de fuente de Carga › Revisión, y también un enlace
// guardado. El diálogo de Radix pone el foco dentro, cierra con Esc y atrapa el
// tabulador; al cerrar, el foco vuelve al botón que lo abrió.

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import { apiCargaFuentesEmparejamiento } from "../../api/cargaFuentes";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import {
  hrefSinFoco,
  searchConEmparejamiento,
  searchSinEmparejamiento,
  type EmparejamientoFiltro,
} from "./fuentesEmparejamientoModel";
import {
  EMPAREJAMIENTO_DESCRIPCION_ID,
  EMPAREJAMIENTO_TITULO_ID,
  FuentesEmparejamientoVista,
  type EmparejamientoCarga,
} from "./FuentesEmparejamientoVista";
import { PANEL_EMPAREJAMIENTO_FUENTE } from "./panelesCarga";
import "./fuentesEmparejamiento.css";

type Props = {
  /**
   * Base cuyas fuentes se describen. `undefined` mientras Revisión no sabe
   * todavía qué base mira: el panel espera en vez de pedir la base equivocada.
   */
  baseNombre: string | null | undefined;
};

function PanelConDireccion({ baseNombre }: Props) {
  const panel = usePanelDireccionable(PANEL_EMPAREJAMIENTO_FUENTE);
  const location = useLocation();
  const navigate = useNavigate();
  const procesamiento = useSeccion("procesamiento");
  const foco = procesamiento.foco?.trim() || null;

  const [carga, setCarga] = useState<EmparejamientoCarga>({ tipo: "cargando" });
  // El filtro elegido vale para la fuente en que se eligió; otra fuente vuelve
  // a su valor por defecto sin un efecto que lo reinicie.
  const [filtroElegido, setFiltroElegido] = useState<{ foco: string | null; filtro: EmparejamientoFiltro } | null>(null);
  const filtro = filtroElegido && filtroElegido.foco === foco ? filtroElegido.filtro : null;

  // El último foco abierto, para devolverle el foco a su botón al cerrar: para
  // entonces la dirección ya lo borró.
  const ultimoFoco = useRef<string | null>(null);
  if (panel.abierto) ultimoFoco.current = foco;

  const esperandoBase = baseNombre === undefined;
  useEffect(() => {
    if (!panel.abierto || esperandoBase) return;
    let vigente = true;
    setCarga({ tipo: "cargando" });
    apiCargaFuentesEmparejamiento(baseNombre)
      .then((datos) => {
        if (vigente) setCarga({ tipo: "listo", datos });
      })
      .catch((reason: unknown) => {
        if (vigente) setCarga({ tipo: "error", mensaje: reason instanceof Error ? reason.message : String(reason) });
      });
    return () => {
      vigente = false;
    };
  }, [panel.abierto, esperandoBase, baseNombre]);

  const escribir = useCallback(
    (search: string) => navigate({ pathname: location.pathname, search }, { replace: true }),
    [location.pathname, navigate],
  );
  const cerrar = useCallback(() => escribir(searchSinEmparejamiento(location.search)), [escribir, location.search]);
  const elegirFuente = useCallback(
    (surveyId: string) => escribir(searchConEmparejamiento(location.search, surveyId)),
    [escribir, location.search],
  );

  const contenido = useRef<HTMLDivElement | null>(null);

  return (
    <Dialog.Root open={panel.abierto} onOpenChange={(abierto) => { if (!abierto) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-emparejamiento-velo" />
        <Dialog.Content
          ref={contenido}
          className="pulso-emparejamiento"
          {...panel.props}
          data-audit-ready={carga.tipo === "cargando" ? "false" : "true"}
          aria-labelledby={EMPAREJAMIENTO_TITULO_ID}
          aria-describedby={EMPAREJAMIENTO_DESCRIPCION_ID}
          onOpenAutoFocus={(event) => {
            // El foco va al título: se lee qué es el panel antes de llegar a
            // sus controles.
            event.preventDefault();
            contenido.current?.querySelector<HTMLElement>("[data-emparejamiento-titulo]")?.focus();
          }}
          onCloseAutoFocus={(event) => {
            const id = ultimoFoco.current;
            if (!id) return;
            const disparador = Array.from(
              document.querySelectorAll<HTMLElement>("[data-emparejamiento-abrir]"),
            ).find((el) => el.dataset.emparejamientoAbrir === id);
            if (!disparador) return;
            event.preventDefault();
            disparador.focus();
          }}
        >
          <FuentesEmparejamientoVista
            carga={esperandoBase ? { tipo: "cargando" } : carga}
            foco={foco}
            filtro={filtro}
            onFiltro={(valor) => setFiltroElegido({ foco, filtro: valor })}
            onElegirFuente={elegirFuente}
            onCerrar={cerrar}
            hrefEquivalencias={hrefSinFoco(procesamiento.hrefDe("pestana", "equivalencias"))}
            renderTitulo={(titulo) => <Dialog.Title asChild>{titulo}</Dialog.Title>}
            renderDescripcion={(linea) => <Dialog.Description asChild>{linea}</Dialog.Description>}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Se monta en Carga › Revisión. Fuera de un router (renders estáticos del
 * resumen) no hay dirección que lo abra y no pinta nada.
 */
export function FuentesEmparejamientoPanel(props: Props) {
  return useInRouterContext() ? <PanelConDireccion {...props} /> : null;
}
