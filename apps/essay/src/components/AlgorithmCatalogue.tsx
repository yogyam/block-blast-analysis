/**
 * §5 figure: the named dealing strategies carved from libtask.so, grouped by what they do. Every
 * name and Chinese title is read directly from the binary (docs/findings/whitebox.md §4,
 * libtask-decompiled.md §3-4). Click a group to see its members. The point is that these names
 * exist at all — a shipping puzzle game carries an algorithm called "deal death state".
 */
import { useState } from 'react';

interface Group {
  readonly key: string;
  readonly title: string;
  readonly cn: string;
  readonly what: string;
  readonly tone: 'death' | 'hard' | 'rescue' | 'feel' | 'random';
  readonly names: readonly string[];
}

const GROUPS: readonly Group[] = [
  {
    key: 'death', title: 'Death / lethal', cn: '致死题 · 死亡难题', tone: 'death',
    what: 'Search for a hand that cannot be placed in any order, while two of its pieces fit individually. Algorithm 24001 (致死题, "lethal puzzle") is requested on every late-game deal.',
    names: ['func_death_blcok', 'selectBlockDealDeathState', 'selectBlockSimpleDeath', 'selectBlockSimpleDeathNoBit', 'selectBlockVeryDifficultProblem', 'selectConvenientDifficultProblem', 'trap_high_near_danger'],
  },
  {
    key: 'hard', title: 'Hard', cn: '极其困难难题 · 消两次难题', tone: 'hard',
    what: 'Deal placeable-but-punishing hands: big Ls, 5-bars, the 3×3. Includes "extremely difficult", "clear-twice" and "few-continuous-edges" problems (16016 / 16010 / 16014).',
    names: ['selectBlockHard', 'selectBlockHardBinary', 'selectBlockHardExtend', 'selectBlockHardHard', 'selectBlockHardSuper', 'selectBlockHardTwice', 'selectBlockOneHard', 'selectBlockEdgeHard', 'selectBlockCrossHard', 'selectBlockInstinctHard', 'selectBlockHoleMaxDiff', 'selectBlockDiffMatrixAlgorithm'],
  },
  {
    key: 'rescue', title: 'Easing / rescue', cn: '帮扶清盘 · 随机无死亡', tone: 'rescue',
    what: 'The other direction: guarantee a live move, clear the board for the player, swap hard pieces for small ones. "Assisted board-clear" (31xxxx), "random, no death" (23001), "revive replace".',
    names: ['selectRandomNoDie', 'safety_random_block_by_efficient', 'selectBlockReviveReplace', 'selectBlockClearBoard', 'selectBlockNewClearBoard', 'selectBlockFillPrefect', 'selectBlockFillMoreArea', 'tkxc_clear_board', 'tkxc_quick', 'selectBlockNantijiangjicelue'],
  },
  {
    key: 'feel', title: 'Shaping the feel', cn: '熵增3 · 终止刷分 · 消除爽', tone: 'feel',
    what: 'Tune the texture of play without killing or rescuing: raise "entropy" (12001 熵增3), stop score-farming (终止刷分), hand out satisfying clears (消除爽), limit high combos.',
    names: ['selectBlockEntropy3IOS', 'selectBlockEntropy4', 'selectBlockEntropyIncrease1', 'selectBlockIncreaseVarianceRandom', 'selectBlockLessEdge', 'selectBlockClearCool', 'selectBlockStopRefreshScore', 'selectBlockFirstRoundSpiceOffer', 'selectBlockLimitHighCombo', 'selectBlockHistoryBoard'],
  },
  {
    key: 'random', title: 'Plain random', cn: '随机', tone: 'random',
    what: 'The honest baseline the others deviate from: uniform or weighted draws from the pool.',
    names: ['selectBlockRandom', 'selectBlockRandomByWeight', 'algo_random_put', 'algo_solid_color'],
  },
];

const TONE: Record<Group['tone'], string> = {
  death: 'var(--danger)', hard: 'var(--series-2)', rescue: 'var(--series-3)', feel: 'var(--series-7, #6250d6)', random: 'var(--muted)',
};

export function AlgorithmCatalogue() {
  const [open, setOpen] = useState<string | null>('death');
  return (
    <div className="catalogue">
      <p className="cat-lead">More than a hundred named dealing strategies ship inside <code>libtask.so</code>. Grouped by what they do:</p>
      {GROUPS.map((g) => (
        <div key={g.key} className={`cat-group ${open === g.key ? 'open' : ''}`}>
          <button className="cat-head" onClick={() => setOpen(open === g.key ? null : g.key)} aria-expanded={open === g.key}>
            <span className="cat-dot" style={{ background: TONE[g.tone] }} />
            <span className="cat-title">{g.title}</span>
            <span className="cat-cn">{g.cn}</span>
            <span className="cat-count">{g.names.length}+</span>
          </button>
          {open === g.key && (
            <div className="cat-body">
              <p className="cat-what">{g.what}</p>
              <div className="cat-names">
                {g.names.map((n) => <code key={n} className={n.includes('death') || n.includes('Death') || n === 'trap_high_near_danger' ? 'name-death' : ''}>{n}</code>)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
