# Security Specification for BTS eSports

## 1. Data Invariants
- A user can only create/update their own profile.
- An application must have a valid UID matching the requester.
- Applications status can only be modified by admins (if we had admin roles, for now we restrict to owner read).
- Timestamps must be server-generated.

## 2. The "Dirty Dozen" Payloads
1. Attempt to create a user profile for another UID.
2. Attempt to update another user's profile.
3. Attempt to create an application with a different UID.
4. Attempt to update the `status` of an application (user should not be able to).
5. Attempt to update `createdAt` in an application.
6. Attempt to inject a 2MB string into `ign`.
7. Attempt to read all applications (blanket read).
8. Attempt to delete another user's profile.
9. Attempt to spoof `email_verified` (rules check request.auth.token).
10. Attempt to write to a random collection.
11. Attempt to set `kd` as a boolean.
12. Attempt to inject a ghost field `isAdmin: true` into a user profile.

## 3. Rules Implementation Strategy
- Global deny-all.
- `isValidUser` and `isValidApplication` helpers.
- `affectedKeys` check for updates.
- Server timestamp enforcement.
