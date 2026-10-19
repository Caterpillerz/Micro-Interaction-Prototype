// theme_manager.js

const pageThemes = {
  classic: {
    name: "Classic",
    image: "images/theme-backgrounds/BookBackgroundTest.png",
    accent: "#d27c60",
    font: '"EB Garamond", serif',
  },

  fantasy: {
    name: "Fantasy",
    image: "images/theme-backgrounds/FantasyBackground.png",
    accent: "#2596be",
    font: '"MedievalSharp", cursive',
  },

  horror: {
    name: "Horror",
    image: "images/theme-backgrounds/Horror background.png",
    accent: "#840100",
    font: '"Jolly Lodger", system-ui',
  },

  scifi: {
    name: "Sci-Fi",
    image: "images/theme-backgrounds/Sci-Fi.png",
    accent: "#941ebb",
    font: '"Audiowide", sans-serif',
  },

  romance: {
    name: "Romance",
    image: "images/theme-backgrounds/Love.png",
    accent: "#ff8698",
    font: '"Petit Formal Script", cursive',
  },
};

export function initializeThemeManager() {
  const readerStage = document.getElementById("reading-stage");
  const themeSelect = document.getElementById("theme-select");

  if (!readerStage || !themeSelect) {
    console.error("Theme controls or reading stage not found.");
    return;
  }

  function applySelectedTheme() {
    const theme = pageThemes[themeSelect.value];

    if (!theme) {
      console.error("Unknown theme:", themeSelect.value);
      return;
    }

    document.documentElement.style.setProperty("--theme-accent", theme.accent);

    document.documentElement.style.setProperty("--theme-font", theme.font);

    readerStage.style.backgroundColor = "#fffdf8";

    if (theme.image) {
      readerStage.style.backgroundImage = `
        linear-gradient(
          rgba(255, 255, 255, 0.58),
          rgba(255, 255, 255, 0.72)
        ),
        url("${theme.image}")
      `;

      readerStage.style.backgroundPosition = "center";
      readerStage.style.backgroundRepeat = "no-repeat";
      readerStage.style.backgroundSize = "cover";
    } else {
      readerStage.style.backgroundImage = "none";
    }

    const status = document.getElementById("theme-status");

    if (status) {
      status.textContent = `Theme applied: ${theme.name}`;
    }
  }

  themeSelect.addEventListener("change", applySelectedTheme);

  applySelectedTheme();
}
