import { fleetbaseApi } from "./api-client";

interface Contact {
  id: string;
  uuid: string;
  public_id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  user_uuid: string;
}

interface ContactsResponse {
  [key: string]: Contact[];
}

/**
 * Resolves the customer Contact associated with the authenticated user.
 * After login, the session contains the User UUID. This function queries
 * the contacts endpoint to find the Contact with type=customer linked to that user.
 */
export async function resolveCustomerContact(
  token: string,
  userUuid: string
): Promise<Contact | null> {
  const result = await fleetbaseApi<ContactsResponse>("contacts", {
    token,
    params: {
      type: "customer",
      user_uuid: userUuid,
      limit: "1",
    },
  });

  if (!result.ok) return null;

  // fleetbaseRoutes returns data as { contacts: [...] } or similar
  const contacts =
    result.data?.contacts || Object.values(result.data || {})[0];
  if (Array.isArray(contacts) && contacts.length > 0) {
    return contacts[0];
  }

  return null;
}
