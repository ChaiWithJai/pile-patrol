// The two modes and their destinations. Paper triage files knowledge-work and
// admin doom piles; move mode assigns items to a room + box. Both ride the same
// keep/kill machinery — "keep" means the information is safe, so the object can go.
export const MODES = {
  paper: {
    label: "Paper triage",
    root: "paper",
    // destinations a kept paper is filed under
    categories: [
      { id: "admin", label: "Admin", hint: "bills, tax, bank, insurance, forms" },
      { id: "knowledge-creative", label: "Knowledge / creative", hint: "notes, drafts, research, ideas" },
      { id: "personal", label: "Personal", hint: "cards, photos, tickets, reminders" },
    ],
  },
  move: {
    label: "Move / packing",
    root: "move",
    categories: [
      { id: "kitchen", label: "Kitchen", hint: "" },
      { id: "bedroom", label: "Bedroom", hint: "" },
      { id: "office", label: "Office", hint: "" },
      { id: "living", label: "Living room", hint: "" },
      { id: "bathroom", label: "Bathroom", hint: "" },
      { id: "misc", label: "Misc / unsorted", hint: "" },
    ],
  },
};

export function categoriesFor(mode) {
  return (MODES[mode] ?? MODES.paper).categories;
}

export function isCategory(mode, id) {
  return categoriesFor(mode).some((c) => c.id === id);
}
