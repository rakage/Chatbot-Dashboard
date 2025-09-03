"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Tag,
  FileText,
  Save,
  X,
  Plus,
  ExternalLink,
  Clock,
} from "lucide-react";

type ContactField = "email" | "phone" | "address";

interface CustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  profilePicture?: string;
  locale: string;
  facebookUrl: string;
  cached?: boolean;
  error?: string;
}

interface CustomerInfoSidebarProps {
  conversationId: string;
  customerProfile?: CustomerProfile | null;
  isOpen: boolean;
  onClose: () => void;
  notes?: string;
  tags?: string[];
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  onNotesUpdate?: (notes: string) => void;
  onTagsUpdate?: (tags: string[]) => void;
  onContactUpdate?: (field: ContactField, value: string) => void;
}

export default function CustomerInfoSidebar({
  conversationId,
  customerProfile,
  isOpen,
  onClose,
  notes = "",
  tags = [],
  customerEmail = null,
  customerPhone = null,
  customerAddress = null,
  onNotesUpdate,
  onTagsUpdate,
  onContactUpdate,
}: CustomerInfoSidebarProps) {
  const [currentNotes, setCurrentNotes] = useState(notes);
  const [currentTags, setCurrentTags] = useState<string[]>(tags);
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Contact info state
  const [currentEmail, setCurrentEmail] = useState(customerEmail || "");
  const [currentPhone, setCurrentPhone] = useState(customerPhone || "");
  const [currentAddress, setCurrentAddress] = useState(customerAddress || "");
  const [editingField, setEditingField] = useState<ContactField | null>(null);
  const [contactSaving, setContactSaving] = useState<ContactField | null>(null);

  // Update local state when props change
  useEffect(() => {
    setCurrentNotes(notes);
  }, [notes]);

  useEffect(() => {
    setCurrentTags(tags);
  }, [tags]);

  useEffect(() => {
    setCurrentEmail(customerEmail || "");
  }, [customerEmail]);

  useEffect(() => {
    setCurrentPhone(customerPhone || "");
  }, [customerPhone]);

  useEffect(() => {
    setCurrentAddress(customerAddress || "");
  }, [customerAddress]);

  const handleSaveNotes = async () => {
    if (!conversationId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: currentNotes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save notes");
      }

      setLastSaved(new Date());
      onNotesUpdate?.(currentNotes);
    } catch (error) {
      console.error("Failed to save notes:", error);
      // Could add toast notification here
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTags = async (updatedTags: string[]) => {
    if (!conversationId) return;

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tags: updatedTags,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save tags");
      }

      onTagsUpdate?.(updatedTags);
    } catch (error) {
      console.error("Failed to save tags:", error);
    }
  };

  const handleAddTag = () => {
    if (!newTag.trim() || currentTags.includes(newTag.trim())) return;

    const updatedTags = [...currentTags, newTag.trim()];
    setCurrentTags(updatedTags);
    setNewTag("");
    handleSaveTags(updatedTags);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = currentTags.filter((tag) => tag !== tagToRemove);
    setCurrentTags(updatedTags);
    handleSaveTags(updatedTags);
  };

  const handleSaveContact = async (field: ContactField, value: string) => {
    if (!conversationId) return;

    setContactSaving(field);
    try {
      const updateData: any = {};

      if (field === "email") {
        // Basic email validation
        if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          throw new Error("Invalid email format");
        }
        updateData.customerEmail = value.trim();
      } else if (field === "phone") {
        updateData.customerPhone = value.trim();
      } else if (field === "address") {
        updateData.customerAddress = value.trim();
      }

      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save contact info");
      }

      onContactUpdate?.(field, value.trim());
      setEditingField(null);
      setLastSaved(new Date());
    } catch (error) {
      console.error(`Failed to save ${field}:`, error);
      alert(
        `Failed to save ${field}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setContactSaving(null);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCurrentValue = (field: ContactField): string => {
    if (field === "email") return currentEmail;
    if (field === "phone") return currentPhone;
    return currentAddress;
  };

  const setCurrentValue = (field: ContactField, value: string) => {
    if (field === "email") setCurrentEmail(value);
    if (field === "phone") setCurrentPhone(value);
    if (field === "address") setCurrentAddress(value);
  };

  const renderContactField = (
    field: ContactField,
    Icon: any,
    value: string,
    placeholder: string,
    type: string = "text"
  ) => {
    const isEditing = editingField === field;
    const isSaving = contactSaving === field;
    const currentValue = getCurrentValue(field);

    const handleEdit = () => {
      setEditingField(field);
    };

    const handleSave = () => {
      handleSaveContact(field, currentValue);
    };

    const handleCancel = () => {
      if (field === "email") setCurrentEmail(customerEmail || "");
      if (field === "phone") setCurrentPhone(customerPhone || "");
      if (field === "address") setCurrentAddress(customerAddress || "");
      setEditingField(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    };

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentValue(field, e.target.value);
    };

    const handleSpanClick = () => {
      handleEdit();
    };

    const handleSpanKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleEdit();
      }
    };

    return (
      <div key={field} className="flex items-center gap-2 group">
        <Icon className="h-4 w-4 flex-shrink-0 text-gray-500" />
        {isEditing ? (
          <div className="flex-1 flex gap-2">
            <Input
              type={type}
              value={currentValue}
              onChange={handleValueChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="text-sm h-8"
              autoFocus
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSave}
                disabled={isSaving}
                className="h-8 w-8 p-0"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-between">
            <button
              className={`text-sm ${
                value ? "text-gray-900" : "text-gray-500"
              } cursor-pointer hover:text-blue-600 transition-colors text-left bg-transparent border-none p-0 font-inherit`}
              onClick={handleSpanClick}
              onKeyDown={handleSpanKeyDown}
              type="button"
            >
              {value || `No ${placeholder.toLowerCase()} provided`}
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleEdit}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <FileText className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-200 shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Customer Info</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Customer Profile */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customerProfile ? (
                <>
                  <div className="flex items-center space-x-3">
                    {customerProfile.profilePicture ? (
                      <img
                        src={customerProfile.profilePicture}
                        alt={customerProfile.fullName}
                        className="w-12 h-12 rounded-full border-2 border-blue-500"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center border-2 border-blue-500">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {customerProfile.fullName}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Facebook Profile
                      </span>
                      <a
                        href={customerProfile.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    {customerProfile.error && (
                      <Badge variant="destructive" className="text-xs">
                        Profile fetch failed
                      </Badge>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <User className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    No profile data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Existing Tags */}
              {currentTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add New Tag */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  className="text-sm"
                />
                <Button
                  onClick={handleAddTag}
                  size="sm"
                  disabled={!newTag.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Add notes about this customer..."
                value={currentNotes}
                onChange={(e) => setCurrentNotes(e.target.value)}
                rows={6}
                className="text-sm resize-none"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {lastSaved && (
                    <>
                      <Clock className="h-3 w-3" />
                      <span>Saved at {formatTime(lastSaved)}</span>
                    </>
                  )}
                </div>

                <Button
                  onClick={handleSaveNotes}
                  size="sm"
                  disabled={isSaving || currentNotes === notes}
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {renderContactField(
                  "email",
                  Mail,
                  currentEmail,
                  "Email",
                  "email"
                )}
                {renderContactField(
                  "phone",
                  Phone,
                  currentPhone,
                  "Phone",
                  "tel"
                )}
                {renderContactField(
                  "address",
                  MapPin,
                  currentAddress,
                  "Address"
                )}
                <p className="text-xs text-gray-500 mt-3 pt-3 border-t">
                  Click on any field to edit. Press Enter to save or Escape to
                  cancel.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
