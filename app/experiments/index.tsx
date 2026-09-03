"use client";

import type { ReactNode } from "react";
import { digitalLabs, type LabProps } from "./digital";

const labs: Record<string, (props: LabProps) => ReactNode> = {
  ...digitalLabs
};

export function Experiments({
  lessonId,
  card,
  missionNote,
  onMissionNote
}: {
  lessonId: string;
} & Omit<LabProps, "card"> & { card: LabProps["card"] }) {
  const Lab = labs[lessonId];
  if (!Lab) return <p className="hint-line">この単元の実験は準備中です。</p>;
  return <div className="experiments">{Lab({ card, missionNote, onMissionNote })}</div>;
}
