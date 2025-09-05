"use client";

import { useState, useEffect } from "react";
import { FRESHDESK_TICKET_TYPES } from "@/lib/freshdesk";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Ticket,
  History,
  Plus,
  Clock,
  User,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  customerName?: string;
  customerEmail?: string;
  existingTickets?: Array<{
    id: number;
    url: string;
    subject: string;
    status: number;
    priority: number;
    createdAt: string;
  }>;
  onTicketCreated?: (ticketData: any) => void;
}

interface TicketFormData {
  subject: string;
  description: string;
  priority: number;
  status: number;
  type: string;
  includeConversationHistory: boolean;
  tags: string[];
}

const PRIORITY_OPTIONS = [
  { value: 1, label: "Low", color: "bg-green-100 text-green-800" },
  { value: 2, label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { value: 3, label: "High", color: "bg-orange-100 text-orange-800" },
  { value: 4, label: "Urgent", color: "bg-red-100 text-red-800" },
];

const STATUS_OPTIONS = [
  { value: 2, label: "Open", color: "bg-blue-100 text-blue-800" },
  { value: 3, label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: 4, label: "Resolved", color: "bg-green-100 text-green-800" },
  { value: 5, label: "Closed", color: "bg-gray-100 text-gray-800" },
];

export default function CreateTicketModal({
  isOpen,
  onClose,
  conversationId,
  customerName,
  customerEmail,
  existingTickets = [],
  onTicketCreated,
}: CreateTicketModalProps) {
  const [formData, setFormData] = useState<TicketFormData>({
    subject: "",
    description: "",
    priority: 2, // Medium
    status: 2, // Open
    type: FRESHDESK_TICKET_TYPES.GENERAL_INQUIRY,
    includeConversationHistory: true,
    tags: ["chat-escalation"],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);
  const [newTag, setNewTag] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/freshdesk/tickets/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          ...formData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create ticket");
      }

      setSuccess(result);
      onTicketCreated?.(result);

      // Reset form
      setFormData({
        subject: "",
        description: "",
        priority: 2,
        status: 2,
        type: FRESHDESK_TICKET_TYPES.GENERAL_INQUIRY,
        includeConversationHistory: true,
        tags: ["chat-escalation"],
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to create ticket"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[1000px] h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Freshdesk Ticket Management
          </DialogTitle>
          <DialogDescription>
            Create new tickets and view ticket history for this conversation.
            {customerName && ` Customer: ${customerName}`}
            {customerEmail && ` (${customerEmail})`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Left Side: Create Ticket Form */}
          <div className="flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Plus className="h-4 w-4" />
                  Create New Ticket
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 min-h-0">
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="border-green-200 bg-green-50 mb-4">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Ticket #{success.ticket.id} created successfully!
                    </AlertDescription>
                  </Alert>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* Subject */}
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          subject: e.target.value,
                        }))
                      }
                      placeholder="Brief description of the issue"
                      required
                      disabled={isLoading || !!success}
                    />
                  </div>

                  {/* Type */}
                  <div className="space-y-2">
                    <Label htmlFor="type">Ticket Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, type: value }))
                      }
                      disabled={isLoading || !!success}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ticket type" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {Object.entries(FRESHDESK_TICKET_TYPES).map(
                          ([key, value]) => (
                            <SelectItem key={key} value={value}>
                              <span className="text-sm">{value}</span>
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority and Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={formData.priority.toString()}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            priority: parseInt(value),
                          }))
                        }
                        disabled={isLoading || !!success}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value.toString()}
                            >
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={option.color}
                                  variant="secondary"
                                >
                                  {option.label}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status.toString()}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            status: parseInt(value),
                          }))
                        }
                        disabled={isLoading || !!success}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value.toString()}
                            >
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={option.color}
                                  variant="secondary"
                                >
                                  {option.label}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Additional Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Additional context or notes for the support team"
                      rows={3}
                      disabled={isLoading || !!success}
                    />
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="includeHistory"
                        checked={formData.includeConversationHistory}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            includeConversationHistory: e.target.checked,
                          }))
                        }
                        disabled={isLoading || !!success}
                      />
                      <Label
                        htmlFor="includeHistory"
                        className="text-sm text-gray-600"
                      >
                        Include conversation history in ticket description
                      </Label>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {tag}
                          {tag !== "chat-escalation" && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 text-gray-500 hover:text-gray-700"
                              disabled={isLoading || !!success}
                            >
                              ×
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add a tag"
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        disabled={isLoading || !!success}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddTag}
                        disabled={!newTag.trim() || isLoading || !!success}
                        className="sm:w-auto w-full"
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Create Button */}
                  <div className="pt-4 border-t">
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!formData.subject.trim() || isLoading}
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Ticket className="h-4 w-4 mr-2" />
                          Create Ticket
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side: Ticket History */}
          <div className="flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-4 w-4" />
                  Ticket History ({existingTickets.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 min-h-0">
                {existingTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Ticket className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-center">No tickets created yet</p>
                    <p className="text-sm text-center mt-1">
                      Create your first ticket using the form
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {existingTickets.map((ticket, index) => (
                      <Card key={ticket.id} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm line-clamp-2">
                              {ticket.subject}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">
                              Ticket #{ticket.id}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(ticket.url, "_blank")}
                            className="ml-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            className={
                              PRIORITY_OPTIONS.find(
                                (p) => p.value === ticket.priority
                              )?.color
                            }
                            variant="secondary"
                          >
                            {
                              PRIORITY_OPTIONS.find(
                                (p) => p.value === ticket.priority
                              )?.label
                            }
                          </Badge>
                          <Badge
                            className={
                              STATUS_OPTIONS.find(
                                (s) => s.value === ticket.status
                              )?.color
                            }
                            variant="secondary"
                          >
                            {
                              STATUS_OPTIONS.find(
                                (s) => s.value === ticket.status
                              )?.label
                            }
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {new Date(
                            ticket.createdAt
                          ).toLocaleDateString()} at{" "}
                          {new Date(ticket.createdAt).toLocaleTimeString()}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
