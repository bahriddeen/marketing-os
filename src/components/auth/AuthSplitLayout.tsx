import Link from "next/link";
import CaptionDemo from "@/components/marketing/CaptionDemo";

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
            Brendingiz haqida yozing &mdash; qolganini AI bajaradi.
          </p>
          <CaptionDemo variant="quiet" />
        </div>
        <p className="text-sm text-white/40">
          O&apos;zbekiston SMM va marketing mutaxassislari uchun
        </p>
      </div>
      <div className="flex w-full flex-col items-center justify-center bg-canvas px-6 py-12 md:w-1/2">
        {children}
      </div>
    </div>
  );
}
