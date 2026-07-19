import { signIn } from "@/app/auth/actions";
import { Input, Label } from "@/components/ui/Input";
import SubmitButton from "@/components/auth/SubmitButton";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthSplitLayout>
      <form action={signIn} className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Kirish
          </h1>
          <p className="mt-1 text-sm text-muted">
            Akkauntingizga kiring va ishni davom ettiring.
          </p>
        </div>
        {error && (
          <p className="rounded-[0.625rem] border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <label className="block">
          <Label>Elektron pochta</Label>
          <Input name="email" type="email" required placeholder="siz@email.com" />
        </label>
        <label className="block">
          <Label>Parol</Label>
          <Input name="password" type="password" required placeholder="••••••••" />
        </label>
        <SubmitButton pendingText="Kirilyapti...">Kirish</SubmitButton>
        <p className="text-center text-sm text-muted">
          Akkauntingiz yo&apos;qmi?{" "}
          <Link className="font-medium text-accent hover:underline" href="/signup">
            Ro&apos;yxatdan o&apos;tish
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
