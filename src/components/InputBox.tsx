"use client";

import { FormEvent, useState } from "react";

export function InputBox({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = value.trim();
    if (!next) {
      return;
    }

    onSend(next);
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 rounded-[28px] border border-line bg-panelSoft/95 p-2 shadow-glow"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Type your duel message..."
        disabled={disabled}
        className="h-11 flex-1 bg-transparent px-4 text-sm text-slate-50 outline-none placeholder:text-slate-500"
      />
      <button
        type="submit"
        disabled={disabled}
        className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-slate-950 transition hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
