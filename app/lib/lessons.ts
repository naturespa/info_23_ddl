import type { Lesson } from "./types";
import { digitalLessons } from "./lessons-digital";

export const lessons: Lesson[] = [...digitalLessons];

export const lessonById = (id: string) => lessons.find((lesson) => lesson.id === id);

/** 実験の総数（理論文の数＝基礎/発展実験の数、＋1が応用ミッション） */
export const experimentCount = (lesson: Lesson) => lesson.theory.length + 1;

export const totalExperiments = lessons.reduce((sum, lesson) => sum + experimentCount(lesson), 0);
export const totalQuestions = lessons.reduce((sum, lesson) => sum + lesson.questions.length, 0);
