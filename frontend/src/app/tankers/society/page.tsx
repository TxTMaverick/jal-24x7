"use client";

import { TankerBooking } from "@/components/TankerBooking";

export default function SocietyTankerPage() {
  return (
    <TankerBooking
      segment="society"
      copy={{
        eyebrow: "For societies and institutions",
        title: "Society Tanker Booking",
        subtitle:
          "Bulk trips for housing societies, schools, hostels and offices, priced on the contract rate rather than the individual spot rate. Book one trip or set up a recurring schedule.",
        pricingNote:
          "Society bookings apply an 8 percent contract discount automatically. Distance surcharge beyond 8 km and 18 percent GST are added at checkout.",
        checklist: [
          "8 percent below the individual spot rate",
          "Up to 12,000 litres in a single trip",
          "Cost split per flat shown up front",
          "Recurring monthly contracts available",
        ],
      }}
    />
  );
}
