const rentLabels: Record<string, string> = {
  Paid: "Paid",
  Partial: "Part paid",
  Overdue: "Late",
  Unpaid: "Not paid",
  Outstanding: "Still due",
};

const depositLabels: Record<string, string> = {
  Collected: "Money received",
  Deduction: "Money kept",
  Refund: "Money returned",
};

export const rentStatusLabel = (status: string) => rentLabels[status] || status;
export const depositActionLabel = (action: string) => depositLabels[action] || action;
