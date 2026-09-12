import { createFileRoute } from "@tanstack/react-router";
import { RecipientList } from "@/components/RecipientActions";
import type { FamilyMember, Reminder } from "@/lib/ereminder";

/** Temporary diagnostic render check — removed after verification. */
export const Route = createFileRoute("/tmp-greet-check")({
  component: Page,
});

const member = {
  id: "f12af442-c867-4e08-9bc4-903110be310b",
  full_name: "Lira Alphonso",
  relationship: "sister",
  greetings_enabled: true,
  whatsapp_phone: "+919967134652",
  email: "lira@example.com",
  likes: [],
  music_genres: [],
} as unknown as FamilyMember;

const reminder = {
  id: "cfea74e4-2a4a-41e2-934f-eb6409a3f2e1",
  title: "Lira Alphonso's birthday",
  category: "personal_family",
  due_at: new Date().toISOString(),
} as unknown as Reminder;

function Page() {
  return (
    <div className="p-6">
      <RecipientList reminder={reminder} occurrence={new Date()} recipients={[member]} />
    </div>
  );
}
