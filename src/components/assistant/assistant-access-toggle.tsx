import { Sparkles } from "lucide-react";

import { assistantAccessToggleText } from "@/lib/assistant/access-text";

/** The boss's on/off control for one person's AI access (server-rendered form). */
export function AssistantAccessToggle({
  action,
  idName,
  id,
  enabled,
  language,
}: {
  action: (formData: FormData) => Promise<void>;
  idName: "workerId" | "adminId";
  id: string;
  enabled: boolean;
  language: string;
}) {
  const text = assistantAccessToggleText(language);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4" data-testid="assistant-access-toggle">
      <input type="hidden" name={idName} value={id} />
      {enabled ? null : <input type="hidden" name="enabled" value="on" />}
      <Sparkles className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold">{text.title}</div>
        <div className="text-xs text-muted-foreground">{enabled ? text.on : text.off}</div>
      </div>
      <button
        type="submit"
        className={`min-h-11 rounded-md px-3 text-sm font-medium ${enabled ? "border bg-background hover:bg-muted" : "bg-primary text-primary-foreground hover:opacity-90"}`}
      >
        {enabled ? text.revoke : text.grant}
      </button>
    </form>
  );
}
