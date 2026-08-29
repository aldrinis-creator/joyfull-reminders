import { createFileRoute } from "@tanstack/react-router";
import { ReminderCard } from "@/components/ReminderCard";
import type { Reminder } from "@/lib/ereminder";

export const Route = createFileRoute("/paytest")({ component: PayTest });

const demo = {
  id: "demo",
  title: "Electricity bill",
  category: "household",
  description: "BESCOM",
  due_at: new Date().toISOString(),
  completed: false,
  payment_url: "bill.example.com/pay",
  upi_id: "biller@upi",
  upi_payee_name: "BESCOM",
  payment_amount: 1499,
} as unknown as Reminder;

function PayTest() {
  return (
    <div className="p-6">
      <ReminderCard reminder={demo} occurrence={new Date()} />
    </div>
  );
}
