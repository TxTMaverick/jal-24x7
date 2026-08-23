"use client";

import { TankerBooking } from "@/components/TankerBooking";

export default function IndividualTankerPage() {
  return (
    <TankerBooking
      segment="individual"
      copy={{
        eyebrow: "For homes and individuals",
        title: "Home Tanker Booking",
        subtitle:
          "A single tanker trip for your house, garden, construction top-up or a small function. Pick a capacity, choose a slot, and the nearest verified operator takes it.",
        pricingNote:
          "The trip rate covers delivery within 8 km. Beyond that a distance surcharge of Rs 12 per km is added at checkout as its own line, plus 18 percent GST.",
        checklist: [
          "Pay per trip, not per litre",
          "Driver name and vehicle number shared before arrival",
          "Live map tracking once the trip starts",
          "Cancel free until the vehicle leaves the depot",
        ],
      }}
    />
  );
}
