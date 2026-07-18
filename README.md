# ClinicFlow

React + TypeScript + Tailwind + **Supabase** (no separate backend).

## Setup

1. Create a Supabase project.
2. Run SQL migrations in order in the SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_storage_attachments.sql`
   - `supabase/migrations/003_admin_and_logos.sql`
3. Copy `client/.env.example` → `client/.env` and fill:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Also run `004_staff_invites.sql` (includes `link_staff_user` for manager-created staff).

**Secretary:** From Settings, the clinic manager creates the secretary account (email + password). The secretary logs in and lands on `/desk` for bookings.

4. (Optional) Create a super admin: sign up the user in Auth, then:

```sql
insert into public.users (id, tenant_id, full_name, email, role)
values ('AUTH_USER_UUID', null, 'Platform Admin', 'admin@example.com', 'super_admin');
```

5. Start the app:

```bash
cd client
npm install
npm run dev
```

## Week 1–4 MVP surface

- Schema + RLS + storage + `onboard_clinic` RPC
- Auth, onboarding, settings, permissions
- Patients, visits, attachments, Excel import
- Appointments, waiting room, consultation + Rx print
- Invoices, cash register, lab/radiology templates
- Reports (patients / revenue / doctor / diseases)
- Dashboard KPIs + i18n AR/EN
