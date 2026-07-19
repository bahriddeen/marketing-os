import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import { ConversationListComponent } from "@/components/chat/ConversationList";
import Button from "@/components/ui/Button";

export default async function ChatPage() {
  const ws = await getOrCreateWorkspace();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">Suhbat</h1>
        <Link href="/app/chat/new">
          <Button>Yangi suhbat</Button>
        </Link>
      </div>
      <ConversationListComponent workspaceId={ws.id} />
    </div>
  );
}
