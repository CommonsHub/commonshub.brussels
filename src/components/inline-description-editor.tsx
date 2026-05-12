"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";

interface InlineDescriptionEditorProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

export function InlineDescriptionEditor({
  value,
  onSave,
  placeholder = "add note",
  className = "",
}: InlineDescriptionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update display value when prop changes
  useEffect(() => {
    setDisplayValue(value);
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === displayValue) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      // Update display value to show the new value immediately
      setDisplayValue(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving description:", error);
      alert("Failed to save description");
      setEditValue(displayValue); // Revert on error
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className={`flex items-center gap-1 group hover:text-foreground ${
          displayValue
            ? "text-foreground"
            : "text-xs italic text-muted-foreground"
        } ${className}`}
        disabled={isSaving}
      >
        {displayValue || placeholder}
        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={isSaving}
      placeholder={placeholder}
      className={`border-b border-muted-foreground focus:border-foreground outline-none bg-transparent ${className}`}
    />
  );
}
