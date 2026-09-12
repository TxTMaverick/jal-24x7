"use client";

/** Screen 12. Vendor panel. Designed, not yet built -- see ComingSoon. */

import { ComingSoon } from "@/components/ComingSoon";
import { Truck } from "@/components/icons";

export default function VendorPage() {
  return (
    <ComingSoon
      eyebrow="For suppliers"
      title="Vendor Panel"
      icon={<Truck className="size-8" />}
      problem={
        "A supplier today runs the whole job from a phone. Orders arrive as calls with " +
        "nothing written down, there is no record of what was agreed, and a customer " +
        "asking where their water is can only be answered by ringing the driver. " +
        "Suppliers also cannot see demand building up, so they cannot plan a route or " +
        "add a vehicle before the day gets away from them."
      }
      willDo={[
        "Show every order the matching engine assigns to this supplier, with the address and delivery window",
        "Let the supplier accept a job and move it through confirmed, dispatched and delivered, which updates the customer's live tracking",
        "Manage the roster: which drivers and vehicles are on shift, and how many deliveries can be taken per slot",
        "Keep the public listing current, including rates, service area, capacity range and water source",
        "Report completed trips and earnings over a chosen period",
      ]}
    />
  );
}
