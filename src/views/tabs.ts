export interface Tab {
  id: string;
  label: string;
  panel: HTMLElement;
}

/** An ARIA tablist: arrow keys, Home and End move between tabs; only the selected tab is in the tab order. */
export function mountTabs(list: HTMLElement, tabs: Tab[], onChange?: (id: string) => void): void {
  const buttons = tabs.map((tab) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `tab-${tab.id}`;
    button.className = 'view-tab';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', tab.panel.id);
    button.textContent = tab.label;
    return button;
  });

  function select(index: number, focus = false) {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      buttons[i].setAttribute('aria-selected', String(selected));
      buttons[i].tabIndex = selected ? 0 : -1;
      tab.panel.hidden = !selected;
    });
    if (focus) buttons[index].focus();
    onChange?.(tabs[index].id);
  }

  buttons.forEach((button, i) => {
    button.addEventListener('click', () => select(i));
    button.addEventListener('keydown', (event) => {
      const last = buttons.length - 1;
      const target =
        event.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
        : event.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
        : event.key === 'Home' ? 0
        : event.key === 'End' ? last
        : -1;
      if (target < 0) return;
      event.preventDefault();
      select(target, true);
    });
  });

  list.replaceChildren(...buttons);
  select(0);
}
