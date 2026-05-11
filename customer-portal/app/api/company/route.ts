import { NextResponse } from "next/server";
import { requireValidSession } from "@/lib/auth";
import { resolveCustomerContact } from "@/lib/customer";

export async function GET() {
  const session = await requireValidSession();
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const contact = await resolveCustomerContact(session.token, session.user);
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
