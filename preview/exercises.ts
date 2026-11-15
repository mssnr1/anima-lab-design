import type { FaceExercise } from '../src/engine/faceExercise'

/**
 * "Brauen-Lift": the brow raiser (frontalis) works against the gentle resistance of the fingers, which
 * also hold the forehead skin smooth so no lines are pressed into it. A first draft for Fayo; the
 * content belongs in the app, it is here only to show the visualisation.
 */
export const BROW_LIFT: FaceExercise = {
  id: 'brow-lift',
  intro: [
    { label: 'Ankommen', cue: 'Zeigefinger waagerecht direkt unter die Augenbrauen legen. Schultern locker, Blick geradeaus.', durationMs: 5000, muscles: {} },
  ],
  steps: [
    { label: 'Heben', cue: 'Brauen gegen die Finger nach oben drücken. Die Finger halten sanft dagegen.', durationMs: 3000, muscles: { frontalis: 1 } },
    { label: 'Halten', cue: 'Halten. Augen weit, Blick wach, Stirn bleibt glatt.', durationMs: 6000, muscles: { frontalis: 1 }, pulse: 0.15 },
    { label: 'Lösen', cue: 'Langsam loslassen.', durationMs: 3000, muscles: {} },
    { label: 'Pause', cue: 'Durchatmen.', durationMs: 3000, muscles: {} },
  ],
  repetitions: 8,
  outro: [
    { label: 'Ausstreichen', cue: 'Mit den Fingerspitzen von der Mitte der Stirn zu den Schläfen streichen.', durationMs: 8000, muscles: { frontalis: 0.25, temporalisLeft: 0.25, temporalisRight: 0.25 } },
  ],
}
