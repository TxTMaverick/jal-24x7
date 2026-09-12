"use client";

/** Screen 11. Admin dashboard. Designed, not yet built -- see ComingSoon. */

import { ComingSoon } from "@/components/ComingSoon";
import { Chart } from "@/components/icons";

export default function AdminPage() {
  return (
    <ComingSoon
      eyebrow="For the platform team"
      title="Admin Dashboard"
      icon={<Chart className="size-8" />}
      problem={
        "The platform's promise is that every listed supplier has been checked. That " +
        "promise needs somebody to do the checking, and somewhere to record it. " +
        "Without it, anyone could list themselves as a verified operator and a " +
        "customer would have no way to tell the difference. Disputes have the same " +
        "problem: with no central view of orders, there is no audit trail to settle " +
        "what actually happened."
      }
      willDo={[
        "Review KYC applications from new suppliers and approve or reject them, with the decision recorded against the operator",
        "Give oversight of every order on the platform, so a disputed delivery can be traced end to end",
        "Track demand by area and by product, so under-served zones can be spotted and suppliers recruited there",
        "Monitor supplier quality: ratings, cancellations and delivery times, so a consistently poor operator can be delisted",
        "Maintain the government water department directory used by the helplines page",
      ]}
    />
  );
}
