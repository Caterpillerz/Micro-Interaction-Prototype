// definitions.js

const localGlossary = {
  lantern: {
    partOfSpeech: "noun",
    definition: "A portable light, often protected by a case.",
  },

  weary: {
    partOfSpeech: "adjective",
    definition: "Very tired, especially after a long effort.",
  },

  enormous: {
    partOfSpeech: "adjective",
    definition: "Extremely large.",
  },

  bewildered: {
    partOfSpeech: "adjective",
    definition: "Confused because something is difficult to understand.",
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
