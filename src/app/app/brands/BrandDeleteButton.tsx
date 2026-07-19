"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { deleteBrand } from "./actions";

export default function BrandDeleteButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await deleteBrand(id);
      if (res.ok) {
        setOpen(false);
        toast.show("Brend o‘chirildi.", "success");
        router.refresh();
      } else {
        toast.show(res.error, "error");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded font-medium text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        O‘chirish
      </button>
      <ConfirmDialog
        open={open}
        title="Brendni o‘chirish"
        description={`"${name}" brendini o‘chirmoqchimisiz? Bu amalni ortga qaytarib bo‘lmaydi.`}
        confirmLabel="Ha, o‘chirish"
        cancelLabel="Bekor qilish"
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
        pending={pending}
      />
    </>
  );
}
