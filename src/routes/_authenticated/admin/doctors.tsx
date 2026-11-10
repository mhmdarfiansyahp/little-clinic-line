import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/doctors")({
  head: () => ({
    meta: [
      { title: "Doctors — ClinicQueue admin" },
      { name: "description", content: "Add and manage the clinic's doctors." },
      { property: "og:title", content: "Doctors — ClinicQueue admin" },
      { property: "og:description", content: "Manage doctors patients can choose from." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DoctorsPage,
});

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  room: string;
  is_active: boolean;
}

const doctorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  specialty: z.string().trim().max(100),
  room: z.string().trim().max(20),
});

function DoctorsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [open, setOpen] = useState(false);

  const doctors = useQuery({
    queryKey: ["admin-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, specialty, room, is_active")
        .order("is_active", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as Doctor[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-doctors"] });
    qc.invalidateQueries({ queryKey: ["staff-doctors"] });
  };

  const toggle = useMutation({
    mutationFn: async (d: Doctor) => {
      const { error } = await supabase.from("doctors").update({ is_active: !d.is_active }).eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (d: Doctor) => {
      const { error } = await supabase.from("doctors").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Doctor removed");
      invalidate();
    },
    onError: () =>
      toast.error("This doctor has patient history, so they can't be deleted. Turn them off instead."),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Doctors</h1>
          <p className="text-sm text-muted-foreground">Patients can only choose doctors that are switched on.</p>
        </div>
        <Button
          variant="hero"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus /> Add doctor
        </Button>
      </div>

      {doctors.isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin" /></div>
      ) : !doctors.data?.length ? (
        <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
          <Stethoscope className="mx-auto size-8 text-primary" />
          <p className="mt-3 font-semibold">No doctors yet</p>
          <p className="text-sm text-muted-foreground">Add your first doctor to open the queue.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.data.map((d) => (
            <div key={d.id} className="flex flex-col rounded-3xl border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold">{d.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[d.specialty, d.room && `Room ${d.room}`].filter(Boolean).join(" · ") || "General"}
                  </p>
                </div>
                <Switch
                  checked={d.is_active}
                  onCheckedChange={() => toggle.mutate(d)}
                  aria-label={d.is_active ? "Turn off" : "Turn on"}
                />
              </div>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {d.is_active ? "Accepting patients" : "Off — hidden from patients"}
              </p>
              <div className="mt-4 flex gap-2 border-t pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(d);
                    setOpen(true);
                  }}
                >
                  <Pencil /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(`Delete ${d.name}?`)) remove.mutate(d);
                  }}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DoctorDialog open={open} onOpenChange={setOpen} doctor={editing} onSaved={invalidate} />
    </div>
  );
}

function DoctorDialog({
  open,
  onOpenChange,
  doctor,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doctor: Doctor | null;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = doctorSchema.safeParse({
      name: fd.get("name"),
      specialty: fd.get("specialty") ?? "",
      room: fd.get("room") ?? "",
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = doctor
      ? await supabase.from("doctors").update(parsed.data).eq("id", doctor.id)
      : await supabase.from("doctors").insert(parsed.data);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(doctor ? "Doctor updated" : "Doctor added");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <form onSubmit={onSubmit} key={doctor?.id ?? "new"}>
          <DialogHeader>
            <DialogTitle>{doctor ? "Edit doctor" : "Add a doctor"}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="d-name">Name</Label>
              <Input id="d-name" name="name" required maxLength={100} defaultValue={doctor?.name} placeholder="Dr. Anong Srisuk" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-spec">Specialty</Label>
              <Input id="d-spec" name="specialty" maxLength={100} defaultValue={doctor?.specialty} placeholder="General practice" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-room">Room</Label>
              <Input id="d-room" name="room" maxLength={20} defaultValue={doctor?.room} placeholder="2" />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
