import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router";
import { Button } from "../components/ui/Button.tsx";
import { Sheet } from "../components/ui/Bits.tsx";

/**
 * Guards money flows against accidental exits (system back, in-app links)
 * while the operator has unsaid data on screen. Call disarm() before
 * programmatic post-success navigation.
 *
 * Pass onBack when the screen owns a back ladder of its own — the entry
 * wizards, which run Party → details → Review. A back press then walks one step
 * up inside the flow instead of leaving it: the navigation is cancelled so the
 * URL is restored, and the operator never sees the screen behind flash past.
 */
export function useLeaveGuard(when: boolean, onBack?: () => void) {
  const [armed, setArmed] = useState(true);
  const blocker = useBlocker(armed && when);
  const back = useRef(onBack);
  const handled = useRef(false);
  back.current = onBack;

  const blocked = blocker.state === "blocked";
  // A ladder present means this press steps back, so no "leave?" sheet.
  const consumes = blocked && onBack !== undefined;

  useEffect(() => {
    if (!blocked) {
      handled.current = false;
      return;
    }
    if (handled.current || onBack === undefined) return;
    handled.current = true;
    back.current?.();
    blocker.reset();
  }, [blocked, blocker, onBack]);

  return {
    disarm: () => setArmed(false),
    prompt: blocked && !consumes ? (
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
