import RoutineBuilder from "@/components/RoutineBuilder";

export const metadata = {
  title: "Build My Routine — kDupe Premium",
  description:
    "Paste your full Western skincare routine and get a complete K-beauty version with ingredient conflict checking and savings totals.",
};

export default function RoutinePage() {
  return (
    <main style={{ background: "#0a0a0a", color: "#f5f0eb", minHeight: "100vh" }}>
      <RoutineBuilder />
    </main>
  );
}
