import { useState } from "react";
import { useBlocker } from "react-router";
import { Button } from "../components/ui/Button.tsx";
import { Sheet } from "../components/ui/Bits.tsx";

/**
 * Guards money flows against accidental exits (system back, in-app links)
 * while the operator has unsaid data on screen. Call disarm() before
 * programmatic post-success navigation.
 */
export function useLeaveGuard(when: boolean) {
  const [armed, setArmed] = useState(true);
  const blocker = useBlocker(armed && when);
  const blocked = blocker.state === "blocked";
  return {
    disarm: () => setArmed(false),
    prompt: blocked ? (
      <Sheet title="Leave without saving?" onClose={() => blocker.reset()}>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-stone-600">This entry isn't posted yet. Leaving now loses what you typed.</p>
          <Button variant="danger" full onClick={() => blocker.proceed()}>Leave & discard</Button>
          <Button variant="secondary" full onClick={() => blocker.reset()}>Stay here</Button>
        </div>
      </Sheet>
    ) : null,
  };
}
