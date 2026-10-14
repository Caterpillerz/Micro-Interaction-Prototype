// definitions.js

import { getSelectedWord } from "./reader_layout.js";

const localGlossary = {
  // Characters and relationships
  prince: {
    partOfSpeech: "noun",
    definition: "The son of a king or queen, often a royal ruler in the future.",
  },
  cinderella: {
    partOfSpeech: "proper noun",
    definition: "The kind and gentle girl at the center of this fairy tale.",
  },
  daughter: {
    partOfSpeech: "noun",
    definition: "A female child in relation to her parents.",
  },
  stepsister: {
    partOfSpeech: "noun",
    definition: "A sister related through a stepparent rather than both parents.",
  },
  stepsisters: {
    partOfSpeech: "noun",
    definition: "Two or more sisters related through a stepparent.",
  },
  stepmother: {
    partOfSpeech: "noun",
    definition: "The woman married to someone's father who is not their birth mother.",
  },
  wife: {
    partOfSpeech: "noun",
    definition: "A woman who is married to another person.",
  },
  bride: {
    partOfSpeech: "noun",
    definition: "A woman on her wedding day or at the time of her marriage.", 
  },

  // Story objects
  slipper: {
    partOfSpeech: "noun",
    definition: "A light shoe, often worn indoors. In the story, it is the special shoe Cinderella tries on.",
  },
  horse: {
    partOfSpeech: "noun",
    definition: "A large animal that people can ride or use to pull a carriage.",
  },
  stool: {
    partOfSpeech: "noun",
    definition: "A seat with legs and usually no back or arms.",
  },
  foot: {
    partOfSpeech: "noun",
    definition: "The part of the body at the bottom of the leg that a person stands on.",
  },

  // Describing people and feelings
  astonished: {
    partOfSpeech: "adjective",
    definition: "Very surprised by something unexpected.",
  },
  shyly: {
    partOfSpeech: "adverb",
    definition: "In a quiet or nervous way because someone feels shy.",
  },
  gently: {
    partOfSpeech: "adverb",
    definition: "In a soft, careful, or kind way.",
  },
  quietly: {
    partOfSpeech: "adverb",
    definition: "Without making much noise or drawing attention.",
  },
  dusty: {
    partOfSpeech: "adjective",
    definition: "Covered with dust, a fine layer of dry dirt.",
  },
  gentle: {
    partOfSpeech: "adjective",
    definition: "Kind, calm, and careful with others.",
  },

  // Actions and expressions
  bowed: {
    partOfSpeech: "verb",
    definition: "Bent the head or body forward to show respect or greeting.",
  },
  fuss: {
    partOfSpeech: "noun",
    definition: "Unnecessary excitement, worry, or activity about something.",
  },
  ignored: {
    partOfSpeech: "verb",
    definition: "Paid no attention to someone or something.",
  },
  forgive: {
    partOfSpeech: "verb",
    definition: "To stop feeling angry or resentful toward someone for a mistake or wrong action.",
  },
  astonished: {
    partOfSpeech: "adjective",
    definition: "Very surprised by something unexpected.",
  },
  slid: {
    partOfSpeech: "verb",
    definition: "Moved smoothly across or into something.",
  },
  lifted: {
    partOfSpeech: "verb",
    definition: "Raised something to a higher position.",
  },
  turned: {
    partOfSpeech: "verb",
    definition: "Moved or changed direction.",
  },
  cried: {
    partOfSpeech: "verb",
    definition: "Called out or spoke loudly to express a strong feeling.",
  },
  fit: {
    partOfSpeech: "verb",
    definition: "Was the right size or shape for something.",
  },
  called: {
    partOfSpeech: "verb",
    definition: "Asked for someone to come, or spoke someone's name to get their attention.",
  },
  washed: {
    partOfSpeech: "verb",
    definition: "Cleaned with water, often using soap.",
  },
  held: {
    partOfSpeech: "verb",
    definition: "Kept something in the hands or arms.",
  },

  // Important ideas
  kindness: {
    partOfSpeech: "noun",
    definition: "The quality of being caring, helpful, and considerate toward others.",
  },
  joy: {
    partOfSpeech: "noun",
    definition: "A strong feeling of happiness.",
  },
  indeed: {
    partOfSpeech: "adverb",
    definition: "Truly or certainly; used to emphasize that something is true.",
  },
  sorry: {
    partOfSpeech: "adjective",
    definition: "Feeling regret or sadness about something wrong that happened.",
  },
  heart: {
    partOfSpeech: "noun",
    definition: "The organ that pumps blood, or a symbol of a person's feelings and kindness.",
  },
  smile: {
    partOfSpeech: "noun",
    definition: "A facial expression in which the corners of the mouth turn upward to show happiness or friendliness.",
  },
};

// set to false for definitions to stay local
const USE_REMOTE_DICTIONARY = true;

export async function lookupDefinition(rawWord) {
  const word = rawWord
    .toLocaleLowerCase("en")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, "");

  if (!word) {
    return null;
  }

  // local glossary takes priority.
  if (localGlossary[word]) {
    return {
      word,
      ...localGlossary[word],
      source: "Local glossary",
    };
  }

  if (!USE_REMOTE_DICTIONARY) {
    return {
      word,
      definition: "This word is not in the local glossary yet.",
      source: "Local glossary",
    };
  }

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );

    if (!response.ok) {
      return {
        word,
        definition: "No definition was found for this word.",
        source: "Dictionary",
      };
    }

    const entries = await response.json();

    for (const entry of entries) {
      for (const meaning of entry.meanings ?? []) {
        const firstDefinition = meaning.definitions?.[0];

        if (firstDefinition?.definition) {
          return {
            word,
            partOfSpeech: meaning.partOfSpeech ?? "",
            definition: firstDefinition.definition,
            example: firstDefinition.example ?? "",
            source: "Online dictionary",
          };
        }
      }
    }

    return {
      word,
      definition: "No definition was found for this word.",
      source: "Dictionary",
    };
  } catch {
    return {
      word,
      definition: "The dictionary could not be reached. Please try again.",
      source: "Dictionary unavailable",
    };
  }
}

// -----------------------------
// show definition in sidebar
// -----------------------------
export async function showDefinition() {
  const word = getSelectedWord();

  const wordElement = document.getElementById("definition-word");
  const bodyElement = document.getElementById("definition-body");
  const sourceElement = document.getElementById("definition-source");

  if (!wordElement || !bodyElement || !sourceElement) {
    console.error("Dictionary panel elements not found.");
    return;
  }

  if (!word) {
    wordElement.textContent = "No word selected";
    bodyElement.textContent = "Look at a word in the reading area first.";
    sourceElement.textContent = "";
    return;
  }

  wordElement.textContent = word;
  bodyElement.textContent = "Looking up definition...";
  sourceElement.textContent = "";

  const result = await lookupDefinition(word);

  if (!result) {
    bodyElement.textContent = "No definition was found.";
    return;
  }

  bodyElement.textContent = result.definition;

  sourceElement.textContent = [
    result.partOfSpeech,
    result.example ? `Example: ${result.example}` : "",
    result.source,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function initializeDefinitionPanel() {
  document
    .getElementById("test-define-button")
    ?.addEventListener("click", showDefinition);
}
