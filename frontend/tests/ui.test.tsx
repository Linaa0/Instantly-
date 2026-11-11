import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { getInitials, getUrgencyMeta, formatRelativeTime } from "@/lib/utils";
import {
  UrgencyBadge,
  PlatformBadge,
  DemoBadge,
  ReviewRequiredBadge,
} from "@/components/ui-badges";

describe("Instantly Design System & Utility Helpers", () => {
  it("computes initials accurately for single and multi-word sender names", () => {
    expect(getInitials("Elena Rostova")).toBe("ER");
    expect(getInitials("Marcus")).toBe("MA");
    expect(getInitials("Alex J. Morgan")).toBe("AM");
  });

  it("maps urgency categories to proper labels and styling tokens", () => {
    const imm = getUrgencyMeta("IMMEDIATE");
    expect(imm.shortLabel).toBe("Immediate");
    expect(imm.badgeClass).toContain("text-red-300");

    const resp = getUrgencyMeta("NEEDS_RESPONSE");
    expect(resp.shortLabel).toBe("Needs Reply");
    expect(resp.badgeClass).toContain("text-amber-300");

    const noAct = getUrgencyMeta("NO_ACTION");
    expect(noAct.shortLabel).toBe("No Action");
  });

  it("formats relative timestamps cleanly", () => {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinsAgo)).toBe("5m ago");
    expect(formatRelativeTime(null)).toBe("Just now");
  });

  it("renders UrgencyBadge, PlatformBadge, DemoBadge, and ReviewRequiredBadge", () => {
    render(
      <div>
        <UrgencyBadge urgency="IMMEDIATE" />
        <PlatformBadge source="gmail" />
        <PlatformBadge source="slack" />
        <DemoBadge />
        <ReviewRequiredBadge />
      </div>
    );

    expect(screen.getByText("Immediate")).toBeDefined();
    expect(screen.getByText("Gmail")).toBeDefined();
    expect(screen.getByText("Slack")).toBeDefined();
    expect(screen.getByText("Demo Data")).toBeDefined();
    expect(screen.getByText("Needs Human Review")).toBeDefined();
  });
});

