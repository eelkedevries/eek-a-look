import { pearson } from '../maps/saliency-map';
import { models } from '../models/registry';
import { onResults } from '../results';

const label = (m: (typeof models)[number]) => m.shortName ?? m.name;

/** Pearson correlation for every pair of models, as a lower-triangle matrix, once both maps are ready. */
export function mountAgreement(section: HTMLElement): void {
  const heading = document.createElement('h2');
  heading.id = 'agreement-heading';
  heading.className = 'section-label';
  heading.textContent = 'How much the models agree';

  const wrap = document.createElement('div');
  wrap.className = 'agreement-wrap';
  const table = document.createElement('table');
  table.className = 'agreement-matrix';
  wrap.append(table);
  const caption = document.createElement('p');
  caption.className = 'agreement-caption';
  caption.textContent =
    'Correlation between two maps for this photo: 0 = unrelated · 1 = same pattern · below 0 = they point to different places. n/a: a model does not cover this photo.';
  section.replaceChildren(heading, wrap, caption);

  onResults((results) => {
    const head = document.createElement('tr');
    head.append(document.createElement('th'));
    for (const m of models.slice(0, -1)) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label(m);
      th.title = m.name;
      head.append(th);
    }
    const rows = models.slice(1).map((a, i) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = label(a);
      th.title = a.name;
      tr.append(th);
      models.slice(0, -1).forEach((b, j) => {
        const td = document.createElement('td');
        if (j <= i) {
          const sa = results.status.get(a.id);
          const sb = results.status.get(b.id);
          if (sa?.state === 'ready' && sb?.state === 'ready') {
            const r = pearson(sa.map, sb.map);
            td.textContent = r.toFixed(2);
            td.style.setProperty('--r', String(Math.max(0, r)));
            td.className = 'agreement-cell';
            td.setAttribute('aria-label', `${a.name} and ${b.name}: ${r.toFixed(2)}`);
          } else {
            const missing = [sa, sb].some((s) => s?.state === 'failed' || s?.state === 'unavailable');
            td.textContent = missing ? 'n/a' : '…';
            td.className = 'agreement-empty';
          }
        }
        tr.append(td);
      });
      return tr;
    });
    table.replaceChildren(head, ...rows);
  });
}
