import type { Code, Construct, Extension as MicromarkExtension, State, Tokenizer } from 'micromark-util-types';
import type { Processor } from 'unified';
import type { InlineAction, InlineSongSegment, InlineTechCue } from './types.js';

type FromMarkdownExtensionLike = {
  enter?: Record<string, (this: FromMarkdownCompileContextLike, token: unknown) => void>;
  exit?: Record<string, (this: FromMarkdownCompileContextLike, token: unknown) => void>;
  transforms?: Array<(tree: unknown) => unknown>;
};

interface FromMarkdownCompileContextLike {
  stack: unknown[];
  enter(node: unknown, token: unknown): undefined;
  exit(token: unknown): undefined;
  buffer(): undefined;
  resume(): string;
}

const draMarkFromMarkdownExtension: FromMarkdownExtensionLike = {
  enter: {
    dramarkInlineAction(token): undefined {
      return this.enter({ type: 'inline-action', value: '' } satisfies InlineAction, token);
    },
    dramarkInlineSong(token): undefined {
      return this.enter({ type: 'inline-song', value: '' } satisfies InlineSongSegment, token);
    },
    dramarkInlineTechCue(token): undefined {
      return this.enter({ type: 'inline-tech-cue', value: '' } satisfies InlineTechCue, token);
    },
    dramarkInlineActionValue(): undefined {
      return this.buffer();
    },
    dramarkInlineSongValue(): undefined {
      return this.buffer();
    },
    dramarkInlineTechCueValue(): undefined {
      return this.buffer();
    },
  },
  exit: {
    dramarkInlineActionValue(): undefined {
      const node = topNodeWithValue(this.stack);
      node.value = this.resume();
      return undefined;
    },
    dramarkInlineSongValue(): undefined {
      const node = topNodeWithValue(this.stack);
      node.value = this.resume();
      return undefined;
    },
    dramarkInlineTechCueValue(): undefined {
      const node = topNodeWithValue(this.stack);
      node.value = this.resume();
      return undefined;
    },
    dramarkInlineAction(token): undefined {
      return this.exit(token);
    },
    dramarkInlineSong(token): undefined {
      return this.exit(token);
    },
    dramarkInlineTechCue(token): undefined {
      return this.exit(token);
    },
  },
};

export function registerDraMarkParseExtensions(processor: Processor): void {
  const data = processor.data() as Record<string, unknown>;
  appendExtension(data, 'micromarkExtensions', draMarkMicromarkExtension);
  appendExtension(data, 'fromMarkdownExtensions', draMarkFromMarkdownExtension);
}

function appendExtension<T>(data: Record<string, unknown>, key: string, extension: T): void {
  const existing = Array.isArray(data[key]) ? (data[key] as T[]) : [];
  if (!existing.includes(extension)) {
    existing.push(extension);
  }
  data[key] = existing;
}

const tokenizeInlineSong: Tokenizer = function tokenizeInlineSong(effects, ok, nok): State {
  let seen = 0;

  return start;

  function start(code: Code) {
    effects.enter('dramarkInlineSong');
    effects.enter('dramarkInlineSongMarker');
    effects.consume(code);
    effects.exit('dramarkInlineSongMarker');
    effects.enter('dramarkInlineSongValue');
    return inside;
  }

  function inside(code: Code) {
    if (code === null || isLineEnding(code)) {
      return nok(code);
    }

    if (code === 36 && seen > 0) {
      effects.exit('dramarkInlineSongValue');
      effects.enter('dramarkInlineSongMarker');
      effects.consume(code);
      effects.exit('dramarkInlineSongMarker');
      effects.exit('dramarkInlineSong');
      return ok;
    }

    effects.consume(code);
    seen += 1;
    return inside;
  }
};

const tokenizeInlineAction: Tokenizer = function tokenizeInlineAction(effects, ok, nok): State {
  let closeCode: number | null = null;

  return start;

  function start(code: Code) {
    closeCode = code === 123 ? 125 : code === 65371 ? 65373 : null;
    if (closeCode === null) {
      return nok(code);
    }

    effects.enter('dramarkInlineAction');
    effects.enter('dramarkInlineActionMarker');
    effects.consume(code);
    effects.exit('dramarkInlineActionMarker');
    effects.enter('dramarkInlineActionValue');
    return inside;
  }

  function inside(code: Code) {
    if (code === null || isLineEnding(code)) {
      return nok(code);
    }

    if (code === closeCode) {
      effects.exit('dramarkInlineActionValue');
      effects.enter('dramarkInlineActionMarker');
      effects.consume(code);
      effects.exit('dramarkInlineActionMarker');
      effects.exit('dramarkInlineAction');
      return ok;
    }

    effects.consume(code);
    return inside;
  }
};

const tokenizeInlineTechCue: Tokenizer = function tokenizeInlineTechCue(effects, ok, nok): State {
  return start;

  function start(code: Code) {
    if (code !== 60) {
      return nok(code);
    }

    effects.enter('dramarkInlineTechCue');
    effects.enter('dramarkInlineTechCueMarker');
    effects.consume(code);
    return afterFirstOpen;
  }

  function afterFirstOpen(code: Code) {
    if (code !== 60) {
      return nok(code);
    }

    effects.consume(code);
    effects.exit('dramarkInlineTechCueMarker');
    effects.enter('dramarkInlineTechCueValue');
    return inside;
  }

  function inside(code: Code) {
    if (code === null || isLineEnding(code)) {
      return nok(code);
    }

    if (code === 62) {
      effects.consume(code);
      return afterFirstClose;
    }

    effects.consume(code);
    return inside;
  }

  function afterFirstClose(code: Code) {
    if (code === null || isLineEnding(code)) {
      return nok(code);
    }

    if (code === 62) {
      effects.exit('dramarkInlineTechCueValue');
      effects.enter('dramarkInlineTechCueMarker');
      effects.consume(code);
      effects.exit('dramarkInlineTechCueMarker');
      effects.exit('dramarkInlineTechCue');
      return ok;
    }

    effects.consume(code);
    return inside;
  }
};

const inlineSongConstruct: Construct = {
  name: 'dramarkInlineSong',
  tokenize: tokenizeInlineSong,
};

const inlineActionConstruct: Construct = {
  name: 'dramarkInlineAction',
  tokenize: tokenizeInlineAction,
};

const inlineTechCueConstruct: Construct = {
  name: 'dramarkInlineTechCue',
  tokenize: tokenizeInlineTechCue,
};

const draMarkMicromarkExtension: MicromarkExtension = {
  text: {
    36: inlineSongConstruct,
    60: inlineTechCueConstruct,
    123: inlineActionConstruct,
    65371: inlineActionConstruct,
  },
};

function isLineEnding(code: Code): boolean {
  return code === -5 || code === -4 || code === -3 || code === 10 || code === 13;
}

function topNodeWithValue(stack: unknown[]): { value: string } {
  const node = stack[stack.length - 1] as { value?: unknown };
  if (typeof node !== 'object' || node === null) {
    return { value: '' };
  }
  return node as { value: string };
}

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    dramarkInlineAction: 'dramarkInlineAction';
    dramarkInlineActionMarker: 'dramarkInlineActionMarker';
    dramarkInlineActionValue: 'dramarkInlineActionValue';
    dramarkInlineSong: 'dramarkInlineSong';
    dramarkInlineSongMarker: 'dramarkInlineSongMarker';
    dramarkInlineSongValue: 'dramarkInlineSongValue';
    dramarkInlineTechCue: 'dramarkInlineTechCue';
    dramarkInlineTechCueMarker: 'dramarkInlineTechCueMarker';
    dramarkInlineTechCueValue: 'dramarkInlineTechCueValue';
  }
}