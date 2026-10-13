// replaces old pullup_page.js if we move away from pdf uploads

import { loadText } from "./reader_layout.js";

const STORIES = {
  cinderella: {
    title: "Cinderella",
    path: "./stories/cinderella.txt",
    illustrations: [
      "./images/cinderella-story/page-01.png",
      "./images/cinderella-story/page-02.png",
      "./images/cinderella-story/page-03.png",
      "./images/cinderella-story/page-04.png",
      "./images/cinderella-story/page-05.png",
      "./images/cinderella-story/page-06.png",
      "./images/cinderella-story/page-07.png",
      "./images/cinderella-story/page-08.png",
      "./images/cinderella-story/page-09.png",
    ],
  },
  threepigs: {
    title: "Three Little Pigs",
    path: "./stories/threepigs.txt",
    illustrations: [
      "./images/threepigs-story/page-01.png",
      "./images/threepigs-story/page-02.png",
    ],
  },
};

let currentLoad = 0;

export async function loadSelectedStory() {
  const storySelect = document.getElementById("story-select");
  const loadStatus = document.getElementById("story-load-status");

  if (!storySelect) return;

  const story = STORIES[storySelect.value];

  if (!story) {
    if (loadStatus) loadStatus.textContent = "Choose a valid story.";
    return;
  }

  const thisLoad = ++currentLoad;

  if (loadStatus) {
    loadStatus.textContent = `Loading ${story.title}…`;
  }

  try {
    const response = await fetch(story.path);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    if (!text.trim()) {
      throw new Error("The story file is empty.");
    }

    if (thisLoad !== currentLoad) return;

    const sentencesPerScreen = 2;

    const illustrations = story.illustrations ?? [];

    loadText(text, sentencesPerScreen, {
      title: story.title,
      illustrations,
    });

    if (loadStatus) {
      loadStatus.textContent = `${story.title} loaded`;
    }
  } catch (error) {
    if (thisLoad !== currentLoad) return;

    console.error("Could not load story:", error);

    if (loadStatus) {
      loadStatus.textContent = `Couldn't load ${story.title}. Check ${story.path} and try again.`;
    }
  }
}

export function initializeStoryLoader() {
  const storySelect = document.getElementById("story-select");

  storySelect?.addEventListener("change", loadSelectedStory);

  loadSelectedStory();
}
