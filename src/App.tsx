import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Board,
  type Cell,
  type Difficulty,
  PUZZLES,
  ALL_DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_ICONS,
  DIFFICULTY_COLORS,
} from "./puzzles";
import { SoundEngine } from "./soundEngine";
import Onboarding from "./Onboarding";
import imgRules from "./assets/onboard-rules.jpg";

/* ── helpers ── */
const makeBoard = (puzzleStr: string): Board =>
  Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 9 }, (_, col) => {
      const value = Number(puzzleStr[row * 9 + col]);
      return { value, fixed: value !== 0, notes: new Set<number>() } as Cell;
    }),
  );

const solVal = (sol: string, r: number, c: number) => Number(sol[r * 9 + c]);
const ck = (r: number, c: number) => `${r}-${c}`;

function findConflicts(board: Board) {
  const conflicts = new Set<string>();
  const check = (positions: [number, number][]) => {
    const groups = new Map<number, [number, number][]>();
    for (const [r, c] of positions) {
      const v = board[r][c].value;
      if (!v) continue;
      groups.set(v, [...(groups.get(v) ?? []), [r, c]]);
    }
    groups.forEach((cells) => {
      if (cells.length > 1) cells.forEach(([r, c]) => conflicts.add(ck(r, c)));
    });
  };
  for (let i = 0; i < 9; i++) {
    check(Array.from({ length: 9 }, (_, j) => [i, j]));
    check(Array.from({ length: 9 }, (_, j) => [j, i]));
  }
  for (let br = 0; br < 9; br += 3)
    for (let bc = 0; bc < 9; bc += 3)
      check(Array.from({ length: 9 }, (_, k) => [br + Math.floor(k / 3), bc + (k % 3)]));
  return conflicts;
}

/* ── undo stack ── */
type HistoryEntry = { row: number; col: number; prev: Cell; next: Cell };

/* ── main ── */
export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem("sudoku-lab-onboarded"); } catch { return true; }
  });

  const [difficulty, setDifficulty] = useState<Difficulty>("debutant");
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const pz = PUZZLES[difficulty][puzzleIndex];

  const [board, setBoard] = useState<Board>(() => makeBoard(pz.puzzle));
  const [selected, setSelected] = useState<[number, number]>([0, 0]);
  const [hintedCell, setHintedCell] = useState<string | null>(null);
  const [solvingCell, setSolvingCell] = useState<string | null>(null);
  const [isSolving, setIsSolving] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [level, setLevel] = useState(1);
  const [message, setMessage] = useState("Sélectionnez une case et tapez un chiffre.");
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(true);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [confettiCells, setConfettiCells] = useState(new Set<string>());
  const [notesMode, setNotesMode] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [errorsCount, setErrorsCount] = useState(0);

  const cancelSolveRef = useRef(false);
  const soundRef = useRef<SoundEngine | null>(null);
  const completedRef = useRef(false);

  if (!soundRef.current) {
    soundRef.current = new SoundEngine();
    soundRef.current.init();
  }
  const sound = soundRef.current;

  /* ── fullscreen ── */
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  /* ── derived ── */
  const conflictCells = useMemo(() => findConflicts(board), [board]);
  const filledCount = useMemo(() => board.flat().filter((c) => c.value !== 0).length, [board]);
  const isComplete = filledCount === 81 && conflictCells.size === 0;
  const progressPct = Math.round((filledCount / 81) * 100);

  /* ── timer ── */
  useEffect(() => {
    if (!running || showOnboarding) return;
    const t = window.setInterval(() => setTime((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [running, showOnboarding]);

  /* ── victory ── */
  useEffect(() => {
    if (isComplete && !completedRef.current) {
      completedRef.current = true;
      setRunning(false);
      sound.victory();
      const all = new Set<string>();
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) all.add(ck(r, c));
      setConfettiCells(all);
      setMessage("🎉 Bravo ! Grille résolue avec succès !");
      setTimeout(() => setConfettiCells(new Set()), 2200);
    }
    if (!isComplete) completedRef.current = false;
  }, [isComplete, sound]);

  /* ── level management ── */
  const goLevel = useCallback(
    (d: Difficulty, pi: number, lvl: number) => {
      cancelSolveRef.current = true;
      setDifficulty(d);
      setPuzzleIndex(pi);
      setBoard(makeBoard(PUZZLES[d][pi].puzzle));
      setLevel(lvl);
      setSelected([0, 0]);
      setHintedCell(null);
      setSolvingCell(null);
      setIsSolving(false);
      setHintsUsed(0);
      setErrorsCount(0);
      setTime(0);
      setHistory([]);
      completedRef.current = false;
      setRunning(true);
      setNotesMode(false);
      setMessage(`Niveau ${lvl} : ${DIFFICULTY_LABELS[d]}. Bonne chance !`);
    },
    [],
  );

  const nextLevel = () => {
    const idx = ALL_DIFFICULTIES.indexOf(difficulty);
    const hasMore = puzzleIndex + 1 < PUZZLES[difficulty].length;
    if (hasMore) goLevel(difficulty, puzzleIndex + 1, level + 1);
    else if (idx + 1 < ALL_DIFFICULTIES.length) {
      goLevel(ALL_DIFFICULTIES[idx + 1], 0, level + 1);
      sound.levelUp();
    } else setMessage("Tous les niveaux terminés. Félicitations !");
  };

  const newPuzzle = () => {
    const idx = (puzzleIndex + 1) % PUZZLES[difficulty].length;
    goLevel(difficulty, idx, level);
  };

  /* ── cell update ── */
  const updateCell = useCallback(
    (value: number) => {
      if (isSolving) return;
      sound.resume();
      sound.startAmbient();
      const [row, col] = selected;
      const cell = board[row][col];

      if (cell.fixed) {
        setMessage("Case fixe : impossible de la modifier.");
        sound.conflict();
        return;
      }

      // Notes mode
      if (notesMode && value > 0) {
        const newNotes = new Set(cell.notes);
        if (newNotes.has(value)) newNotes.delete(value);
        else newNotes.add(value);
        const prevCell = { ...cell, notes: new Set(cell.notes) };
        const nextCell = { ...cell, notes: newNotes };
        setBoard((b) =>
          b.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? nextCell : c))),
        );
        setHistory((h) => [...h, { row, col, prev: prevCell, next: nextCell }]);
        sound.select();
        return;
      }

      setHintedCell(null);
      const prevCell = { ...cell, notes: new Set(cell.notes) };
      const nextCell: Cell = { ...cell, value, animated: value !== cell.value, notes: new Set() };

      // Check if incorrect
      if (value > 0 && value !== solVal(pz.solution, row, col)) {
        setErrorsCount((e) => e + 1);
        sound.conflict();
        setMessage("❌ Ce chiffre crée un conflit !");
      } else if (value > 0) {
        sound.place(value);
        setMessage(`✓ ${value} placé.`);
      } else {
        sound.erase();
        setMessage("Case effacée.");
      }

      setBoard((b) =>
        b.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? nextCell : c))),
      );
      setHistory((h) => [...h, { row, col, prev: prevCell, next: nextCell }]);
    },
    [board, selected, isSolving, notesMode, pz.solution, sound],
  );

  /* ── undo ── */
  const undo = useCallback(() => {
    if (isSolving || history.length === 0) return;
    const last = history[history.length - 1];
    setBoard((b) =>
      b.map((r, ri) =>
        r.map((c, ci) => (ri === last.row && ci === last.col ? last.prev : c)),
      ),
    );
    setHistory((h) => h.slice(0, -1));
    setSelected([last.row, last.col]);
    sound.undo();
    setMessage("Action annulée.");
  }, [history, isSolving, sound]);

  /* ── hint ── */
  const useHint = useCallback(() => {
    if (isSolving) return;
    sound.startAmbient();
    sound.hint();

    const [sr, sc] = selected;
    const selCell = board[sr][sc];
    const isIncorrectSel = !selCell.fixed && selCell.value !== solVal(pz.solution, sr, sc);

    const target = isIncorrectSel
      ? { rowIndex: sr, colIndex: sc }
      : board
          .flatMap((row, ri) => row.map((cell, ci) => ({ cell, rowIndex: ri, colIndex: ci })))
          .find(({ cell, rowIndex, colIndex }) =>
            !cell.fixed && cell.value !== solVal(pz.solution, rowIndex, colIndex),
          );

    if (!target) {
      setMessage("Toutes les cases correspondent déjà à la solution.");
      return;
    }

    const { rowIndex: r, colIndex: c } = target;
    const key = ck(r, c);
    const prevCell = { ...board[r][c], notes: new Set(board[r][c].notes) };
    const nextCell: Cell = { value: solVal(pz.solution, r, c), fixed: false, animated: true, notes: new Set() };

    setBoard((b) => b.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? nextCell : cell))));
    setHistory((h) => [...h, { row: r, col: c, prev: prevCell, next: nextCell }]);
    setSelected([r, c]);
    setHintedCell(key);
    setHintsUsed((n) => n + 1);
    setMessage(`💡 Indice : ligne ${r + 1}, colonne ${c + 1}.`);
  }, [board, selected, isSolving, pz.solution, sound]);

  /* ── auto-solve ── */
  const autoSolve = async () => {
    if (isSolving) return;
    sound.resume();
    sound.startAmbient();
    cancelSolveRef.current = false;
    setIsSolving(true);
    setHintedCell(null);
    setMessage("⚡ Résolution animée en cours…");

    const cells: [number, number][] = [];
    board.forEach((row, ri) =>
      row.forEach((cell, ci) => {
        if (!cell.fixed && cell.value !== solVal(pz.solution, ri, ci)) cells.push([ri, ci]);
      }),
    );

    for (const [r, c] of cells) {
      if (cancelSolveRef.current) break;
      setSolvingCell(ck(r, c));
      setSelected([r, c]);
      sound.place(solVal(pz.solution, r, c));
      setBoard((b) =>
        b.map((row, ri) =>
          row.map((cell, ci) =>
            ri === r && ci === c
              ? { value: solVal(pz.solution, r, c), fixed: false, animated: true, notes: new Set() }
              : cell,
          ),
        ),
      );
      await new Promise((res) => setTimeout(res, 55));
    }

    setSolvingCell(null);
    setIsSolving(false);
    setMessage(cancelSolveRef.current ? "Résolution interrompue." : "✓ Grille résolue !");
    cancelSolveRef.current = false;
  };

  /* ── toggles ── */
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sound.setMuted(next);
    if (!next) { sound.resume(); sound.startAmbient(); }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else if (document.exitFullscreen) await document.exitFullscreen();
    } catch { /* ignore */ }
  };

  /* ── keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showOnboarding || showRules) return;
      if (e.key >= "1" && e.key <= "9") { e.preventDefault(); updateCell(Number(e.key)); }
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { e.preventDefault(); updateCell(0); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelected(([r, c]) => [Math.max(0, r - 1), c]); sound.navigate(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setSelected(([r, c]) => [Math.min(8, r + 1), c]); sound.navigate(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setSelected(([r, c]) => [r, Math.max(0, c - 1)]); sound.navigate(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); setSelected(([r, c]) => [r, Math.min(8, c + 1)]); sound.navigate(); }
      else if (e.key === "h" || e.key === "H") useHint();
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "n" || e.key === "N") setNotesMode((n) => !n);
      else if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [updateCell, useHint, undo, showOnboarding, showRules, sound]);

  const handleCellClick = (r: number, c: number) => {
    setSelected([r, c]);
    sound.resume();
    sound.startAmbient();
    sound.select();
  };

  const [selR, selC] = selected;
  const selVal = board[selR][selC].value;
  const colors = DIFFICULTY_COLORS[difficulty];

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const onboardComplete = () => {
    setShowOnboarding(false);
    try { localStorage.setItem("sudoku-lab-onboarded", "1"); } catch { /* noop */ }
    sound.resume();
    sound.startAmbient();
  };

  if (showOnboarding) return <Onboarding onComplete={onboardComplete} sound={sound} />;

  return (
    <main className={`relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-50 ${isFullscreen ? "fixed inset-0 overflow-y-auto" : ""}`}>
      <BgFx accent={colors.gradient} />

      {/* ── HEADER ── */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 pt-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br ${colors.gradient} text-lg font-black text-slate-950 shadow-lg ${colors.glow}`}>
            <span className="text-xl">⏣</span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Studio</p>
            <p className="text-sm font-bold tracking-wide text-slate-200">Sudoku Lab</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => setShowRules(true)} className="hdr-btn">📖 Règles</button>
          <button onClick={() => setShowOnboarding(true)} className="hdr-btn">❓ Aide</button>
          <button onClick={toggleMute} className="hdr-btn" aria-label={muted ? "Activer" : "Couper"}>
            {muted ? "🔇" : "🔊"}
          </button>
          <button onClick={toggleFullscreen} className="hdr-btn" aria-label="Plein écran">
            {isFullscreen ? "✕" : "⛶"}
          </button>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-start gap-8 px-4 py-6 md:min-h-[calc(100vh-100px)] md:grid-cols-[minmax(280px,0.85fr)_minmax(440px,1.15fr)] md:gap-10 md:px-8 md:py-8">

        {/* LEFT PANEL */}
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-300 backdrop-blur">
              <span className="text-lg">{DIFFICULTY_ICONS[difficulty]}</span>
              {DIFFICULTY_LABELS[difficulty]} · Niv. {level}
            </div>
            <h1 className="sudoku-rise bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-4xl font-black leading-[0.9] tracking-[-0.06em] text-transparent sm:text-6xl">
              Sudoku Lab
            </h1>
            <p className="max-w-sm text-sm leading-6 text-slate-400">
              Créé par <span className="font-semibold text-slate-200">Hylst - Geoffroy</span> avec l'aide d'une IA
            </p>
          </div>

          {/* Progress bar */}
          <div className="max-w-sm">
            <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span>Progression</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} transition-all duration-500 ease-out`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Difficulty pills */}
          <div className="flex flex-wrap gap-2 max-w-sm">
            {ALL_DIFFICULTIES.map((d) => {
              const c = DIFFICULTY_COLORS[d];
              const active = difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => goLevel(d, 0, level + 1)}
                  className={`diff-pill group ${active ? `bg-gradient-to-r ${c.gradient} text-slate-950 shadow-lg ${c.glow}` : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"}`}
                >
                  <span className="text-base">{DIFFICULTY_ICONS[d]}</span>
                  <span className="font-bold">{DIFFICULTY_LABELS[d]}</span>
                </button>
              );
            })}
          </div>

          {/* Stats */}
          <div className="grid max-w-sm grid-cols-4 gap-2 text-center">
            <StatBox label="Temps" value={fmt(time)} />
            <StatBox label="Remplies" value={`${filledCount}/81`} />
            <StatBox label="Erreurs" value={`${errorsCount}`} warn={errorsCount > 0} />
            <StatBox label="Indices" value={`${hintsUsed}`} />
          </div>

          {/* Message */}
          <p className={`min-h-6 max-w-sm text-sm font-semibold leading-6 ${colors.text}`} aria-live="polite">
            {message}
          </p>

          {/* Next level */}
          {isComplete && !isSolving && (
            <button onClick={nextLevel} className="next-level-btn group">
              <span className="relative z-10 flex items-center gap-3">
                <span className="text-xl">🏆</span>
                Niveau suivant
              </span>
              <span className="absolute inset-0 -translate-x-full animate-[sweep_2.4s_linear_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </button>
          )}
        </div>

        {/* RIGHT PANEL: BOARD + CONTROLS */}
        <div className="sudoku-rise grid gap-4 lg:grid-cols-[minmax(380px,540px)_220px] lg:items-start">

          {/* Board */}
          <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-2 shadow-[0_30px_80px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/5">
            <div className={`pointer-events-none absolute -inset-1.5 rounded-[2.3rem] bg-gradient-to-br ${colors.gradient} opacity-15 blur-2xl`} />
            <div className="relative grid aspect-square grid-cols-9 overflow-hidden rounded-[1.55rem] bg-slate-950 gap-[1px]">
              {board.map((row, ri) =>
                row.map((cell, ci) => {
                  const key = ck(ri, ci);
                  const isSel = selR === ri && selC === ci;
                  const sameUnit = selR === ri || selC === ci || (Math.floor(selR / 3) === Math.floor(ri / 3) && Math.floor(selC / 3) === Math.floor(ci / 3));
                  const sameNum = selVal !== 0 && selVal === cell.value;
                  const isConflict = conflictCells.has(key);
                  const isHint = hintedCell === key;
                  const isSolv = solvingCell === key;
                  const showConf = confettiCells.has(key);
                  const hasNotes = cell.notes && cell.notes.size > 0;

                  // Box borders
                  const boxT = ri % 3 === 0;
                  const boxL = ci % 3 === 0;
                  const boxB = ri === 8;
                  const boxR = ci === 8;

                  return (
                    <button
                      key={key}
                      onClick={() => handleCellClick(ri, ci)}
                      disabled={isSolving && !isSolv}
                      className={[
                        "cell-btn relative flex items-center justify-center transition-all duration-100",
                        boxT ? "border-t-[3px] border-t-white/15" : "border-t border-t-white/[0.04]",
                        boxL ? "border-l-[3px] border-l-white/15" : "border-l border-l-white/[0.04]",
                        boxB ? "border-b-[3px] border-b-white/15" : "",
                        boxR ? "border-r-[3px] border-r-white/15" : "",
                        cell.fixed ? "bg-slate-900/80 text-slate-200" : "bg-slate-950/80 text-cyan-300",
                        sameUnit && !isSel ? "bg-white/[0.04]" : "",
                        sameNum && !isSel ? "bg-cyan-950/60 text-cyan-200" : "",
                        isSel ? "z-20 board-selected bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 text-slate-950 ring-[3px] ring-amber-200/80 shadow-lg shadow-amber-400/20" : "",
                        isConflict ? "conflict-cell bg-rose-500/30 text-rose-200" : "",
                        isHint ? "hint-cell board-fill bg-emerald-400/30 text-emerald-200" : "",
                        isSolv ? "solve-cell bg-cyan-400/50 text-cyan-50" : "",
                        showConf ? "confetti-cell" : "",
                        cell.animated && !isHint && !isSolv ? "board-fill" : "",
                      ].filter(Boolean).join(" ")}
                      aria-label={`Ligne ${ri + 1}, col ${ci + 1}${cell.value ? `, ${cell.value}` : ""}`}
                    >
                      {cell.value ? (
                        <span className={`relative z-10 text-lg font-black sm:text-2xl ${cell.fixed ? "opacity-90" : ""}`}>{cell.value}</span>
                      ) : hasNotes ? (
                        <div className="grid grid-cols-3 gap-0 text-[8px] font-bold leading-none text-slate-400 sm:text-[9px]">
                          {[1,2,3,4,5,6,7,8,9].map((n) => (
                            <span key={n} className={`grid h-3 w-3 place-items-center sm:h-3.5 sm:w-3.5 ${cell.notes!.has(n) ? "text-cyan-400" : "opacity-0"}`}>
                              {n}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  );
                }),
              )}
            </div>
          </div>

          {/* Control panel */}
          <aside className="space-y-3 rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 shadow-2xl shadow-black/40 backdrop-blur-xl ring-1 ring-white/5 sm:p-4">
            {/* Notes toggle */}
            <button
              onClick={() => { setNotesMode((n) => !n); sound.select(); }}
              className={`w-full rounded-xl px-3 py-2 text-xs font-bold transition ${notesMode ? `bg-gradient-to-r ${colors.gradient} text-slate-950` : "bg-white/5 text-slate-300 ring-1 ring-white/10"}`}
            >
              {notesMode ? "✏️ Mode Notes (ON)" : "✏️ Notes (N)"}
            </button>

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-1.5">
              {[1,2,3,4,5,6,7,8,9].map((n) => {
                const cnt = board.flat().filter((c) => c.value === n).length;
                const done = cnt >= 9;
                const isSameNum = selVal === n;
                return (
                  <button
                    key={n}
                    onClick={() => updateCell(n)}
                    disabled={isSolving}
                    className={[
                      "numpad-btn group relative aspect-square overflow-hidden rounded-xl text-xl font-black transition duration-200",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                      isSameNum
                        ? `bg-gradient-to-br ${colors.gradient} text-slate-950 shadow-md ${colors.glow}`
                        : "bg-white/5 text-slate-100 ring-1 ring-white/10 hover:bg-white/10 hover:-translate-y-px",
                      done ? "complete-number" : "",
                    ].join(" ")}
                  >
                    <span className="relative z-10">{n}</span>
                    <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-slate-400/70">{cnt}</span>
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => updateCell(0)} disabled={isSolving} className="action-btn bg-white/5 ring-1 ring-white/10 hover:bg-white/10">
                🧹 Effacer
              </button>
              <button onClick={undo} disabled={isSolving || history.length === 0} className="action-btn bg-white/5 ring-1 ring-white/10 hover:bg-white/10">
                ↩ Annuler
              </button>
            </div>
            <button onClick={useHint} disabled={isSolving} className={`action-btn w-full bg-gradient-to-r from-emerald-400/80 to-lime-300/80 text-slate-950 font-black hover:scale-[1.02]`}>
              💡 Indice (H)
            </button>
            <button onClick={autoSolve} disabled={isSolving} className="action-btn w-full bg-gradient-to-r from-cyan-400/70 to-sky-400/70 text-slate-950 font-black hover:scale-[1.02]">
              ⚡ Résoudre
            </button>
            <button onClick={newPuzzle} className="action-btn w-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10">
              🔄 Nouvelle grille
            </button>

            <div className="rounded-xl bg-slate-950/60 p-2.5 text-[10px] leading-relaxed text-slate-400 ring-1 ring-white/5">
              <span className="font-bold text-slate-300">Raccourcis : </span>
              Flèches · 1-9 · 0/Suppr · H · N · Ctrl+Z · F
            </div>
          </aside>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 px-4 py-5 text-center text-[11px] text-slate-600 sm:px-8">
        © {new Date().getFullYear()} Sudoku Lab · Conçu par{" "}
        <span className="font-semibold text-slate-400">Hylst - Geoffroy</span> avec l'aide d'une IA
      </footer>

      {/* Rules modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} accent={colors.gradient} />}
    </main>
  );
}

/* ── Stat box ── */
function StatBox({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 backdrop-blur">
      <p className={`text-[9px] uppercase tracking-widest ${warn ? "text-rose-400" : "text-slate-500"}`}>{label}</p>
      <p className={`text-lg font-black tracking-tight ${warn ? "text-rose-300" : "text-slate-100"}`}>{value}</p>
    </div>
  );
}

/* ── Rules modal ── */
function RulesModal({ onClose, accent }: { onClose: () => void; accent: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-lg w-full rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl ring-1 ring-white/5 sm:p-8" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-5 top-5 text-slate-400 hover:text-white text-lg">✕</button>
        <div className="mb-4 overflow-hidden rounded-xl border border-white/10">
          <img src={imgRules} alt="Règles" className="h-40 w-full object-cover" />
        </div>
        <h2 className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-2xl font-black text-transparent">Règles du Sudoku</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-300 leading-relaxed">
          <Rule n={1} accent={accent}>Remplissez la grille 9×9 avec les chiffres de 1 à 9.</Rule>
          <Rule n={2} accent={accent}>Chaque <strong className="text-white">ligne</strong> doit contenir chaque chiffre exactement une fois.</Rule>
          <Rule n={3} accent={accent}>Chaque <strong className="text-white">colonne</strong> doit contenir chaque chiffre exactement une fois.</Rule>
          <Rule n={4} accent={accent}>Chaque <strong className="text-white">bloc 3×3</strong> doit contenir chaque chiffre exactement une fois.</Rule>
          <Rule n={5} accent={accent}>Les cases grises sont des indices fixes. Vous ne pouvez modifier que les cases vides.</Rule>
        </div>
        <button onClick={onClose} className={`mt-6 w-full rounded-xl bg-gradient-to-r ${accent} py-3 text-sm font-black text-slate-950 transition hover:scale-[1.02]`}>
          Compris !
        </button>
      </div>
    </div>
  );
}

function Rule({ n, accent, children }: { n: number; accent: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br ${accent} text-[10px] font-black text-slate-950`}>{n}</span>
      <p>{children}</p>
    </div>
  );
}

/* ── Background ── */
function BgFx({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_15%,rgba(255,255,255,0.035),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_75%,rgba(99,102,241,0.07),transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.8),rgba(2,6,23,0.96))]" />
      <div className={`sudoku-orb absolute -left-32 top-[10%] h-80 w-80 rounded-full bg-gradient-to-br ${accent} blur-3xl opacity-30 mix-blend-screen`} />
      <div className="sudoku-orb-delayed absolute -right-28 top-[25%] h-96 w-96 rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-600 blur-3xl opacity-25 mix-blend-screen" />
      <div className="sudoku-orb-slow absolute left-[15%] top-[65%] h-72 w-72 rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 blur-3xl opacity-20 mix-blend-screen" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid-p" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-p)" />
      </svg>
    </div>
  );
}
