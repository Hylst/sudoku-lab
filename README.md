# Labo Sudoku

**Le sudoku en ligne, cinq difficultés, sans compte.**

Labo Sudoku propose des grilles de sudoku jouables au clavier, à la souris ou au doigt, réparties en cinq difficultés : débutant, facile, moyen, difficile et expert. Le chrono démarre avec la grille, le mode notes permet de poser des candidats, les indices remplissent une case et le compteur d'erreurs signale les conflits. La progression, les cases fixes et les commandes clavier sont expliquées dans un onboarding illustré. Le son est synthétisé dans le navigateur.

Joue ici : [games.hylst.fr/sudoku-lab/](https://games.hylst.fr/sudoku-lab/)

![Labo Sudoku](public/og-image.png)

## Fonctionnalités

- Cinq difficultés et plusieurs grilles par difficulté.
- Chrono, compteur de cases remplies, erreurs et indices.
- Mode notes pour poser les candidats.
- Onboarding illustré, règles et commandes clavier.
- Sons synthétisés avec Web Audio, plein écran.
- Progression et onboarding conservés dans `localStorage` (`sudoku-lab-onboarded`), aucune donnée nominative.

## Technique

- React 19, TypeScript, Vite 7 et Tailwind CSS 4.
- Build en un fichier `index.html` avec les images importées.
- Aucune requête réseau pendant la partie, aucun compte, aucun cookie.

```bash
npm ci
npm run build
```

Le build sort dans `dist/`. Il se sert sous `/sudoku-lab/`.

## Structure

```
src/App.tsx        plateau, difficultés, chrono, notes et indices
src/Onboarding.tsx onboarding illustré
src/puzzles.ts     grilles et solutions
src/soundEngine.ts sons Web Audio
src/index.css      thème et animations
```

## Licence

AGPL-3.0-or-later. Voir `LICENSE`.

Jeu créé par Geoffroy (Hylst) avec l'aide d'une IA.
