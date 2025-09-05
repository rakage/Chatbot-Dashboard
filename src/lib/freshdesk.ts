import { decrypt } from "./encryption";

export interface FreshdeskConfig {
  domain: string; // e.g., "salsationfitness"
  apiKeyEnc: string; // Encrypted API key
}

export interface FreshdeskTicket {
  subject: string;
  description: string;
  email?: string;
  name?: string;
  phone?: string;
  priority: 1 | 2 | 3 | 4; // 1=Low, 2=Medium, 3=High, 4=Urgent
  status: 2 | 3 | 4 | 5; // 2=Open, 3=Pending, 4=Resolved, 5=Closed
  source: number; // 7=Chat, 8=Facebook, 9=Twitter, etc.
  type?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  cc_emails?: string[];
  group_id?: number;
  product_id?: number;
}

export interface FreshdeskContact {
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  twitter_id?: string;
  unique_external_id?: string;
  other_emails?: string[];
  company_id?: number;
  view_all_tickets?: boolean;
  other_companies?: number[];
  address?: string;
  avatar?: any;
  custom_fields?: Record<string, any>;
  description?: string;
  job_title?: string;
  language?: string;
  tags?: string[];
  time_zone?: string;
}

export interface FreshdeskTicketResponse {
  id: number;
  subject: string;
  description: string;
  description_text: string;
  status: number;
  priority: number;
  type: string;
  source: number;
  created_at: string;
  updated_at: string;
  requester_id: number;
  responder_id?: number;
  cc_emails: string[];
  fwd_emails: string[];
  reply_cc_emails: string[];
  tags: string[];
  fr_escalated: boolean;
  spam: boolean;
  email_config_id?: number;
  group_id?: number;
  product_id?: number;
  company_id?: number;
  custom_fields: Record<string, any>;
}

export interface FreshdeskContactResponse {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  twitter_id?: string;
  unique_external_id?: string;
  other_emails: string[];
  company_id?: number;
  view_all_tickets: boolean;
  deleted: boolean;
  helpdesk_agent: boolean;
  role: number;
  signature?: string;
  contact_company?: any;
  other_companies: any[];
  address?: string;
  avatar?: any;
  custom_fields: Record<string, any>;
  description?: string;
  job_title?: string;
  language: string;
  tags: string[];
  time_zone: string;
  created_at: string;
  updated_at: string;
}

export class FreshdeskAPI {
  private domain: string;
  private apiKey: string;

  constructor(domain: string, apiKey: string) {
    this.domain = domain.replace(".freshdesk.com", ""); // Remove domain suffix if provided
    this.apiKey = apiKey;
  }

  private getBaseUrl(): string {
    return `https://${this.domain}.freshdesk.com/api/v2`;
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.apiKey}:X`).toString("base64")}`;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: any
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      "Content-Type": "application/json",
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && (method === "POST" || method === "PUT")) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Freshdesk API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  /**
   * Create a new ticket in Freshdesk
   */
  async createTicket(
    ticket: FreshdeskTicket
  ): Promise<FreshdeskTicketResponse> {
    return await this.makeRequest<FreshdeskTicketResponse>(
      "/tickets",
      "POST",
      ticket
    );
  }

  /**
   * Get ticket details by ID
   */
  async getTicket(ticketId: number): Promise<FreshdeskTicketResponse> {
    return await this.makeRequest<FreshdeskTicketResponse>(
      `/tickets/${ticketId}`
    );
  }

  /**
   * Update an existing ticket
   */
  async updateTicket(
    ticketId: number,
    updates: Partial<FreshdeskTicket>
  ): Promise<FreshdeskTicketResponse> {
    return await this.makeRequest<FreshdeskTicketResponse>(
      `/tickets/${ticketId}`,
      "PUT",
      updates
    );
  }

  /**
   * Add a note to a ticket
   */
  async addNoteToTicket(
    ticketId: number,
    note: { body: string; private?: boolean }
  ): Promise<any> {
    return await this.makeRequest(`/tickets/${ticketId}/notes`, "POST", note);
  }

  /**
   * Create a new contact in Freshdesk
   */
  async createContact(
    contact: FreshdeskContact
  ): Promise<FreshdeskContactResponse> {
    return await this.makeRequest<FreshdeskContactResponse>(
      "/contacts",
      "POST",
      contact
    );
  }

  /**
   * Get contact by ID
   */
  async getContact(contactId: number): Promise<FreshdeskContactResponse> {
    return await this.makeRequest<FreshdeskContactResponse>(
      `/contacts/${contactId}`
    );
  }

  /**
   * Search contacts by email
   */
  async searchContactByEmail(
    email: string
  ): Promise<FreshdeskContactResponse[]> {
    const encodedEmail = encodeURIComponent(email);
    return await this.makeRequest<FreshdeskContactResponse[]>(
      `/contacts?email=${encodedEmail}`
    );
  }

  /**
   * Get all tickets for a contact
   */
  async getContactTickets(
    contactId: number
  ): Promise<FreshdeskTicketResponse[]> {
    return await this.makeRequest<FreshdeskTicketResponse[]>(
      `/contacts/${contactId}/tickets`
    );
  }

  /**
   * Get all groups in Freshdesk
   */
  async getGroups(): Promise<
    Array<{ id: number; name: string; description?: string }>
  > {
    return await this.makeRequest<
      Array<{ id: number; name: string; description?: string }>
    >("/groups");
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Try to get the first ticket to test authentication
      await this.makeRequest("/tickets?per_page=1");
      return { success: true, message: "Connection successful" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * Helper function to create FreshdeskAPI instance from config
 */
export async function createFreshdeskAPI(
  config: FreshdeskConfig
): Promise<FreshdeskAPI> {
  const apiKey = await decrypt(config.apiKeyEnc);
  return new FreshdeskAPI(config.domain, apiKey);
}

/**
 * Helper function to format conversation messages for ticket description
 * Formats the 10 newest messages in descending order (newest first)
 */
export function formatConversationForTicket(
  messages: Array<{ role: string; text: string; createdAt: string }>,
  customerProfile?: { firstName?: string; lastName?: string; email?: string }
): string {
  const firstName = customerProfile?.firstName || "";
  const lastName = customerProfile?.lastName || "";
  const customerName = customerProfile
    ? `${firstName} ${lastName}`.trim()
    : "Customer";

  let description = `Chat conversation escalated to support:\n\n`;

  if (customerProfile?.email) {
    description += `Customer Email: ${customerProfile.email}\n`;
  }

  description += `\n--- Recent Conversation History (10 newest messages) ---\n\n`;

  // Messages are already in descending order (newest first)
  messages.forEach((message, index) => {
    const timestamp = new Date(message.createdAt).toLocaleString();
    let sender = "Bot";
    if (message.role === "USER") {
      sender = customerName;
    } else if (message.role === "AGENT") {
      sender = "Agent";
    }

    description += `[${timestamp}] ${sender}:\n${message.text}\n\n`;
  });

  if (messages.length >= 10) {
    description += `\n--- Note: Showing 10 most recent messages ---\n`;
  }

  return description;
}

/**
 * Source mapping for different chat platforms
 * Based on Freshdesk API documentation valid values: 1,2,3,5,6,7,9,11,10
 */
export const FRESHDESK_SOURCES = {
  EMAIL: 1,
  PORTAL: 2,
  PHONE: 3,
  CHAT: 7,
  TWITTER: 9,
  FEEDBACK_WIDGET: 10,
  OUTBOUND_EMAIL: 11,
  // Facebook is not a standard source, we'll use Chat (7) as fallback
  FACEBOOK: 7,
} as const;

/**
 * Common Freshdesk ticket types - these need to match your Freshdesk instance
 * Update these based on your actual Freshdesk ticket types
 */
export const FRESHDESK_TICKET_TYPES = {
  GENERAL_INQUIRY: "General Inquiry",
  EVENTS_HOSTS: "Events: Hosts",
  EVENTS_ATTENDANCE: "Events: Attendance",
  EVENTS_UPLOADING: "Events:  Uploading",
  CLASSES_ATTENDING: "Classes: Attending",
  BECOMING_INSTRUCTOR: "Becoming an instructor/elite",
  PAYMENTS_REFUND: "Payments: Refund",
  PAYMENTS_PURCHASE: "Payments: Purchase",
  FEEDBACK_NEGATIVE: "Feedback: Negative",
  FEEDBACK_POSITIVE: "Feedback: Positive",
  SHOP_RETURNS: "Shop: Returns",
  SHOP_INVOICES: "Shop: Invoices",
  SHOP_PAYMENTS: "Shop: Payments/Refunds",
  SHOP_DELIVERY: "Shop: Package Delivery/Tracking",
  SHOP_WAITLIST: "Shop: Waitlist",
  SHOP_COMPLAINTS: "Shop: Complaints",
  SHOP_QUESTIONS: "Shop: Questions",
  INSTRUCTOR_EVENT: "Instructor: Event related ",
  INSTRUCTOR_PAYMENT: "Instructor: Payment/ reconciliations/ Invoices",
  INSTRUCTOR_QUESTION: "Instructor: Question",
  ADMIN_MANAGEMENT: "Admin/Management",
  SPAM: "Spam",
  TEAM_INFORMATION: "Team:  Information",
  SUPPORT_TEAM: "Support:  Team",
  SUPPORT_WEBSITE: "Support:  Website",
  SUPPORT_SOCIAL_MEDIA: "Support:  Social Media",
  LEGAL: "Legal",
} as const;

export default FreshdeskAPI;
