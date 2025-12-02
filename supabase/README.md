This repo includes RLS policies in the migrations folder. I updated the
policy controlling `INSERT` on `public.report_updates` so that any user with
the `petugas` role can insert a report update for reports that are either
unassigned (organization-level) or assigned to a `petugas` account. The
insert still requires `petugas_id = auth.uid()` so each update records which
individual petugas performed the action.

If you already have a deployed Supabase DB, the migration file in
`supabase/migrations/20251201183731_361d42eb-0b89-4899-be5d-aab099f7ff08.sql`
was updated — you can apply the migration via your usual migration workflow
or run the SQL (safe approach) in the Supabase SQL editor to replace the
existing policy:

```sql
-- Replace the existing policy for report_updates INSERT
DROP POLICY IF EXISTS "Petugas can create updates for their reports" ON public.report_updates;

CREATE POLICY "Petugas can create updates for reports assigned to Dishub (org-level)"
  ON public.report_updates FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'petugas') AND
    petugas_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id AND (
        r.assigned_to IS NULL OR public.has_role(r.assigned_to, 'petugas')
      )
    )
  );
```

After applying the policy change you should test these cases (run from the
app or using SQL):

- A petugas (auth.uid()) creates an update for an unassigned report — should work and record petugas_id.
- A petugas creates an update for a report assigned to a petugas account — should work and record petugas_id.
- A petugas attempts to insert an update for a report assigned to a non-petugas account — should be denied by RLS.

If you'd like, I can also add a small integration test harness to exercise
these cases against a test Supabase instance.
