import * as Dialog from "@radix-ui/react-dialog";
import { Check, Plus, X } from "../vendor/lucide-react";
import {
  moduleChromeVars,
  type ActiveProsecnurModuleMeta,
} from "../lib/modules";
import { PulsoButton } from "../components/PulsoButton";

export type ModuleManagerGridProps = {
  modules: readonly ActiveProsecnurModuleMeta[];
  addedSlugs: readonly string[];
  onAddModule: (slug: string) => void;
};

export function ModuleManagerGrid({
  modules,
  addedSlugs,
  onAddModule,
}: ModuleManagerGridProps) {
  return (
    <ul
      className="pulso-module-manager-grid"
      aria-label="Catálogo de módulos"
    >
      {modules.map((module) => {
        const Icon = module.icon;
        const isAdded = addedSlugs.includes(module.slug);
        return (
          <li
            key={module.slug}
            className="pulso-module-manager-card"
            style={moduleChromeVars(module)}
          >
            <span
              className="pulso-module-manager-card-icon"
              aria-hidden="true"
            >
              <Icon size={20} strokeWidth={1.8} />
            </span>
            <span className="pulso-module-manager-card-copy">
              <strong>{module.shortLabel}</strong>
              <small>{module.tagline}</small>
            </span>
            {isAdded ? (
              <span className="pulso-module-manager-added">
                <Check size={13} aria-hidden="true" />
                Agregado
              </span>
            ) : (
              <PulsoButton
                variant="secondary"
                size="sm"
                onClick={() => onAddModule(module.slug)}
              >
                <Plus size={14} aria-hidden="true" />
                Agregar
              </PulsoButton>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ModuleManagerDialog({
  open,
  onOpenChange,
  modules,
  addedSlugs,
  onAddModule,
  returnFocusTo,
}: ModuleManagerGridProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo?: HTMLElement | null;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-module-manager-overlay" />
        <Dialog.Content
          className="pulso-module-manager-dialog"
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.isConnected) return;
            event.preventDefault();
            returnFocusTo.focus();
          }}
        >
          <header className="pulso-module-manager-head">
            <div>
              <Dialog.Title>Módulos del proyecto</Dialog.Title>
              <Dialog.Description>
                Agrega herramientas sin abandonar la vista actual.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <PulsoButton variant="icon" aria-label="Cerrar gestor de módulos">
                <X size={16} aria-hidden="true" />
              </PulsoButton>
            </Dialog.Close>
          </header>
          <ModuleManagerGrid
            modules={modules}
            addedSlugs={addedSlugs}
            onAddModule={onAddModule}
          />
          <footer className="pulso-module-manager-footer">
            <span>
              {addedSlugs.length} de {modules.length} módulos agregados
            </span>
            <Dialog.Close asChild>
              <PulsoButton variant="primary">Listo</PulsoButton>
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
