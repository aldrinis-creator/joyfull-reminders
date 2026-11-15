# Pantry saving: check only

Short answer: the pantry setup is mostly done already. The security fix you just approved added what was missing. The pantry list already existed in the database. It just had no permission for signed-in people to use it, and no rule that allowed adding items. Both are in place now.

## What's left
1. Sign in as you and add one test item on the Pantry screen (for example "Rice", 1 bag, refill every 30 days).
2. Reload the page and check the item is still there.
3. Delete the test item so your pantry stays clean.
4. If saving fails, fix whatever actually stops it and test again.

## Technical details
- pantry_items already has row level security on, owner-only select/insert/update/delete policies, and grants to authenticated and service_role.
- The Pantry insert already sends user_id from the signed-in user, so it matches the insert rule.
- No new database changes are expected. One would only be added if the test shows a real problem.
