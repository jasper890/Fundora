import type { TrackerStep } from "@/lib/types";

export function Tracker({ steps }: { steps: TrackerStep[] }) {
  return (
    <ol className="tracker">
      {steps.map((step) => (
        <li key={`${step.mark}-${step.label}`} data-mark={step.mark}>
          {step.label}
        </li>
      ))}
    </ol>
  );
}
