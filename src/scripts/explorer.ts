import { getInfrastructureFlow, getInfrastructureNode } from '../data/infrastructure';

export function initializeExplorer(explorer: HTMLElement): void {
  if (explorer.classList.contains('enhanced')) return;

  const nodeButtons = [...explorer.querySelectorAll<HTMLButtonElement>('[data-node]')];
  const modeButtons = [...explorer.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  const panels = [...explorer.querySelectorAll<HTMLElement>('[data-node-panel]')];
  const flowPanels = [...explorer.querySelectorAll<HTMLElement>('[data-flow-panel]')];
  const route = explorer.querySelector<HTMLOListElement>('[data-route]');
  const announcement = explorer.querySelector<HTMLElement>('[data-announcement]');

  // If the static document is incomplete, keep its readable, unenhanced state.
  if (
    !route ||
    !announcement ||
    nodeButtons.length !== panels.length ||
    nodeButtons.length === 0 ||
    modeButtons.length !== flowPanels.length
  )
    return;
  if (
    nodeButtons.some((button) => !getInfrastructureNode(button.dataset.node ?? '')) ||
    modeButtons.some((button) => !getInfrastructureFlow(button.dataset.mode ?? ''))
  )
    return;

  const selectNode = (id: string, announce = true): void => {
    const node = getInfrastructureNode(id);
    if (!node) return;
    nodeButtons.forEach((button) => {
      const selected = button.dataset.node === id;
      button.setAttribute('aria-pressed', String(selected));
      const label = button.querySelector<HTMLElement>('.selection-label');
      if (label) label.hidden = !selected;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.nodePanel !== id;
    });
    if (announce) announcement.textContent = `${node.name} selected. ${node.role}.`;
  };

  const selectMode = (id: string, announce = true): void => {
    const flow = getInfrastructureFlow(id);
    if (!flow) return;
    modeButtons.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.mode === id)),
    );
    flowPanels.forEach((panel) => {
      panel.hidden = panel.dataset.flowPanel !== id;
    });
    route.replaceChildren(
      ...flow.steps.map((step) => {
        const item = document.createElement('li');
        item.textContent = step;
        return item;
      }),
    );
    route.classList.toggle('directional', flow.directional);
    route.setAttribute('aria-label', `${flow.label} steps`);
    explorer.dataset.activeMode = flow.id;
    if (announce) announcement.textContent = `${flow.label} selected. ${flow.title}.`;
  };

  nodeButtons.forEach((button) =>
    button.addEventListener('click', () => selectNode(button.dataset.node ?? '')),
  );
  modeButtons.forEach((button) =>
    button.addEventListener('click', () => selectMode(button.dataset.mode ?? '')),
  );
  selectNode('monster', false);
  selectMode('overview', false);
  explorer.querySelectorAll<HTMLDetailsElement>('[data-secondary-services]').forEach((group) => {
    group.open = false;
  });
  explorer.classList.add('enhanced');
  explorer.querySelectorAll<HTMLElement>('[data-explorer-controls]').forEach((control) => {
    control.hidden = false;
  });
}

document.querySelectorAll<HTMLElement>('[data-explorer]').forEach(initializeExplorer);
