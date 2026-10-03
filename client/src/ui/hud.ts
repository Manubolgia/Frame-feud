/**
 * In-match HUD: health bars with a trailing damage chip, round pips, super
 * meter, burst gauge, combo counters and status tags over the fighters.
 */

import type { CharacterDef, FighterSnap, MatchConfig } from '../sim/types';
import { BURST_MAX, METER_BAR } from '../sim/state';
import { hex } from '../render/color';
import { el } from './dom';
import { icon } from './icons';

interface Side {
  root: HTMLElement;
  hp: HTMLElement;
  chip: HTMLElement;
  hpNum: HTMLElement;
  meter: HTMLElement[];
  meterNum: HTMLElement;
  burst: HTMLElement;
  burstWrap: HTMLElement;
  pips: HTMLElement;
  charEl: HTMLElement;
  combo: HTMLElement;
  comboHits: HTMLElement;
  comboDmg: HTMLElement;
  chipVal: number;
  chipHold: number;
  lastHp: number;
  maxHp: number;
  comboT: number;
  lastCombo: number;
}

export class Hud {
  root: HTMLElement;
  private sides: Side[] = [];
  private roundEl = el('div', { cls: 'hud-round' });
  private endless = false;
  /** Family Feud lineups (null outside a feud). */
  private teams: [CharacterDef[], CharacterDef[]] | null = null;
  private stepEl = el('div', { cls: 'hud-step' });
  pauseBtn: HTMLButtonElement;
  onPause: () => void = () => {};
  private tags: HTMLElement[] = [el('div', { cls: 'ftag hidden' }), el('div', { cls: 'ftag hidden' })];
  tagLayer = el('div', { cls: 'tag-layer' });

  constructor() {
    this.pauseBtn = el('button', {
      cls: 'icon-btn hud-pause',
      attrs: { type: 'button', 'aria-label': 'Pause (Esc)', title: 'Pause (Esc)' },
      html: icon('pause', 20),
      on: { click: () => this.onPause() },
    });
    this.root = el('div', { cls: 'hud hidden' });
    this.tagLayer.append(...this.tags);
  }

  mount(cfg: MatchConfig, defs: [CharacterDef, CharacterDef], colors: [number, number], labels: [string, string], teams: [CharacterDef[], CharacterDef[]] | null = null) {
    // training runs "first to 99": no pips, no round counter
    this.endless = cfg.roundsToWin > 9 && !teams;
    this.teams = teams;
    this.sides = [0, 1].map((i) => this.side(i, cfg.names[i], defs[i], colors[i], labels[i], cfg.roundsToWin));
    this.root.replaceChildren(
      this.sides[0].root,
      el('div', { cls: 'hud-mid', kids: [this.roundEl, this.stepEl, this.pauseBtn] }),
      this.sides[1].root,
      this.sides[0].combo,
      this.sides[1].combo,
    );
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
    this.tags.forEach((t) => t.classList.add('hidden'));
  }

  private side(i: number, name: string, def: CharacterDef, color: number, label: string, rounds: number): Side {
    const hp = el('div', { cls: 'hp-fill' });
    const chip = el('div', { cls: 'hp-chip' });
    const hpNum = el('span', { cls: 'hp-num' });
    const meter = [0, 1, 2].map(() => el('div', { cls: 'meter-seg', kids: [el('div', { cls: 'meter-fill' })] }));
    const meterNum = el('span', { cls: 'meter-num' });
    const burst = el('div', { cls: 'burst-fill' });
    const burstWrap = el('div', { cls: 'burst', attrs: { title: 'Burst gauge' }, kids: [burst] });
    const pips = el('div', { cls: 'pips' });
    const team = this.teams?.[i];
    if (team) {
      pips.classList.add('fam');
      for (const d of team) pips.append(el('span', { cls: 'fam-chip', style: { '--fc': hex(color) }, text: d.name.slice(0, 3), attrs: { title: d.name } }));
    } else if (!this.endless) for (let k = 0; k < rounds; k++) pips.append(el('span', { cls: 'pip' }));
    const charEl = el('span', { cls: 'hud-char', text: def.name });
    const comboHits = el('div', { cls: 'combo-hits' });
    const comboDmg = el('div', { cls: 'combo-dmg' });
    const combo = el('div', { cls: `combo combo-${i}`, kids: [comboHits, comboDmg] });
    combo.style.setProperty('--pc', hex(color));
    const root = el('div', {
      cls: `hud-side side-${i}`,
      style: { '--pc': hex(color) },
      kids: [
        el('div', {
          cls: 'hud-name-row',
          kids: [
            el('span', { cls: 'hud-tagline', text: label }),
            el('span', { cls: 'hud-name', text: name }),
            charEl,
            pips,
          ],
        }),
        el('div', { cls: 'hp-bar', kids: [chip, hp, hpNum] }),
        el('div', {
          cls: 'hud-gauges',
          kids: [el('div', { cls: 'meter', attrs: { title: 'Super meter' }, kids: [...meter] }), meterNum, burstWrap],
        }),
      ],
    });
    return { root, hp, chip, hpNum, meter, meterNum, burst, burstWrap, pips, charEl, combo, comboHits, comboDmg, chipVal: 1, chipHold: 0, lastHp: def.hp, maxHp: def.hp, comboT: 0, lastCombo: 0 };
  }

  setRound(round: number, wins: [number, number], step: number, members: [number, number] = [0, 0]) {
    this.roundEl.textContent = this.endless ? 'Training' : this.teams ? `Bout ${round}` : `Round ${round}`;
    this.stepEl.textContent = `Turn ${step + 1}`;
    this.sides.forEach((s, i) => {
      if (this.teams) {
        // my knocked-out members = the other side's wins
        const out = wins[1 - i];
        [...s.pips.children].forEach((p, k) => {
          p.classList.toggle('out', k < out);
          p.classList.toggle('cur', k === members[i] && k >= out);
        });
      } else [...s.pips.children].forEach((p, k) => p.classList.toggle('won', k < wins[i]));
    });
  }

  /** A new family member steps in for side i. */
  setFighter(i: number, def: CharacterDef, color: number, max = def.hp) {
    const s = this.sides[i];
    if (!s) return;
    s.charEl.textContent = def.name;
    s.root.style.setProperty('--pc', hex(color));
    s.combo.style.setProperty('--pc', hex(color));
    s.maxHp = max;
    s.lastHp = Math.min(s.lastHp, max);
    s.chipVal = 1;
  }

  /** Per-frame update from the fighter snapshots. `combo` is the hits the
   *  OTHER side has taken (shown on the attacker's side). */
  update(snaps: [FighterSnap, FighterSnap], dt: number) {
    this.sides.forEach((s, i) => {
      const f = snaps[i];
      const frac = Math.max(0, f.hp / s.maxHp);
      s.hp.style.transform = `scaleX(${frac})`;
      s.hp.classList.toggle('low', frac < 0.3);
      s.hpNum.textContent = String(f.hp);
      if (f.hp < s.lastHp) s.chipHold = 0.55;
      s.lastHp = f.hp;
      if (s.chipHold > 0) s.chipHold -= dt;
      else s.chipVal = Math.max(frac, s.chipVal - dt * 0.7);
      if (s.chipVal < frac) s.chipVal = frac;
      s.chip.style.transform = `scaleX(${s.chipVal})`;
      const m = f.meter;
      s.meter.forEach((seg, k) => {
        const v = Math.max(0, Math.min(1, (m - k * METER_BAR) / METER_BAR));
        (seg.firstChild as HTMLElement).style.transform = `scaleX(${v})`;
        seg.classList.toggle('full', v >= 1);
      });
      s.meterNum.textContent = String(Math.floor(m / METER_BAR));
      const b = f.burst / BURST_MAX;
      s.burst.style.transform = `scaleX(${b})`;
      s.burstWrap.classList.toggle('ready', b >= 1);
      // combo counter lives on the attacker's side
      const victim = snaps[1 - i];
      if (victim.combo >= 2) {
        s.comboT = 1.6;
        if (victim.combo !== s.lastCombo) {
          s.combo.classList.remove('bump');
          void s.combo.offsetWidth;
          s.combo.classList.add('bump');
        }
        s.lastCombo = victim.combo;
        s.comboHits.innerHTML = `<b>${victim.combo}</b> hits`;
        s.comboDmg.textContent = `${victim.comboDmg} damage`;
      } else if (s.comboT > 0) {
        s.comboT -= dt;
        if (s.comboT <= 0) s.lastCombo = 0;
      }
      s.combo.classList.toggle('show', s.comboT > 0);
    });
  }

  resetBars(maxHp: [number, number]) {
    this.sides.forEach((s, i) => {
      s.maxHp = maxHp[i];
      s.lastHp = maxHp[i];
      s.chipVal = 1;
      s.comboT = 0;
      s.lastCombo = 0;
    });
  }

  /** Status tags over fighters at a decision point. */
  setTags(tags: ({ x: number; y: number; text: string; tone: string } | null)[]) {
    tags.forEach((t, i) => {
      const e = this.tags[i];
      if (!t) {
        e.classList.add('hidden');
        return;
      }
      e.classList.remove('hidden');
      e.dataset.tone = t.tone;
      e.textContent = t.text;
      e.style.transform = `translate(${Math.round(t.x)}px, ${Math.round(t.y)}px) translate(-50%, -100%)`;
    });
  }
}
