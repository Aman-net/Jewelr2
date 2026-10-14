// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstallCard } from "./InstallCard.tsx";
import type { InstallPromptEvent } from "../../hooks/useInstallPrompt.ts";

afterEach(() => cleanup());

function firePrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt") as InstallPromptEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(event, "userChoice", { value: Promise.resolve({ outcome }) });
  window.dispatchEvent(event);
  return event;
}

describe("InstallCard", () => {
  it("offers Install when the browser fires beforeinstallprompt", async () => {
    const user = userEvent.setup();
    render(<InstallCard />);
    expect(screen.queryByText("Install Jewelr")).toBeNull();
    const event = firePrompt();
    expect(await screen.findByText("Install Jewelr")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Install" }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it("hides the card after an accepted install", async () => {
    const user = userEvent.setup();
    render(<InstallCard />);
    firePrompt("accepted");
    await user.click(await screen.findByRole("button", { name: "Install" }));
    expect(screen.queryByText("Install Jewelr")).toBeNull();
  });

  it("hides the card on the appinstalled event", async () => {
    render(<InstallCard />);
    firePrompt("dismissed");
    expect(await screen.findByText("Install Jewelr")).toBeTruthy();
    window.dispatchEvent(new Event("appinstalled"));
    await waitFor(() => expect(screen.queryByText("Install Jewelr")).toBeNull());
  });
});
