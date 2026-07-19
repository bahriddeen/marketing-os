import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { uz } from "date-fns/locale";
import Button from "@/components/ui/Button";

type ChatConversationRow = {
  id: string;
  title: string | null;
  brand_id: string;
  created_at: string;
  brands: { name: string } | { name: string }[] | null;
};

interface Conversation {
  id: string;
  title: string | null;
  brand_id: string;
  created_at: string;
  brand_name: string;
}

export async function ConversationListComponent({ workspaceId }: { workspaceId: string }) {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("chat_conversations")
    .select("id, title, brand_id, created_at, brands(name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  const conversationList = (conversations ?? []).map((c: ChatConversationRow) => {
    const brandName = Array.isArray(c.brands) ? c.brands[0]?.name : c.brands?.name;
    return {
      id: c.id,
      title: c.title,
      brand_id: c.brand_id,
      created_at: c.created_at,
      brand_name: brandName || "Noma’lum",
    };
  });

  if (conversationList.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-canvas-soft p-8 text-center">
        <p className="text-muted mb-4">Suhbatlarni yarating va brainstorm qiling</p>
        <Link href="/app/chat/new" className="inline-block">
          <Button>Yangi suhbat</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversationList.map((conv: Conversation) => (
        <Link
          key={conv.id}
          href={`/app/chat/${conv.id}`}
          className="block rounded-lg border border-line bg-canvas p-4 hover:bg-canvas-soft transition"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-ink">
                {conv.title || `Suhbat — ${new Date(conv.created_at).toLocaleDateString("uz-UZ")}`}
              </h3>
              <p className="text-sm text-muted">{conv.brand_name}</p>
              <p className="text-xs text-muted mt-1">
                {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true, locale: uz })}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
