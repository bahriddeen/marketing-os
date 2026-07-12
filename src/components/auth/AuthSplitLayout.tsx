import Link from "next/link";
import CaptionDemo from "@/components/marketing/CaptionDemo";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function AuthSplitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-[#14171B] p-12 md:flex">
        <Link
          href="/"
          className="font-display text-lg font-semibold text-white"
        >
          AI Marketing OS
        </Link>
        <div className="max-w-sm">
          <p className="mb-6 font-display text-2xl font-semibold leading-snug text-white">
            Brendingiz haqida yozing &mdash; qolganini sun&#8216;iy intellekt bajaradi.
          </p>
          <CaptionDemo variant="quiet" />
        </div>
        <p className="text-sm text-white/40">
          O&apos;zbekiston SMM va marketing mutaxassislari uchun
        </p>
      </div>
      <div className="flex w-full flex-col bg-canvas px-6 pb-12 pt-6 md:w-1/2">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}
