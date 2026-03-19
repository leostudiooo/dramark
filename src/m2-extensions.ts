import type { Code, Construct, Extension as MicromarkExtension, State, Tokenizer } from 'micromark-util-types';
import type { Options as MdastFromMarkdownOptions } from 'mdast-util-from-markdown';
import type { Processor } from 'unified';
import type { InlineAction, InlineSongSegment, InlineTechCue } from './types.js';

type FromMarkdownExtensionLike = {
  enter?: Record<string, (this: FromMarkdownCompileContextLike, token: unknown) => void>;
  exit?: Record<string, (this: FromMarkdownCompileContextLike, token: unknown) => void>;
};

interface FromMarkdownCompileContextLike {
  stack: unknown[];
  enter(node: unknown, token: unknown): undefined;
  exit(token: unknown): undefined;
  buffer(): undefined;
  resume(): string;
  sliceSerialize(token: unknown): string;
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
    dramarkBlockComment(token): undefined {
      return this.enter({ type: 'comment-block', value: '' } satisfies { type: 'comment-block'; value: string }, token);
    },
    dramarkBlockTechCue(token): undefined {
      return this.enter({ type: 'block-tech-cue', value: '' } satisfies { type: 'block-tech-cue'; value: string }, token);
    },
    dramarkLineComment(token): undefined {
      return this.enter({ type: 'comment-line', value: '' } satisfies { type: 'comment-line'; value: string }, token);
    },
    dramarkCharacter(token): undefined {
      return this.enter({ type: 'character-block', name: '', names: [], children: [] } satisfies {
        type: 'character-block';
        name: string;
        names: string[];
        children: unknown[];
      }, token);
    },
    dramarkSongContainer(token): undefined {
      return this.enter({ type: 'song-container', children: [] } satisfies { type: 'song-container'; children: unknown[] }, token);
    },
    dramarkTranslationPair(token): undefined {
      return this.enter({ type: 'translation-pair', sourceText: '', target: [], children: [] } satisfies {
        type: 'translation-pair';
        sourceText: string;
        target: unknown[];
        children: unknown[];
      }, token);
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
    dramarkBlockCommentValue(): undefined {
      return this.buffer();
    },
    dramarkBlockTechCueValue(): undefined {
      return this.buffer();
    },
    dramarkLineCommentValue(): undefined {
      return this.buffer();
    },
  },
  exit: {
    dramarkInlineActionValue(): undefined {
      topNodeWithValue(this.stack).value = this.resume();
      return undefined;
    },
    dramarkInlineSongValue(): undefined {
      topNodeWithValue(this.stack).value = this.resume();
      return undefined;
    },
    dramarkInlineTechCueValue(): undefined {
      topNodeWithValue(this.stack).value = this.resume();
      return undefined;
    },
    dramarkBlockCommentValue(): undefined {
      topNodeWithValue(this.stack).value = this.resume();
      return undefined;
    },
    dramarkBlockTechCueValue(): undefined {
      topNodeWithValue(this.stack).value = this.resume();
      return undefined;
    },
    dramarkLineCommentValue(): undefined {
      topNodeWithValue(this.stack).value = this.resume();
      return undefined;
    },
    dramarkInlineAction(token): undefined {
      setNodeValueFromDelimitedToken(this, token, 1, 1);
      return this.exit(token);
    },
    dramarkInlineSong(token): undefined {
      setNodeValueFromDelimitedToken(this, token, 1, 1);
      return this.exit(token);
    },
    dramarkInlineTechCue(token): undefined {
      setNodeValueFromDelimitedToken(this, token, 2, 2);
      return this.exit(token);
    },
    dramarkBlockComment(token): undefined {
      return this.exit(token);
    },
    dramarkBlockTechCue(token): undefined {
      return this.exit(token);
    },
    dramarkLineComment(token): undefined {
      return this.exit(token);
    },
    dramarkCharacter(token): undefined {
      return this.exit(token);
    },
    dramarkSongContainer(token): undefined {
      return this.exit(token);
    },
    dramarkTranslationPair(token): undefined {
      return this.exit(token);
    },
  },
};

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

// Flow constructs - added to the flow field for block-level parsing
// Note: Block constructs require special handling of line boundaries in micromark
const draMarkMicromarkExtension: MicromarkExtension = {
  text: {
    36: inlineSongConstruct,
    60: inlineTechCueConstruct,
    123: inlineActionConstruct,
    65371: inlineActionConstruct,
  },
};

export function registerDraMarkParseExtensions(processor: Processor): void {
  const data = processor.data() as Record<string, unknown>;
  appendExtension(data, 'micromarkExtensions', draMarkMicromarkExtension);
  appendExtension(data, 'fromMarkdownExtensions', draMarkFromMarkdownExtension);
}

export function getDraMarkFromMarkdownOptions(): Pick<MdastFromMarkdownOptions, 'extensions' | 'mdastExtensions'> {
  return {
    extensions: [draMarkMicromarkExtension],
    mdastExtensions: [draMarkFromMarkdownExtension as NonNullable<MdastFromMarkdownOptions['mdastExtensions']>[number]],
  };
}

function appendExtension<T>(data: Record<string, unknown>, key: string, extension: T): void {
  const existing = Array.isArray(data[key]) ? (data[key] as T[]) : [];
  existing.push(extension);
  data[key] = existing;
}

function setNodeValueFromDelimitedToken(
  context: FromMarkdownCompileContextLike,
  token: unknown,
  openLength: number,
  closeLength: number,
): void {
  const raw = context.sliceSerialize(token);
  const start = Math.min(openLength, raw.length);
  const end = Math.max(start, raw.length - closeLength);
  topNodeWithValue(context.stack).value = raw.slice(start, end);
}

function isLineEnding(code: Code): boolean {
  return code === -5 || code === -4 || code === -3 || code === 10 || code === 13;
}

function topNodeWithValue(stack: unknown[]): { value: string } {
  return stack[stack.length - 1] as { value: string };
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
    dramarkBlockComment: 'dramarkBlockComment';
    dramarkBlockCommentMarker: 'dramarkBlockCommentMarker';
    dramarkBlockCommentValue: 'dramarkBlockCommentValue';
    dramarkBlockTechCue: 'dramarkBlockTechCue';
    dramarkBlockTechCueMarker: 'dramarkBlockTechCueMarker';
    dramarkBlockTechCueValue: 'dramarkBlockTechCueValue';
    dramarkLineComment: 'dramarkLineComment';
    dramarkLineCommentMarker: 'dramarkLineCommentMarker';
    dramarkLineCommentValue: 'dramarkLineCommentValue';
    dramarkCharacter: 'dramarkCharacter';
    dramarkCharacterMarker: 'dramarkCharacterMarker';
    dramarkCharacterName: 'dramarkCharacterName';
    dramarkCharacterMood: 'dramarkCharacterMood';
    dramarkSongContainer: 'dramarkSongContainer';
    dramarkSongContainerMarker: 'dramarkSongContainerMarker';
    dramarkTranslationPair: 'dramarkTranslationPair';
    dramarkTranslationPairMarker: 'dramarkTranslationPairMarker';
    dramarkTranslationPairSource: 'dramarkTranslationPairSource';
    dramarkTranslationPairTarget: 'dramarkTranslationPairTarget';
  }
}
