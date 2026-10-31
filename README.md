# Wayfarer — Vehicle Rental Marketplace

Wayfarer is a vehicle rental marketplace MVP that connects vehicle owners with people looking to rent. Renters can browse listings, send date-based rental requests, and message a lister after a request is accepted. Listers can publish vehicles, review requests, and manage confirmed trips.

> **Project status:** Portfolio MVP. Authentication, database policies, storage, and messaging depend on the connected Supabase project. The live two-account security walkthrough is still pending; see [QA-CHECKLIST.md](QA-CHECKLIST.md).

## Features

### Renters

- Search active vehicle listings by city, district, and vehicle type.
- See which listing cities matched an approximate location search.
- Request a vehicle with pick-up and return dates, pick-up place, destination, and a message.
- Track sent requests and remove unaccepted requests.
- Access a private conversation after the lister accepts a request.

### Listers

- Create, edit, and delete vehicle listings.
- Upload a vehicle photo from a device.
- Review incoming requests and accept or decline them.
- View accepted trips and chat with the renter.
- Prevent accepted date ranges from overlapping for the same vehicle.

## Technology

- HTML, CSS, and vanilla JavaScript
- Supabase Auth for account registration and sign-in
- Supabase Postgres with Row Level Security for listings, rental requests, and messages
- Supabase Storage for vehicle photos
- Vercel for static hosting

## Run locally

1. Open this folder in Visual Studio Code.
2. Start the Live Server extension, or run `python -m http.server 5500` from this folder.
3. Visit `http://localhost:5500/index.html`.

Open the app through a local HTTP server. Direct `file://` pages cannot use the normal Supabase Auth redirect flow.

## Supabase setup

Run the following files in the Supabase SQL Editor, in order:

1. [`supabase-setup.sql`](supabase-setup.sql) — profiles and the profile trigger for new accounts.
2. [`supabase-rentals-setup.sql`](supabase-rentals-setup.sql) — listings, rental requests, private messages, RLS policies, and overlap prevention.
3. [`supabase-vehicle-images-setup.sql`](supabase-vehicle-images-setup.sql) — public vehicle-photo bucket with lister-only upload, update, and delete policies.

Then, in Supabase **Authentication → URL Configuration**:

- Set the Site URL to your deployed site URL.
- Add the production `login.html` and `reset-password.html` URLs to the Redirect URLs allowlist.
- Keep your local development redirect, such as `http://localhost:5500/**`, in the allowlist while developing.

The frontend uses the Supabase project URL and publishable key in [`supabase-client.js`](supabase-client.js). A publishable key is intended for browser use; never put a Supabase secret or `service_role` key in this project.

For an existing Supabase project, rerun the rentals and image setup SQL after policy changes so the deployed project receives the latest lister role checks. The policy scripts can be reviewed with [`supabase-access-control-audit.sql`](supabase-access-control-audit.sql).

## Demo listings

1. Register and confirm a lister account.
2. In [`supabase-demo-vehicles.sql`](supabase-demo-vehicles.sql), replace `REPLACE-WITH-LISTER-EMAIL` with that account's email.
3. Run the script in Supabase SQL Editor. It creates sample listings in Visakhapatnam.
4. Register a separate renter account to browse the listings and try the request flow.

Use separate browser profiles for the renter and lister accounts so both stay signed in during the demo.

## Verification

- Use [`QA-CHECKLIST.md`](QA-CHECKLIST.md) for the renter/lister journey, photo upload, messaging, and access-control checks.
- Use [`supabase-booking-overlap-test.sql`](supabase-booking-overlap-test.sql) to test the overlap guard in a rollback-only transaction. Replace the two test account emails first.
- Use [`supabase-booking-overlap-audit.sql`](supabase-booking-overlap-audit.sql) to inspect accepted date overlaps that may have existed before the trigger was installed.
- Use [`supabase-access-control-audit.sql`](supabase-access-control-audit.sql) to inspect deployed RLS policies, the booking trigger, and the image bucket.

The SQL Editor runs with elevated database permissions. SQL checks confirm database setup, but they do not replace the separate-account RLS checks in the manual checklist.

## Scope and known limitations

- Location search is approximate text matching against a curated India city/district list. It can include manually configured nearby cities and common spelling variants; it does not use GPS, geocoding, or distance/radius calculations.
- Vehicle photos are public so renters can view listings. Do not upload private images or identity documents.
- Replacing or deleting a listing can leave an unused image object in Supabase Storage; clean up unused demo photos from the Storage dashboard.
- There is no payment provider or payment flow. The payments table does not mean payments are processed.
- Phone numbers, vehicle ownership, and listing details are not independently verified.
- The Privacy and Terms pages are demo notices, not launch-ready legal policies.
- The live renter/lister isolation and messaging walkthrough has not yet been recorded as passing. Track actual results in [`QA-CHECKLIST.md`](QA-CHECKLIST.md).

## Contact

Project support: [support.wayfarrer@gmail.com](mailto:support.wayfarrer@gmail.com)
