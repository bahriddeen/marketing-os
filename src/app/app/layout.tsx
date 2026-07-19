import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";
import Sidebar from "@/components/app/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await getOrCreateWorkspace();
  const credits = await getCreditBalance(ws.id);
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar credits={credits} />
        <main className="flex-1 bg-canvas p-4 md:p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
