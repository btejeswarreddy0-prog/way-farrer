# Wayfarer manual QA checklist

**Live status: not yet run against the configured Supabase project.** Mark each item only after testing it with separate signed-in accounts.

Use at least two separate confirmed renter accounts and one lister account. Keep them in separate browser profiles so both sessions stay signed in. Use fake listing information and no payment details.

## Authentication

- [ ] Register a renter with a valid email and confirm it.
- [ ] Register a lister with another email and confirm it.
- [ ] Sign out and sign in as each role; verify each reaches the correct dashboard.
- [ ] From sign-in, request a password reset; open the email link, set a new password, and sign in with it.
- [ ] Try opening the other role's dashboard while signed in; verify the app routes to the signed-in role.

## Listings and photos

- [ ] As the lister, publish a vehicle with a JPG/PNG/WebP/AVIF image under 5 MB.
- [ ] Verify the photo displays to the renter and the listing owner.
- [ ] As a renter, try uploading a photo through the Storage API or a temporary test UI; confirm Supabase denies it. Confirm a lister cannot upload into another user's folder.
- [ ] Edit the listing, replace its photo, and verify the saved result.
- [ ] Try an unsupported or oversized image and verify it is rejected with a clear message.
- [ ] Delete a test listing and verify it disappears from the renter search.

## Requests and date safety

- [ ] As the renter, find the lister's vehicle, choose valid dates and pickup details, and send a request.
- [ ] Verify the renter sees the request under Sent requests and the lister sees it under Received requests.
- [ ] As the lister, decline a test request and verify its status for both roles.
- [ ] Send another request and accept it; verify it appears as a trip and exposes the Chat link to the renter.
- [ ] Send two requests for the same vehicle with overlapping dates. Accept one, then try to accept the other. The second accept must be rejected with a clear message.
- [ ] Test a boundary overlap where the second pickup equals the first return date; it must also be rejected because return days count as occupied.
- [ ] Repeat with non-overlapping dates and verify both can be accepted.

## Messaging

- [ ] Click Chat on the accepted request in the renter's Sent requests and verify the correct thread opens.
- [ ] Send a message as the renter; verify it appears in the lister's Messages inbox.
- [ ] Reply as the lister; verify the renter sees the reply without reloading the whole page.
- [ ] Sign in as the second renter and verify they cannot see the first renter's request or message thread.
- [ ] Verify a non-participant cannot read or send messages for the accepted request, and the sender identity cannot be spoofed.
- [ ] Search the inbox and switch between two accepted rental threads if available.
- [ ] Try opening a pending or declined request as a chat; no conversation should be available.

## Access control

- [ ] Create two renter accounts and requests to separate listers. Verify each renter sees only their own requests.
- [ ] Verify a renter cannot read another renter's messages, and a non-participant cannot read either side's thread.
- [ ] Verify only participants can send messages and only after the relevant request is accepted.
- [ ] Verify a lister can see only requests for their own vehicles.
- [ ] Verify a renter cannot create, edit, or delete vehicle listings, and cannot decide a rental request.

## Location search clarity

- [ ] Search an exact listed city and confirm the result summary names the matched listing city.
- [ ] Search a supported spelling alias or nearby city and confirm the summary names the actual listing city returned.
- [ ] Search a city with no listings and confirm the page explains that no vehicles were found and suggests a nearby city/district or changing the vehicle type.
- [ ] Confirm location matching is presented as approximate text matching, not a distance estimate.

## Record results

For each failed check, record the page, account role, action, exact error text, and whether the matching SQL setup file was run. Never record passwords or confirmation links.
