import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* ---------------------------------- types --------------------------------- */

export type PermissionKey =
  | "dashboard"
  | "leadsView"
  | "leadsEdit"
  | "inboxReply"
  | "inboxAssign"
  | "templatesUse"
  | "templatesManage"
  | "campaigns"
  | "automations"
  | "analytics"
  | "settings";

export type Permissions = Record<PermissionKey, boolean>;

export const PERMISSION_GROUPS: {
  area: string;
  items: { key: PermissionKey; label: string }[];
}[] = [
  { area: "Dashboard", items: [{ key: "dashboard", label: "View dashboard" }] },
  {
    area: "CRM / Leads",
    items: [
      { key: "leadsView", label: "View leads" },
      { key: "leadsEdit", label: "Create & edit leads" },
    ],
  },
  {
    area: "WhatsApp Inbox",
    items: [
      { key: "inboxReply", label: "Reply to conversations" },
      { key: "inboxAssign", label: "Assign & change status" },
    ],
  },
  {
    area: "Templates",
    items: [
      { key: "templatesUse", label: "Use templates" },
      { key: "templatesManage", label: "Create & manage templates" },
    ],
  },
  { area: "Campaigns", items: [{ key: "campaigns", label: "Access campaigns" }] },
  { area: "Automations", items: [{ key: "automations", label: "Access automations" }] },
  { area: "Analytics", items: [{ key: "analytics", label: "View analytics" }] },
  { area: "Settings", items: [{ key: "settings", label: "Access settings" }] },
];

export const defaultPermissions: Permissions = {
  dashboard: true,
  leadsView: true,
  leadsEdit: false,
  inboxReply: true,
  inboxAssign: false,
  templatesUse: true,
  templatesManage: false,
  campaigns: false,
  automations: false,
  analytics: false,
  settings: false,
};

export type Member = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  status: "active" | "invited" | "suspended";
  permissions: Permissions;
  createdAt: string;
};

export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

export type Activity = { id: string; at: string; text: string };

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  source: string;
  status: LeadStatus;
  tags: string[];
  assignedTo: string | null; // member id or "owner"
  notes: string;
  createdAt: string;
  activity: Activity[];
};

export type Message = {
  id: string;
  direction: "in" | "out";
  text: string;
  at: string;
};

export type Conversation = {
  id: string;
  leadId: string;
  status: "open" | "pending" | "closed";
  assignedTo: string | null;
  messages: Message[];
  createdAt: string;
};

export type Template = {
  id: string;
  name: string;
  category: string;
  status: "draft" | "approved" | "paused";
  body: string;
  createdAt: string;
};

export type Campaign = {
  id: string;
  name: string;
  audience: { status: LeadStatus | "all"; tag: string | null; leadIds: string[] };
  templateId: string | null;
  status: "draft" | "scheduled" | "running" | "completed";
  createdAt: string;
};

export type NodeType =
  | "trigger"
  | "condition"
  | "tag"
  | "delay"
  | "message"
  | "assign";

export type WorkflowNode = {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, string>;
};

export type Automation = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused";
  nodes: WorkflowNode[];
  createdAt: string;
};

export type Settings = {
  workspaceName: string;
  ownerName: string;
  ownerEmail: string;
  whatsappNumber: string;
  timezone: string;
  notifyNewLead: boolean;
  notifyNewMessage: boolean;
};

export type Session =
  | { kind: "owner" }
  | { kind: "member"; memberId: string }
  | null;

type State = {
  members: Member[];
  leads: Lead[];
  conversations: Conversation[];
  templates: Template[];
  campaigns: Campaign[];
  automations: Automation[];
  settings: Settings;
  session: Session;
};

const emptyState: State = {
  members: [],
  leads: [],
  conversations: [],
  templates: [],
  campaigns: [],
  automations: [],
  settings: {
    workspaceName: "Prachar Studio",
    ownerName: "",
    ownerEmail: "",
    whatsappNumber: "",
    timezone: "Asia/Kolkata",
    notifyNewLead: true,
    notifyNewMessage: true,
  },
  session: null,
};

const STORAGE_KEY = "prachar-studio-demo-v1";

export const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

/* --------------------------------- context -------------------------------- */

type Store = {
  ready: boolean;
  state: State;
  // session
  signIn: (session: Exclude<Session, null>) => void;
  signOut: () => void;
  isOwner: boolean;
  currentMember: Member | null;
  can: (key: PermissionKey) => boolean;
  // members
  addMember: (data: Omit<Member, "id" | "createdAt">) => Member;
  updateMember: (id: string, data: Partial<Member>) => void;
  removeMember: (id: string) => void;
  setMemberPermissions: (id: string, permissions: Permissions) => void;
  // leads
  addLead: (
    data: Omit<Lead, "id" | "createdAt" | "activity"> & { activity?: Activity[] },
  ) => Lead;
  updateLead: (id: string, data: Partial<Lead>, activityText?: string) => void;
  removeLead: (id: string) => void;
  // conversations
  startConversation: (leadId: string) => Conversation;
  addMessage: (conversationId: string, direction: "in" | "out", text: string) => void;
  updateConversation: (id: string, data: Partial<Conversation>) => void;
  // templates
  addTemplate: (data: Omit<Template, "id" | "createdAt">) => Template;
  updateTemplate: (id: string, data: Partial<Template>) => void;
  removeTemplate: (id: string) => void;
  // campaigns
  addCampaign: (data: Omit<Campaign, "id" | "createdAt">) => Campaign;
  updateCampaign: (id: string, data: Partial<Campaign>) => void;
  removeCampaign: (id: string) => void;
  // automations
  addAutomation: (name: string) => Automation;
  updateAutomation: (id: string, data: Partial<Automation>) => void;
  removeAutomation: (id: string) => void;
  // settings
  updateSettings: (data: Partial<Settings>) => void;
  resetDemo: () => void;
  memberName: (id: string | null) => string;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...emptyState, ...(JSON.parse(raw) as State) });
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  const patch = useCallback((fn: (s: State) => State) => setState((s) => fn(s)), []);

  const currentMember = useMemo(() => {
    const session = state.session;
    if (session?.kind !== "member") return null;
    return state.members.find((m) => m.id === session.memberId) ?? null;
  }, [state.session, state.members]);

  const isOwner = state.session?.kind === "owner";

  const value: Store = useMemo(() => {
    const memberName = (id: string | null) => {
      if (!id) return "Unassigned";
      if (id === "owner") return state.settings.ownerName || "Owner";
      return state.members.find((m) => m.id === id)?.name ?? "Unknown";
    };

    return {
      ready,
      state,
      isOwner,
      currentMember,
      memberName,
      can: (key) => (isOwner ? true : !!currentMember?.permissions[key]),
      signIn: (session) => patch((s) => ({ ...s, session })),
      signOut: () => patch((s) => ({ ...s, session: null })),

      addMember: (data) => {
        const member: Member = { ...data, id: uid(), createdAt: now() };
        patch((s) => ({ ...s, members: [...s.members, member] }));
        return member;
      },
      updateMember: (id, data) =>
        patch((s) => ({
          ...s,
          members: s.members.map((m) => (m.id === id ? { ...m, ...data } : m)),
        })),
      removeMember: (id) =>
        patch((s) => ({
          ...s,
          members: s.members.filter((m) => m.id !== id),
          leads: s.leads.map((l) =>
            l.assignedTo === id ? { ...l, assignedTo: null } : l,
          ),
          conversations: s.conversations.map((c) =>
            c.assignedTo === id ? { ...c, assignedTo: null } : c,
          ),
          session:
            s.session?.kind === "member" && s.session.memberId === id
              ? { kind: "owner" }
              : s.session,
        })),
      setMemberPermissions: (id, permissions) =>
        patch((s) => ({
          ...s,
          members: s.members.map((m) => (m.id === id ? { ...m, permissions } : m)),
        })),

      addLead: (data) => {
        const lead: Lead = {
          ...data,
          id: uid(),
          createdAt: now(),
          activity: [{ id: uid(), at: now(), text: "Lead created" }],
        };
        patch((s) => ({ ...s, leads: [lead, ...s.leads] }));
        return lead;
      },
      updateLead: (id, data, activityText) =>
        patch((s) => ({
          ...s,
          leads: s.leads.map((l) =>
            l.id === id
              ? {
                  ...l,
                  ...data,
                  activity: activityText
                    ? [{ id: uid(), at: now(), text: activityText }, ...l.activity]
                    : l.activity,
                }
              : l,
          ),
        })),
      removeLead: (id) =>
        patch((s) => ({
          ...s,
          leads: s.leads.filter((l) => l.id !== id),
          conversations: s.conversations.filter((c) => c.leadId !== id),
        })),

      startConversation: (leadId) => {
        const existing = state.conversations.find((c) => c.leadId === leadId);
        if (existing) return existing;
        const conversation: Conversation = {
          id: uid(),
          leadId,
          status: "open",
          assignedTo: null,
          messages: [],
          createdAt: now(),
        };
        patch((s) => ({ ...s, conversations: [conversation, ...s.conversations] }));
        return conversation;
      },
      addMessage: (conversationId, direction, text) =>
        patch((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [
                    ...c.messages,
                    { id: uid(), direction, text, at: now() },
                  ],
                }
              : c,
          ),
        })),
      updateConversation: (id, data) =>
        patch((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, ...data } : c,
          ),
        })),

      addTemplate: (data) => {
        const template: Template = { ...data, id: uid(), createdAt: now() };
        patch((s) => ({ ...s, templates: [template, ...s.templates] }));
        return template;
      },
      updateTemplate: (id, data) =>
        patch((s) => ({
          ...s,
          templates: s.templates.map((t) => (t.id === id ? { ...t, ...data } : t)),
        })),
      removeTemplate: (id) =>
        patch((s) => ({
          ...s,
          templates: s.templates.filter((t) => t.id !== id),
          campaigns: s.campaigns.map((c) =>
            c.templateId === id ? { ...c, templateId: null } : c,
          ),
        })),

      addCampaign: (data) => {
        const campaign: Campaign = { ...data, id: uid(), createdAt: now() };
        patch((s) => ({ ...s, campaigns: [campaign, ...s.campaigns] }));
        return campaign;
      },
      updateCampaign: (id, data) =>
        patch((s) => ({
          ...s,
          campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...data } : c)),
        })),
      removeCampaign: (id) =>
        patch((s) => ({ ...s, campaigns: s.campaigns.filter((c) => c.id !== id) })),

      addAutomation: (name) => {
        const automation: Automation = {
          id: uid(),
          name,
          status: "draft",
          nodes: [],
          createdAt: now(),
        };
        patch((s) => ({ ...s, automations: [automation, ...s.automations] }));
        return automation;
      },
      updateAutomation: (id, data) =>
        patch((s) => ({
          ...s,
          automations: s.automations.map((a) => (a.id === id ? { ...a, ...data } : a)),
        })),
      removeAutomation: (id) =>
        patch((s) => ({ ...s, automations: s.automations.filter((a) => a.id !== id) })),

      updateSettings: (data) =>
        patch((s) => ({ ...s, settings: { ...s.settings, ...data } })),
      resetDemo: () => setState({ ...emptyState, session: { kind: "owner" } }),
    };
  }, [state, ready, isOwner, currentMember, patch]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/* --------------------------------- helpers -------------------------------- */

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
];

export const LEAD_SOURCES = [
  "WhatsApp",
  "Website",
  "Referral",
  "Instagram",
  "Google Ads",
  "Walk-in",
  "Other",
];

export const TEMPLATE_CATEGORIES = [
  "Welcome",
  "Follow-up",
  "Appointment",
  "Offer",
  "Payment",
  "Support",
];

export const NODE_TYPES: { type: NodeType; label: string; hint: string }[] = [
  { type: "trigger", label: "Trigger", hint: "Starts the workflow" },
  { type: "condition", label: "Condition", hint: "Branch on lead data" },
  { type: "tag", label: "Add tag", hint: "Tag the lead" },
  { type: "delay", label: "Delay", hint: "Wait before next step" },
  { type: "message", label: "Message / Template", hint: "Send a WhatsApp template" },
  { type: "assign", label: "Assignment", hint: "Assign to a team member" },
];

export function fillTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? `{{${key}}}`);
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
