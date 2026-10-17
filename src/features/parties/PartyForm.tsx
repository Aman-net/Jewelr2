import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Field, Input, Textarea } from "../../components/ui/Field.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { createParty } from "../../data/index.ts";
import { en } from "../../i18n/en.ts";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  mobile: z.string().trim().max(20),
  address: z.string().trim().max(500),
  notes: z.string().trim().max(2000),
  isCustomer: z.boolean(),
  isSupplier: z.boolean(),
}).refine((v) => v.isCustomer || v.isSupplier, { message: "Pick Customer or Supplier (or both)" });

type Form = z.infer<typeof schema>;

export function PartyForm({ onDone }: { onDone: (id: string, duplicateName: boolean) => void }) {
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", mobile: "", address: "", notes: "", isCustomer: true, isSupplier: false },
  });
  const isCustomer = watch("isCustomer");
  const isSupplier = watch("isSupplier");
  const namePreview = watch("name");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={handleSubmit(async (v) => {
        setServerError("");
        try {
          const { party, duplicateName } = await createParty({
            name: v.name.trim(),
            mobile: v.mobile.trim() || undefined,
            address: v.address.trim() || undefined,
            notes: v.notes.trim() || undefined,
            isCustomer: v.isCustomer,
            isSupplier: v.isSupplier,
          });
          onDone(party.id, duplicateName);
        } catch (e) {
          setServerError(e instanceof Error ? e.message : "Could not save party");
        }
      })}
    >
      <Card>
        <div className="flex items-center gap-3">
          <PartyAvatar name={namePreview.trim() || "?"} size="lg" />
          <div className="min-w-0 flex-1">
            <Field label={en.party.name} error={errors.name?.message}>
              <Input {...register("name")} placeholder="e.g. Sharma Bullion" autoFocus className="py-3 text-lg font-semibold" />
            </Field>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <Field label={en.party.mobile}>
            <Input {...register("mobile")} inputMode="tel" placeholder="Optional" />
          </Field>
          <Field label="Party type">
            <Segmented
              options={["customer", "supplier", "both"] as const}
              value={isCustomer && isSupplier ? "both" : isCustomer ? "customer" : "supplier"}
              onChange={(v) => {
                setValue("isCustomer", v === "customer" || v === "both", { shouldValidate: true });
                setValue("isSupplier", v === "supplier" || v === "both", { shouldValidate: true });
              }}
              labels={{ customer: en.party.customer, supplier: en.party.supplier, both: "Both" }}
            />
          </Field>
          <Field label={en.party.address}>
            <Textarea {...register("address")} rows={2} placeholder="Optional" />
          </Field>
          <Field label={en.party.notes}>
            <Textarea {...register("notes")} rows={2} placeholder="Optional" />
          </Field>
          {errors.root?.message || errors.isCustomer?.message ? (
            <p className="text-xs font-medium text-red-700">{errors.root?.message ?? errors.isCustomer?.message}</p>
          ) : null}
          {serverError ? <p className="text-xs font-medium text-red-700">{serverError}</p> : null}
        </div>
      </Card>
      <div className="flex gap-2">
        <Link to="/parties" className="flex-1"><Button variant="secondary" full type="button">{en.common.cancel}</Button></Link>
        <div className="flex-1"><Button full type="submit" disabled={isSubmitting}>{en.common.save}</Button></div>
      </div>
    </form>
  );
}

export function PartyNewPage({ onDone }: { onDone: (id: string, dup: boolean) => void }) {
  return (
    <Page title={en.party.add} backTo="/parties" backLabel="Parties">
      <PartyForm onDone={onDone} />
    </Page>
  );
}
