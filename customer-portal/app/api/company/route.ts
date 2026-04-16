import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { fleetbaseSession } from "@/lib/api-client";
import { resolveCustomerContact } from "@/lib/customer";

export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await fleetbaseSession(token);
  if (!session.ok) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const contact = await resolveCustomerContact(token, session.data.user);
  if (!contact) {
    return NextResponse.json(
      { error: "Customer profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    customer: {
      name: contact.name || null,
      public_id: contact.public_id || null,
      phone: contact.phone || null,
      email: contact.email || null,
    },
  });
}
