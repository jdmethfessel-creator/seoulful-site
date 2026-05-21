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
  // True when the user input named real products we can compare against.
  // False when the input was a natural-language description and the
  // "western" fields are LLM-invented stand-ins rather than user products.
  has_specific_products: boolean;
  summary: RoutineSummary;
  morning: RoutineStep[];
  evening: RoutineStep[];
};
