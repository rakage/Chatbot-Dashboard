import crypto from "crypto";
import { decrypt } from "./encryption";

export interface FacebookWebhookEntry {
  id: string;
  time: number;
  messaging: FacebookMessagingEvent[];
}

export interface FacebookMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: any[];
    is_echo?: boolean;
  };
  delivery?: {
    mids: string[];
    watermark: number;
  };
  read?: {
    watermark: number;
  };
  postback?: {
    title: string;
    payload: string;
  };
}

export interface FacebookSendMessageRequest {
  recipient: { id: string };
  message: {
    text?: string;
    attachment?: any;
  };
  messaging_type?: "RESPONSE" | "UPDATE" | "MESSAGE_TAG";
  tag?: string;
}

export class FacebookAPI {
  private appSecret: string;

  constructor() {
    if (!process.env.FB_APP_SECRET) {
      throw new Error("FB_APP_SECRET environment variable is required");
    }
    this.appSecret = process.env.FB_APP_SECRET;
  }

  /**
   * Verify webhook signature from Facebook
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!signature) {
      return false;
    }

    const elements = signature.split("=");
    const method = elements[0];
    const signatureHash = elements[1];

    if (method !== "sha1") {
      return false;
    }

    const expectedHash = crypto
      .createHmac("sha1", this.appSecret)
      .update(payload, "utf8")
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signatureHash, "hex"),
      Buffer.from(expectedHash, "hex")
    );
  }

  /**
   * Verify webhook token for initial setup
   */
  verifyWebhookToken(token: string, verifyToken: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(token, "utf8"),
      Buffer.from(verifyToken, "utf8")
    );
  }

  /**
   * Send a message to a user via Facebook Messenger
   */
  async sendMessage(
    pageAccessToken: string,
    request: FacebookSendMessageRequest
  ): Promise<{ message_id: string }> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook Send API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Get page information
   */
  async getPageInfo(pageAccessToken: string): Promise<{
    id: string;
    name: string;
    category: string;
  }> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,category&access_token=${pageAccessToken}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Facebook Graph API error: ${response.status} - ${error}`
      );
    }

    return await response.json();
  }

  /**
   * Subscribe page to webhook events
   */
  async subscribePageToWebhook(
    pageAccessToken: string,
    subscribed_fields: string[] = [
      "messages",
      "messaging_postbacks",
      "messaging_deliveries",
      "messaging_reads",
    ]
  ): Promise<{ success: boolean }> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/subscribed_apps`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscribed_fields: subscribed_fields.join(","),
          access_token: pageAccessToken,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Facebook Webhook subscription error: ${response.status} - ${error}`
      );
    }

    return await response.json();
  }

  /**
   * Unsubscribe page from webhook events
   */
  async unsubscribePageFromWebhook(
    pageAccessToken: string
  ): Promise<{ success: boolean }> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/subscribed_apps?access_token=${pageAccessToken}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Facebook Webhook unsubscription error: ${response.status} - ${error}`
      );
    }

    return await response.json();
  }

  /**
   * Get user profile information
   */
  async getUserProfile(
    userId: string,
    pageAccessToken: string,
    fields: string[] = [
      "first_name",
      "last_name",
      "profile_pic",
      "locale",
      "timezone",
    ]
  ): Promise<{
    first_name?: string;
    last_name?: string;
    profile_pic?: string;
    locale?: string;
    timezone?: number;
  }> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${userId}?fields=${fields.join(
        ","
      )}&access_token=${pageAccessToken}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Facebook User Profile API error: ${response.status} - ${error}`
      );
    }

    return await response.json();
  }

  /**
   * Parse webhook payload and extract messaging events
   */
  parseWebhookPayload(payload: any): FacebookWebhookEntry[] {
    if (!payload.object || payload.object !== "page") {
      throw new Error("Invalid webhook payload: not a page object");
    }

    if (!payload.entry || !Array.isArray(payload.entry)) {
      throw new Error(
        "Invalid webhook payload: missing or invalid entry array"
      );
    }

    return payload.entry;
  }

  /**
   * Check if a messaging event is a message
   */
  isMessageEvent(event: FacebookMessagingEvent): boolean {
    return !!(event.message && event.message.text && !event.message.is_echo);
  }

  /**
   * Check if a messaging event is a delivery confirmation
   */
  isDeliveryEvent(event: FacebookMessagingEvent): boolean {
    return !!event.delivery;
  }

  /**
   * Check if a messaging event is a read confirmation
   */
  isReadEvent(event: FacebookMessagingEvent): boolean {
    return !!event.read;
  }

  /**
   * Check if a messaging event is a postback
   */
  isPostbackEvent(event: FacebookMessagingEvent): boolean {
    return !!event.postback;
  }
}

export const facebookAPI = new FacebookAPI();
export default facebookAPI;
