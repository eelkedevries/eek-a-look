import { onResults } from '../results';

/** Content hash of public/precomputed/vlm-panel/, set by vite.config.ts. */
declare const __PANEL_VERSION__: string;

type Verdict = 'present' | 'absent' | 'ambiguous';

export interface PanelFile {
  model: string;
  licence: string;
  quantisation: string;
  fleissKappa: Record<string, number | null>;
  stability: { sameConsensus: number; labels: number };
  photos: Record<string, Record<string, { consensus: Verdict; votes: { present: number; absent: number; missing: number }; evidence: string[] }>>;
}

export const PRINCIPLES: [string, string][] = [
  ['rhythm', 'Horizontal–vertical rhythm and variety'],
  ['groundFloor', 'Active ground floor'],
  ['materials', 'Tactile materials'],
];

const VERDICT_TEXT: Record<Verdict, string> = { present: 'Present', absent: 'Absent', ambiguous: 'No consensus' };

let panelFile: Promise<PanelFile | null> | null = null;

export function loadPanel(): Promise<PanelFile | null> {
  panelFile ??= fetch(`${import.meta.env.BASE_URL}precomputed/vlm-panel/panel.json?v=${__PANEL_VERSION__}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return panelFile;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** The simulated panel's verdicts for the current example photo; nothing for uploads. */
export function mountPanel(container: HTMLElement): void {
  let shownFor: string | undefined;
  onResults(async (results) => {
    const id = results.image.exampleId;
    if (id === shownFor && container.childElementCount) return;
    shownFor = id;
    if (!id) {
      container.replaceChildren();
      return;
    }
    const file = await loadPanel();
    if (shownFor !== id) return;
    const photo = file?.photos[id];
    if (!file || !photo) {
      container.replaceChildren();
      return;
    }
    const heading = el('h3', 'panel-heading', 'Simulated panel · AI judgement, not experts');
    const list = el('dl', 'panel-verdicts');
    for (const [key, name] of PRINCIPLES) {
      const verdict = photo[key];
      if (!verdict) continue;
      const total = verdict.votes.present + verdict.votes.absent + verdict.votes.missing;
      const votes =
        verdict.consensus === 'ambiguous'
          ? `${verdict.votes.present} present, ${verdict.votes.absent} absent`
          : `${verdict.votes[verdict.consensus]} of ${total} ${verdict.consensus}`;
      const term = el('dt', undefined, name);
      const detail = el('dd');
      detail.append(el('strong', 'panel-verdict', VERDICT_TEXT[verdict.consensus]), el('span', 'panel-votes', ` · ${votes}`));
      if (verdict.evidence[0]) detail.append(el('span', 'panel-evidence', `“${verdict.evidence[0]}”`));
      if (file.fleissKappa[key] === null) {
        detail.append(el('span', 'panel-note', 'The model gave this verdict for every example photo, so it does not tell the photos apart.'));
      }
      list.append(term, detail);
    }
    const caption = el(
      'p',
      'agreement-caption',
      'Eight runs of a vision-language model (Qwen3-VL), each asked as a different kind of designer, judged the photo on the three principles an HvA expert panel used (Spanjar & Suurenbroek 2020). A verdict needs six of eight to agree. No experts judged these photos, so it is not validated.',
    );
    container.replaceChildren(heading, list, caption);
  });
}
