import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  createStaffAccount,
  removeStaffAccount,
  resetStaffPassword,
  updateStaffRole,
} from "@/lib/staff-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => ({
    meta: [
      { title: "Staff accounts — ClinicQueue admin" },
      { name: "description", content: "Add staff, change roles and reset passwords." },
      { property: "og:title", content: "Staff accounts — ClinicQueue admin" },
      { property: "og:description", content: "Manage who can run the clinic queue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffAccountsPage,
});

type Role = "admin" | "staff";
interface Member {
  id: string;
  full_name: string;
  email: string;
  role: Role | null;
}

function StaffAccountsPage() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [resetFor, setResetFor] = useState<Member | null>(null);

  const changeRole = useServerFn(updateStaffRole);
  const removeAccount = useServerFn(removeStaffAccount);

  const members = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const roleOf = new Map<string, Role>();
      for (const r of roles ?? []) {
        if (r.role === "admin" || !roleOf.has(r.user_id)) roleOf.set(r.user_id, r.role);
      }
      return (profiles ?? []).map((p) => ({ ...p, role: roleOf.get(p.id) ?? null })) as Member[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff-members"] });

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => changeRole({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeAccount({ data: { userId } }),
    onSuccess: () => {
      toast.success("Account removed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Staff accounts</h1>
          <p className="text-sm text-muted-foreground">
            Staff can run the queue. Admins can also manage doctors and accounts.
          </p>
        </div>
        <Button variant="hero" onClick={() => setAddOpen(true)}>
          <Plus /> Add staff
        </Button>
      </div>

      {members.isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin" /></div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card shadow-soft">
          {members.data?.map((m) => {
            const isMe = m.id === user.id;
            return (
              <li key={m.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                    <UserRound className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {m.full_name || "Unnamed"} {isMe && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={m.role ?? ""}
                    disabled={isMe || roleMutation.isPending}
                    onValueChange={(v) => roleMutation.mutate({ userId: m.id, role: v as Role })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="No access" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => setResetFor(m)} aria-label="Reset password">
                    <KeyRound />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    disabled={isMe || removeMutation.isPending}
                    onClick={() => {
                      if (confirm(`Remove ${m.email}? They will no longer be able to sign in.`)) removeMutation.mutate(m.id);
                    }}
                    aria-label="Remove account"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AddStaffDialog open={addOpen} onOpenChange={setAddOpen} onDone={refresh} />
      <ResetPasswordDialog member={resetFor} onClose={() => setResetFor(null)} />
    </div>
  );
}

function AddStaffDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const create = useServerFn(createStaffAccount);
  const [role, setRole] = useState<Role>("staff");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await create({
        data: {
          fullName: String(fd.get("fullName") ?? ""),
          email: String(fd.get("email") ?? ""),
          password,
          role,
        },
      });
      toast.success("Account created. Share the email and password with them.");
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add a staff account</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-name">Name</Label>
              <Input id="s-name" name="fullName" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Email</Label>
              <Input id="s-email" name="email" type="email" required maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-pass">Temporary password</Label>
              <Input id="s-pass" name="password" type="text" required minLength={8} maxLength={72} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff — runs the queue</SelectItem>
                  <SelectItem value="admin">Admin — full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const reset = useServerFn(resetStaffPassword);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!member) return;
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await reset({ data: { userId: member.id, password } });
      toast.success("Password updated");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!member} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-3xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <p className="mt-2 text-sm text-muted-foreground">Set a new password for {member?.email}.</p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="r-pass">New password</Label>
            <Input id="r-pass" name="password" type="text" required minLength={8} maxLength={72} autoComplete="off" />
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
