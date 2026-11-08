import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import {
  MODIFIER_ORDER,
  applyModifiers,
  boardKeyLabel,
  cellPosition,
  encodeChordStep,
  isRepeatableKey,
  owners,
  sizeOf,
  type BoardKey,
  type KeyBoard,
  type ModifierName,
} from "./mobileKeyBoard";
import { pulseHaptics, useHapticsEnabled } from "./useHaptics";

const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 60;
const CONFIRM_TIMEOUT_MS = 2600;

type ModifierState = "off" | "armed" | "locked";

function modifierState(
  mod: ModifierName,
  armed: readonly ModifierName[],
  locked: readonly ModifierName[],
): ModifierState {
  if (locked.includes(mod)) {
    return "locked";
  }
  if (armed.includes(mod)) {
    return "armed";
  }
  return "off";
}

type Props = {
  board: KeyBoard;
  disabled: boolean;
  /** Receives one entry per chord step, already encoded to terminal bytes. */
  onSend: (chunks: string[]) => void;
  onEdit?: () => void;
};

/**
 * The phone key board. Keys are data (`mobileKeyBoard`); this component only
 * renders the grid, tracks sticky modifiers and routes taps to `onSend`.
 */
export function MobileKeyPad({ board, disabled, onSend, onEdit }: Props) {
  const hapticsEnabled = useHapticsEnabled();
  const [armed, setArmed] = useState<ModifierName[]>([]);
  const [locked, setLocked] = useState<ModifierName[]>([]);
  const [confirming, setConfirming] = useState<number | null>(null);
  const confirmTimer = useRef<number | null>(null);
  const repeatTimer = useRef<number | null>(null);
  const repeatAnchor = useRef<number | null>(null);
  const pointerSent = useRef<number | null>(null);

  const stopRepeat = useCallback(() => {
    if (repeatTimer.current !== null) {
      window.clearTimeout(repeatTimer.current);
      repeatTimer.current = null;
    }
    repeatAnchor.current = null;
  }, []);

  const clearConfirm = useCallback(() => {
    if (confirmTimer.current !== null) {
      window.clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
    setConfirming(null);
  }, []);

  useEffect(
    () => () => {
      stopRepeat();
      if (confirmTimer.current !== null) {
        window.clearTimeout(confirmTimer.current);
      }
    },
    [stopRepeat],
  );

  const sendKey = useCallback(
    (anchor: number, key: BoardKey) => {
      if (key.kind !== "chord") {
        return;
      }
      const mods = MODIFIER_ORDER.filter(
        (mod) => locked.includes(mod) || armed.includes(mod),
      );
      const chunks: string[] = [];
      key.steps.forEach((step, index) => {
        const merged = index === 0 && mods.length > 0 ? applyModifiers(step, mods) : step;
        const bytes = merged === null ? null : encodeChordStep(merged);
        if (bytes !== null) {
          chunks.push(bytes);
        }
      });
      if (chunks.length === 0) {
        return;
      }
      onSend(chunks);
      if (hapticsEnabled) {
        pulseHaptics();
      }
      if (armed.length > 0) {
        setArmed([]);
      }
      if (confirming !== null) {
        clearConfirm();
      }
      void anchor;
    },
    [armed, clearConfirm, confirming, hapticsEnabled, locked, onSend],
  );

  const activate = useCallback(
    (anchor: number, key: BoardKey) => {
      if (key.kind === "mod") {
        const state = modifierState(key.mod, armed, locked);
        if (state === "off") {
          setArmed([...armed, key.mod]);
        } else if (state === "armed") {
          setArmed(armed.filter((mod) => mod !== key.mod));
          setLocked([...locked, key.mod]);
        } else {
          setLocked(locked.filter((mod) => mod !== key.mod));
        }
        if (hapticsEnabled) {
          pulseHaptics();
        }
        return;
      }
      if (key.danger && confirming !== anchor) {
        setConfirming(anchor);
        if (confirmTimer.current !== null) {
          window.clearTimeout(confirmTimer.current);
        }
        confirmTimer.current = window.setTimeout(() => {
          setConfirming(null);
          confirmTimer.current = null;
        }, CONFIRM_TIMEOUT_MS);
        return;
      }
      sendKey(anchor, key);
    },
    [armed, confirming, hapticsEnabled, locked, sendKey],
  );

  const startPress =
    (anchor: number, key: BoardKey) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled || key.kind === "mod" || key.danger) {
        return;
      }
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        // Keep the soft keyboard focused and suppress native long-press menus.
        event.preventDefault();
      }
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointerSent.current = anchor;
      sendKey(anchor, key);
      if (!isRepeatableKey(key)) {
        return;
      }
      repeatAnchor.current = anchor;
      const tick = () => {
        repeatTimer.current = window.setTimeout(() => {
          if (repeatAnchor.current !== anchor) {
            return;
          }
          sendKey(anchor, key);
          tick();
        }, REPEAT_INTERVAL_MS);
      };
      repeatTimer.current = window.setTimeout(() => {
        if (repeatAnchor.current !== anchor) {
          return;
        }
        sendKey(anchor, key);
        tick();
      }, REPEAT_DELAY_MS);
    };

  const endPress = () => {
    stopRepeat();
  };

  const click =
    (anchor: number, key: BoardKey) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      // A pointer press already sent (or armed) this key; keep keyboard and
      // screen-reader activation working through the click path.
      if (pointerSent.current === anchor) {
        pointerSent.current = null;
        void event;
        return;
      }
      activate(anchor, key);
    };

  const own = owners(board);

  return (
    <div className="mobile-key-board-shell">
      <div className="mobile-key-board" role="group" aria-label="Terminal key board">
        {board.cells.map((key, index) => {
          if (!key || own[index] !== index) {
            return null;
          }
          const { row, col } = cellPosition(index);
          const { w, h } = sizeOf(key);
          const state = key.kind === "mod" ? modifierState(key.mod, armed, locked) : "off";
          const label = boardKeyLabel(key);
          const isConfirming = confirming === index;
          const ariaLabel =
            key.kind === "mod"
              ? `${label} modifier ${
                  state === "off" ? "off" : state === "armed" ? "one-shot" : "locked"
                }`
              : `Send ${label}${key.danger ? ", dangerous" : ""}${
                  isConfirming ? ", tap again to confirm" : ""
                }`;
          return (
            <button
              key={index}
              type="button"
              className="term-key mobile-key"
              style={{
                gridColumn: `${col + 1} / span ${w}`,
                gridRow: `${row + 1} / span ${h}`,
              }}
              data-mod={key.kind === "mod" ? key.mod : undefined}
              data-armed={state === "armed" ? "true" : "false"}
              data-locked={state === "locked" ? "true" : "false"}
              data-danger={key.kind === "chord" && key.danger ? "true" : "false"}
              data-confirming={isConfirming ? "true" : "false"}
              aria-pressed={key.kind === "mod" ? state !== "off" : undefined}
              aria-label={ariaLabel}
              disabled={disabled}
              onPointerDown={startPress(index, key)}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerCancel={endPress}
              onClick={click(index, key)}
            >
              {isConfirming ? "Again" : label}
            </button>
          );
        })}
      </div>
      {onEdit ? (
        <button
          className="term-key term-key-icon mobile-key-edit"
          type="button"
          aria-label="Edit key board"
          title="Edit key board"
          onClick={onEdit}
        >
          Edit
        </button>
      ) : null}
    </div>
  );
}
