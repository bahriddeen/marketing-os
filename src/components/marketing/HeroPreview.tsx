import { Briefcase, Home, PenLine } from "lucide-react";
import CaptionDemo from "./CaptionDemo";

const NAV_ITEMS = [
  { label: "Bosh sahifa", Icon: Home, active: false },
  { label: "Brendlar", Icon: Briefcase, active: false },
  { label: "Kopiraiting", Icon: PenLine, active: true },
];

export default function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-4xl">
      <div className="relative overflow-hidden rounded-[1.25rem] border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </div>
        <div className="flex">
          <div className="hidden w-48 shrink-0 border-r border-line bg-surface p-4 md:block">
            <p className="mb-4 px-2 text-sm font-semibold text-ink">
              AI Marketing OS
            </p>
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ label, Icon, active }) => (
                <span
                  key={label}
                  className={`flex items-center gap-2.5 rounded-[0.625rem] px-3 py-2 text-sm font-medium ${
                    active ? "bg-accent-soft text-accent" : "text-muted"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {label}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex-1 bg-canvas p-6">
            <CaptionDemo variant="full" />
          </div>
        </div>
      </div>
    </div>
  );
}
