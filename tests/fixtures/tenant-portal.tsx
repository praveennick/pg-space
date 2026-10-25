// Fictional UI fixture. No Firebase connection, real records or email operations.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "../../src/index.css";
import "../../src/mobile.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  TenantPortalView,
  type TenantPortalRecords,
} from "../../src/components/TenantPortalView";

const createdAt = "2026-10-25T08:00:00Z";
const fixture: TenantPortalRecords = {
  profile: {
    name: "Ananya Rao",
    email: "ananya@example.test",
    phone: "9000000000",
    occupation: "Software engineer",
  },
  stays: [
    {
      id: "stay",
      createdAt,
      tenantId: "resident",
      bedId: "bed",
      start: "2026-08-01",
      end: null,
      rent: 850000,
      deposit: 1500000,
      dueDay: 5,
      expectedCheckout: "",
    },
  ],
  invoices: [
    {
      id: "bill",
      createdAt,
      tenantId: "resident",
      occupancyId: "stay",
      month: "2026-10",
      due: "2026-10-05",
      amount: 850000,
      description: "Monthly rent",
    },
  ],
  payments: [
    {
      id: "payment",
      createdAt,
      tenantId: "resident",
      amount: 850000,
      date: "2026-10-03",
      method: "UPI",
      reference: "",
      notes: "",
      key: "demo",
    },
  ],
  tickets: [
    {
      id: "ticket",
      createdAt,
      tenantId: "resident",
      occupancyId: "stay",
      roomId: "room",
      bedId: "bed",
      category: "Wi-Fi",
      description: "The Wi-Fi connection keeps dropping in my room.",
      priority: "Medium",
      status: "In Progress",
      block: false,
      resolution: "",
    },
    {
      id: "ticket-2",
      createdAt: "2026-10-18T08:00:00Z",
      tenantId: "resident",
      occupancyId: "stay",
      roomId: "room",
      bedId: "bed",
      category: "Electrical",
      description: "The light above my bed is not working.",
      priority: "Medium",
      status: "Resolved",
      block: false,
      resolution:
        "The light has been replaced. Please let us know if you need any more help.",
    },
  ],
};
export function Preview() {
  const params = new URLSearchParams(location.search);
  const [records, setRecords] = useState<TenantPortalRecords>(
    params.has("empty")
      ? { ...fixture, tickets: [], invoices: [], payments: [] }
      : fixture,
  );
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  return (
    <TenantPortalView
      records={records}
      ended={params.has("ended")}
      busy={false}
      error=""
      sending={false}
      category={category}
      description={description}
      ticketMessage={ticketMessage}
      ticketFailed={false}
      onCategory={setCategory}
      onDescription={setDescription}
      onRefresh={() => {}}
      onSignOut={() => {}}
      onSubmit={(event) => {
        event.preventDefault();
        setRecords({
          ...records,
          tickets: [
            {
              ...fixture.tickets[0],
              id: `preview-${Date.now()}`,
              category,
              description,
              status: "Open",
              resolution: "",
            },
            ...records.tickets,
          ],
        });
        setDescription("");
        setTicketMessage("Your repair request was sent.");
      }}
    />
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
