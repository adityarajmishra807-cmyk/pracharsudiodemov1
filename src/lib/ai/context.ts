import type { State } from "@/lib/store";

export function buildPracharContext(state: State, page: string) {
  const qualifiedLeads = state.leads.filter((lead) => lead.status === "qualified").length;
  const wonLeads = state.leads.filter((lead) => lead.status === "won").length;
  const openConversations = state.conversations.filter((c) => c.status === "open").length;
  const runningCampaigns = state.campaigns.filter((c) => c.status === "running").length;
  const activeAutomations = state.automations.filter((a) => a.status === "active").length;
  const approvedTemplates = state.templates.filter((t) => t.status === "approved").length;
  const totalMessages = state.conversations.reduce((sum, c) => sum + c.messages.length, 0);

  const recentLeads = state.leads.slice(0, 12).map((lead) => ({
    name: lead.name,
    company: lead.company,
    status: lead.status,
    source: lead.source,
    tags: lead.tags,
    assignedTo: lead.assignedTo,
    createdAt: lead.createdAt,
  }));

  const campaignSummary = state.campaigns.map((campaign) => ({
    name: campaign.name,
    status: campaign.status,
    audienceStatus: campaign.audience.status,
    recipients: campaign.audience.leadIds.length,
    hasTemplate: campaign.templateId !== null,
  }));

  const automationSummary = state.automations.map((automation) => ({
    name: automation.name,
    status: automation.status,
    steps: automation.nodes.length,
  }));

  return {
    workspaceName: state.settings.workspaceName || "Prachar Studio",
    page,
    summary: JSON.stringify(
      {
        metrics: {
          leads: state.leads.length,
          qualifiedLeads,
          wonLeads,
          openConversations,
          conversations: state.conversations.length,
          messages: totalMessages,
          templates: state.templates.length,
          approvedTemplates,
          campaigns: state.campaigns.length,
          runningCampaigns,
          automations: state.automations.length,
          activeAutomations,
          teamMembers: state.members.length,
        },
        recentLeads,
        campaigns: campaignSummary,
        automations: automationSummary,
      },
      null,
      2,
    ),
  };
}
