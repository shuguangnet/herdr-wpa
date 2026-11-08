import { useMemo, useState } from "react";

import {
  BOARD_COLS,
  DEFAULT_BOARD,
  PRESETS,
  addRow,
  boardKeyLabel,
  cellPosition,
  decodeBoard,
  encodeBoard,
  keyCount,
  missingCore,
  moveKey,
  normalizeChordStep,
  owners,
  putBackCore,
  removeKey,
  removeRow,
  canRemoveRow,
  placeKey,
  resizeKey,
  sizeOf,
  validateBoard,
  type BoardKey,
  type KeyBoard,
  type KeyHeight,
  type KeyWidth,
} from "./mobileKeyBoard";
import { getKeyBoard } from "./mobileKeyBoardStore";

type Props = {
  onSave: (board: KeyBoard) => void;
  onClose: () => void;
};

type DraftKey = {
  label: string;
  steps: string;
  danger: boolean;
};

function draftOf(key: BoardKey): DraftKey {
  if (key.kind === "mod") {
    return {
      label: key.mod === "ctrl" ? "Ctrl" : key.mod === "alt" ? "Alt" : "Shift",
      steps: "",
      danger: false,
    };
  }
  return {
    label: key.label ?? "",
    steps: key.steps.join(" "),
    danger: key.danger ?? false,
  };
}

function keyFromDraft(key: BoardKey, draft: DraftKey): BoardKey {
  if (key.kind === "mod") {
    const label = draft.label.trim();
    return {
      ...key,
      ...(label && label !== boardKeyLabel(key) ? { label } : {}),
    };
  }
  const steps = draft.steps
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((step) => normalizeChordStep(step) ?? step);
  return {
    ...key,
    steps,
    ...(draft.label.trim() ? { label: draft.label.trim() } : { label: undefined }),
    ...(draft.danger ? { danger: true } : { danger: undefined }),
  };
}

/**
 * The key board editor: pick a cell, edit its key, resize/move it, switch a
 * preset, or move a board between phones with a layout code. Editing is
 * explicit (select + action buttons) instead of drag-and-drop so it works with
 * a screen reader and with the phone's native touch behaviour.
 */
export function MobileKeyPadEditor({ onSave, onClose }: Props) {
  const [draft, setDraft] = useState<KeyBoard>(() => getKeyBoard());
  const [selected, setSelected] = useState<number | null>(null);
  const [keyDraft, setKeyDraft] = useState<DraftKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const own = useMemo(() => owners(draft), [draft]);
  const boardError = validateBoard(draft);
  const missing = missingCore(draft);

  const selectCell = (cell: number) => {
    const anchor = own[cell] === -1 ? null : own[cell];
    if (anchor === null) {
      const placed = placeKey(draft, cell, { kind: "chord", steps: ["c"] });
      if (!placed.ok) {
        setError(placed.reason);
        return;
      }
      const next = placed.board;
      setDraft(next);
      setSelected(cell);
      setKeyDraft(draftOf(next.cells[cell]!));
      setError(null);
      return;
    }
    setSelected(anchor);
    setKeyDraft(draftOf(draft.cells[anchor]!));
    setError(null);
  };

  const commitKeyDraft = () => {
    if (selected === null || !keyDraft) {
      return;
    }
    const key = draft.cells[selected];
    if (!key) {
      return;
    }
    const nextKey = keyFromDraft(key, keyDraft);
    const cells = [...draft.cells];
    cells[selected] = nextKey;
    const next = { rows: draft.rows, cells };
    const reason = validateBoard(next);
    if (reason) {
      setError(reason);
      return;
    }
    setDraft(next);
    setKeyDraft(draftOf(nextKey));
    setError(null);
  };

  const handleResize = (w: KeyWidth, h: KeyHeight) => {
    if (selected === null) {
      return;
    }
    const resized = resizeKey(draft, selected, w, h);
    if (!resized.ok) {
      setError(resized.reason);
      return;
    }
    setDraft(resized.board);
    setError(null);
  };

  const handleMove = (deltaRow: number, deltaCol: number) => {
    if (selected === null) {
      return;
    }
    const { row, col } = cellPosition(selected);
    const nextRow = row + deltaRow;
    const nextCol = col + deltaCol;
    if (nextRow < 0 || nextRow >= draft.rows || nextCol < 0 || nextCol >= BOARD_COLS) {
      return;
    }
    const moved = moveKey(draft, selected, nextRow * BOARD_COLS + nextCol);
    if (!moved.ok) {
      setError(moved.reason);
      return;
    }
    setDraft(moved.board);
    setSelected(nextRow * BOARD_COLS + nextCol);
    setError(null);
  };

  const handleDelete = () => {
    if (selected === null) {
      return;
    }
    setDraft(removeKey(draft, selected));
    setSelected(null);
    setKeyDraft(null);
    setError(null);
  };

  const handleImport = () => {
    const decoded = decodeBoard(code);
    if (!decoded.ok) {
      setCodeError(decoded.reason);
      return;
    }
    setDraft(decoded.board);
    setSelected(null);
    setKeyDraft(null);
    setCodeError(null);
    setError(null);
  };

  const handleExport = () => {
    const encoded = encodeBoard(draft);
    setCode(encoded);
    setCodeError(null);
    void navigator.clipboard?.writeText(encoded).catch(() => undefined);
  };

  const selectedKey = selected === null ? null : draft.cells[selected];

  return (
    <div className="mobile-key-editor" role="dialog" aria-label="Edit key board">
      <header className="mobile-key-editor-header">
        <strong>Key board</strong>
        <button className="term-key" type="button" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="mobile-key-editor-grid" role="group" aria-label="Key board cells">
        {draft.cells.map((key, index) => {
          const anchor = own[index] === -1 ? null : own[index];
          const isAnchor = anchor === index;
          const label = isAnchor && key ? boardKeyLabel(key) : "";
          const ownerLabel =
            !isAnchor && anchor !== null && draft.cells[anchor]
              ? boardKeyLabel(draft.cells[anchor]!)
              : null;
          return (
            <button
              key={index}
              type="button"
              className="term-key mobile-key-editor-cell"
              data-selected={selected === anchor ? "true" : "false"}
              data-covered={!isAnchor ? "true" : "false"}
              aria-label={
                isAnchor && key
                  ? `Edit ${label}`
                  : ownerLabel
                    ? `Select ${ownerLabel}`
                    : `Add a key at row ${Math.floor(index / BOARD_COLS) + 1} column ${
                        (index % BOARD_COLS) + 1
                      }`
              }
              onClick={() => selectCell(index)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error ? <p className="mobile-key-editor-error" role="alert">{error}</p> : null}
      {boardError ? (
        <p className="mobile-key-editor-error" role="alert">{boardError}</p>
      ) : missing.length > 0 ? (
        <p className="mobile-key-editor-hint">
          Missing core keys: {missing.join(", ")}{" "}
          <button type="button" className="term-key" onClick={() => setDraft(putBackCore(draft))}>
            Restore
          </button>
        </p>
      ) : null}

      {selected !== null && selectedKey && keyDraft ? (
        <section className="mobile-key-editor-panel" aria-label="Selected key">
          <label>
            <span>Name</span>
            <input
              type="text"
              value={keyDraft.label}
              placeholder={boardKeyLabel(selectedKey)}
              onChange={(event) => setKeyDraft({ ...keyDraft, label: event.target.value })}
            />
          </label>
          {selectedKey.kind === "chord" ? (
            <>
              <label>
                <span>Steps</span>
                <input
                  type="text"
                  value={keyDraft.steps}
                  placeholder="ctrl+c"
                  onChange={(event) => setKeyDraft({ ...keyDraft, steps: event.target.value })}
                />
              </label>
              <label className="mobile-key-editor-check">
                <input
                  type="checkbox"
                  checked={keyDraft.danger}
                  onChange={(event) => setKeyDraft({ ...keyDraft, danger: event.target.checked })}
                />
                <span>Require a second tap</span>
              </label>
            </>
          ) : null}
          <button className="term-key" type="button" onClick={commitKeyDraft}>
            Apply
          </button>

          <div className="mobile-key-editor-row" role="group" aria-label="Resize key">
            {[1, 2, 3].map((w) => (
              <button
                key={`w${w}`}
                type="button"
                className="term-key"
                data-active={sizeOf(selectedKey).w === w ? "true" : "false"}
                onClick={() => handleResize(w as KeyWidth, sizeOf(selectedKey).h)}
              >
                {w}w
              </button>
            ))}
            {[1, 2].map((h) => (
              <button
                key={`h${h}`}
                type="button"
                className="term-key"
                data-active={sizeOf(selectedKey).h === h ? "true" : "false"}
                onClick={() => handleResize(sizeOf(selectedKey).w, h as KeyHeight)}
              >
                {h}h
              </button>
            ))}
          </div>

          <div className="mobile-key-editor-row" role="group" aria-label="Move key">
            <button className="term-key" type="button" aria-label="Move key left" onClick={() => handleMove(0, -1)}>←</button>
            <button className="term-key" type="button" aria-label="Move key up" onClick={() => handleMove(-1, 0)}>↑</button>
            <button className="term-key" type="button" aria-label="Move key down" onClick={() => handleMove(1, 0)}>↓</button>
            <button className="term-key" type="button" aria-label="Move key right" onClick={() => handleMove(0, 1)}>→</button>
            <button className="term-key" type="button" aria-label="Delete key" onClick={handleDelete}>Delete</button>
          </div>
        </section>
      ) : (
        <p className="mobile-key-editor-hint">
          Tap a key to edit it, or an empty cell to add one.
        </p>
      )}

      <section className="mobile-key-editor-row" aria-label="Presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="term-key"
            onClick={() => {
              setDraft(preset.board);
              setSelected(null);
              setKeyDraft(null);
              setError(null);
            }}
          >
            {preset.label}
          </button>
        ))}
      </section>

      <section className="mobile-key-editor-row" aria-label="Rows">
        <button type="button" className="term-key" onClick={() => setDraft(addRow(draft))}>
          Add row
        </button>
        <button
          type="button"
          className="term-key"
          disabled={!canRemoveRow(draft)}
          onClick={() => setDraft(removeRow(draft))}
        >
          Remove row
        </button>
        <span className="mobile-key-editor-hint">{keyCount(draft)} keys</span>
      </section>

      <section className="mobile-key-editor-code" aria-label="Layout code">
        <label>
          <span>Layout code</span>
          <textarea
            rows={3}
            value={code}
            placeholder="Paste a layout code and Import, or Export the current board."
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <div className="mobile-key-editor-row">
          <button type="button" className="term-key" onClick={handleExport}>Export</button>
          <button type="button" className="term-key" onClick={handleImport}>Import</button>
        </div>
        {codeError ? <p className="mobile-key-editor-error" role="alert">{codeError}</p> : null}
      </section>

      <footer className="mobile-key-editor-footer">
        <button
          type="button"
          className="term-key"
          onClick={() => {
            setDraft(getKeyBoard());
            setSelected(null);
            setKeyDraft(null);
            setError(null);
            setCodeError(null);
          }}
        >
          Discard
        </button>
        <button
          type="button"
          className="term-key"
          onClick={() => {
            setDraft(DEFAULT_BOARD);
            setSelected(null);
            setKeyDraft(null);
            setError(null);
          }}
        >
          Default layout
        </button>
        <button
          type="button"
          className="term-key"
          disabled={boardError !== null}
          onClick={() => onSave(draft)}
        >
          Save
        </button>
      </footer>
    </div>
  );
}
