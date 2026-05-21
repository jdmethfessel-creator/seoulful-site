// Shared types for the kDupe Premium "Build My Routine" feature.
// The /api/routine endpoint returns this shape; the client components
// consume it.

export type WesternRoutineProduct = {
  name: string;
  brand: string;
  price: number;
};

export type KoreanRoutineProduct = WesternRoutineProduct & {
  match_score: number;
  key_actives: string[];
  amazon_url: string;
  yesstyle_url: string;
};

export type RoutineStep = {
  step: string;
  western: WesternRoutineProduct;
  korean: KoreanRoutineProduct;
};

export type RoutineSummary = {
  current_total: number;
  kdupe_total: number;
  annual_savings: number;
  conflicts_detected: string[];
};

export type Routine = {
  summary: RoutineSummary;
  morning: RoutineStep[];
  evening: RoutineStep[];
};
