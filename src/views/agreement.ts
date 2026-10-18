import { pearson } from '../maps/saliency-map';
import { models } from '../models/registry';
import { onResults } from '../results';

/** Pearson correlation for every pair of models, shown once all maps are ready. */
export function mountAgreement(section: HTMLElement): void {
  const heading = document.createElement('h2');
  heading.id = 'agreement-heading';
  heading.className = 'section-label';
  heading.textContent = 'How much the models agree';

  const list = document.createElement('ul');
  list.className = 'agreement';
  const caption = document.createElement('p');
  caption.className = 'agreement-caption';
  caption.textContent =
    'Correlation between two maps for this photo: 0 = unrelated · 1 = same pattern · below 0 = they point to different places.';
  section.replaceChildren(heading, list, caption);

  const pairs = models.flatMap((a, i) => models.slice(i + 1).map((b) => [a, b] as const));

  onResults((results) => {
    list.replaceChildren(
      ...pairs.map(([a, b]) => {
        const item = document.createElement('li');
        const names = document.createElement('span');
        names.className = 'agreement-pair';
        names.textContent = `${a.name} and ${b.name}`;
        const value = document.createElement('span');
        value.className = 'agreement-value';
        const meter = document.createElement('span');
        meter.className = 'agreement-meter';
        const fill = document.createElement('span');
        meter.append(fill);

        const sa = results.status.get(a.id);
        const sb = results.status.get(b.id);
        if (sa?.state === 'ready' && sb?.state === 'ready') {
          const r = pearson(sa.map, sb.map);
          value.textContent = r.toFixed(2);
          fill.style.width = `${Math.max(0, r) * 100}%`;
          meter.setAttribute('aria-hidden', 'true');
        } else {
          value.textContent = sa?.state === 'failed' || sb?.state === 'failed' ? 'n/a' : '…';
        }
        item.append(names, meter, value);
        return item;
      }),
    );
  });
}
