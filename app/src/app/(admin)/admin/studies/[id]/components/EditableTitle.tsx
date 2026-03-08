"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Pencil } from "lucide-react";

export function EditableTitle({
  studyId,
  title,
}: {
  studyId: string;
  title: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setValue(title);
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/studies/${studyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to rename", "error");
        setValue(title);
      } else {
        toast("Study renamed", "success");
        router.refresh();
      }
    } catch {
      toast("Network error", "error");
      setValue(title);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(title);
            setEditing(false);
          }
        }}
        disabled={saving}
        className="text-2xl font-bold text-foreground bg-transparent border-b-2 border-primary outline-none w-full py-0.5"
        maxLength={255}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2 text-left"
      title="Click to rename"
    >
      <h1>{title}</h1>
      <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
