"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { deleteBrand } from "./actions";

export default function DeleteBrandButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const res = await deleteBrand(brandId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="text-muted">{error ?? "O‘chirilsinmi?"}</span>
        <Button
          variant="danger"
          onClick={onDelete}
          disabled={pending}
          className="px-1 py-0"
        >
          {pending ? "…" : "Ha"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={pending}
          className="px-1 py-0"
        >
          Yo‘q
        </Button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="font-medium text-danger hover:underline"
    >
      O‘chirish
    </button>
  );
}
