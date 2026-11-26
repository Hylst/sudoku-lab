import { useState } from "react";
import { SoundEngine } from "./soundEngine";
import imgWelcome from "./assets/onboard-welcome.jpg";
import imgRules from "./assets/onboard-rules.jpg";
import imgControls from "./assets/onboard-controls.jpg";
import imgHints from "./assets/onboard-hints.jpg";
import imgVictory from "./assets/onboard-victory.jpg";

interface OnboardingProps {
  onComplete: () => void;
  sound: SoundEngine;
}

interface SlideData {
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  bullets: string[];
  accent: string;
}

const SLIDES: SlideData[] = [
  {
    image: imgWelcome,
    badge: "✨ Bienvenue",
    title: "Labo Sudoku",
    subtitle: "Votre nouveau sanctuaire de logique",
    bullets: [
      "Plongez dans une expérience Sudoku immersive avec musique d'ambiance et effets sonores",
      "5 niveaux de difficulté progressifs, du débutant à l'expert",
      "Interface moderne avec animations fluides et retour visuel en temps réel",
    ],
    accent: "from-cyan-400 to-blue-500",
  },
  {
    image: imgRules,
    badge: "📐 Les règles",
    title: "Comment jouer ?",
    subtitle: "Trois règles d'or, simples à retenir",
    bullets: [
      "Chaque ligne doit contenir les chiffres de 1 à 9, sans répétition",
      "Chaque colonne doit contenir les chiffres de 1 à 9, sans répétition",
      "Chaque bloc 3×3 (indiqué par des bordures épaisses) doit contenir les chiffres de 1 à 9",
      "Les cases grises sont les indices de départ : elles ne peuvent pas être modifiées",
    ],
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    image: imgControls,
    badge: "🎮 Contrôles",
    title: "Jouez à votre façon",
    subtitle: "Clavier, souris, ou les deux !",
    bullets: [
      "Cliquez sur une case ou utilisez les flèches ←↑↓→ pour naviguer",
      "Tapez 1-9 au clavier pour placer un chiffre, 0 ou Suppr pour effacer",
      "Annuler une action : Ctrl+Z · Indice : H · Plein écran : F",
      "Mode Notes (N) : marquez vos hypothèses avec des petits chiffres",
      "Le pavé numérique à l'écran fonctionne aussi !",
    ],
    accent: "from-amber-400 to-orange-500",
  },
  {
    image: imgHints,
    badge: "💡 Fonctionnalités",
    title: "Des outils malins",
    subtitle: "Des aides qui ne gâchent pas le plaisir",
    bullets: [
      "Les conflits (doublons) sont surlignés en rouge en temps réel",
      "L'indice (💡) remplit la case sélectionnée avec la bonne valeur",
      "La résolution animée (⚡) montre la solution complète pas-à-pas",
      "Le mode Notes (✏️) permet d'annoter chaque case sans placer de chiffre",
      "Barre de progression et statistiques en direct",
    ],
    accent: "from-emerald-400 to-lime-400",
  },
  {
    image: imgVictory,
    badge: "🏆 Progression",
    title: "Relevez le défi !",
    subtitle: "Grimpez de niveau en niveau",
    bullets: [
      "Complétez une grille pour débloquer le niveau suivant",
      "5 difficultés : Débutant 🌱 → Facile 🌊 → Moyen 🧠 → Difficile 🔥 → Expert ⚡",
      "Chronomètre, compteur d'indices et d'erreurs pour suivre vos progrès",
      "Musique d'ambiance zen générée en temps réel",
      "Conçu par Hylst - Geoffroy avec l'aide d'une IA",
    ],
    accent: "from-rose-500 to-pink-500",
  },
];

export default function Onboarding({ onComplete, sound }: OnboardingProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const goNext = () => {
    sound.resume();
    sound.init();
    sound.onboardClick();
    if (isLast) {
      onComplete();
    } else {
      setDirection("right");
      setCurrent((c) => c + 1);
    }
  };

  const goPrev = () => {
    if (current === 0) return;
    sound.onboardClick();
    setDirection("left");
    setCurrent((c) => c - 1);
  };

  const skip = () => {
    sound.resume();
    sound.init();
    sound.onboardClick();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 overflow-hidden">
      {/* Animated bg */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_40%_20%,rgba(99,102,241,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(6,182,212,0.1),transparent_55%)]" />
        <div className={`onboard-orb absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-gradient-to-br ${slide.accent} blur-3xl opacity-20`} />
        <div className="onboard-orb absolute right-1/4 bottom-1/4 h-72 w-72 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-500 blur-3xl opacity-15" style={{ animationDelay: "3s" }} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4">
        <div
          key={current}
          className={`onboard-slide-${direction} rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/50 backdrop-blur-2xl ring-1 ring-white/5 sm:p-7`}
        >
          {/* Image */}
          <div className="relative mb-5 overflow-hidden rounded-2xl border border-white/10">
            <img
              src={slide.image}
              alt={slide.title}
              className="h-40 w-full object-cover sm:h-52"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
            <div className="absolute bottom-3 left-4">
              <span className={`inline-block rounded-full bg-gradient-to-r ${slide.accent} px-3 py-1 text-xs font-black text-slate-950 shadow-lg`}>
                {slide.badge}
              </span>
            </div>
            {/* Step indicator */}
            <div className="absolute right-4 top-3">
              <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold text-white/70 backdrop-blur">
                {current + 1} / {SLIDES.length}
              </span>
            </div>
          </div>

          {/* Content */}
          <h2 className="bg-gradient-to-br from-white to-slate-300 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
            {slide.title}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-400">{slide.subtitle}</p>
          <ul className="mt-4 space-y-2.5">
            {slide.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-200"
              >
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br ${slide.accent} text-[10px] font-black text-slate-950`}>
                  {i + 1}
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {/* Controls */}
          <div className="mt-6 flex items-center justify-between gap-3">
            {/* Dots */}
            <div className="flex gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDirection(i > current ? "right" : "left");
                    setCurrent(i);
                    sound.onboardClick();
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === current
                      ? `w-7 bg-gradient-to-r ${slide.accent}`
                      : "w-2 bg-white/20 hover:bg-white/40"
                  }`}
                  aria-label={`Page ${i + 1}`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {!isLast && (
                <button
                  onClick={skip}
                  className="rounded-full px-3 py-2 text-xs font-bold text-slate-500 transition hover:text-white"
                >
                  Passer ›
                </button>
              )}
              {current > 0 && (
                <button
                  onClick={goPrev}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                >
                  ←
                </button>
              )}
              <button
                onClick={goNext}
                className={`rounded-full bg-gradient-to-r ${slide.accent} px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg transition hover:scale-[1.04] hover:shadow-xl`}
              >
                {isLast ? "🎮 Commencer !" : "Suivant →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
