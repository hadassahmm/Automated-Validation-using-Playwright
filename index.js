const { chromium } = require("playwright");

// Converts a "time ago" string (like "5 minutes ago") into seconds.
function parseTimeAgoInSeconds(timeString) {
  const regex = /(\d+)\s*(second|minute|hour)s?\s*ago/;
  const match = timeString.match(regex);

  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "second":
        return amount; // Already in seconds.
      case "minute":
        return amount * 60; // Convert minutes to seconds.
      case "hour":
        return amount * 3600; // Convert hours to seconds.
      default:
        return -1; // Fallback value.
    }
  }

  return -1; // In case the format doesn't match.
}

// Fetches Hacker News articles, paginates until we have at least 100,
// and then checks if they're sorted from newest to oldest.
async function sortHackerNewsArticles() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const expectedUrl = "https://news.ycombinator.com/newest";
  await page.goto(expectedUrl);

  // Check if we are at the expected URL.
  if (page.url() !== expectedUrl) {
    console.error(
      `Unexpected URL: expected ${expectedUrl}, but got ${page.url()}`
    );
    await browser.close();
    return;
  }

  let articles = [];

  // Paginate and collect articles (up to 4 pages or 100+ articles).
  for (let i = 0; i < 4; i++) {
    const newArticles = await page.$$eval(".athing", (nodes) =>
      nodes.map((n) => {
        const title = n.querySelector(".title a")?.innerText;
        const timeAgo = n.nextElementSibling.querySelector(
          "td.subtext span.subline span.age a"
        )?.innerText;
        return { title, timeAgo };
      })
    );
    articles = articles.concat(newArticles);

    if (articles.length >= 100) break;

    const moreButton = await page.$("a.morelink");
    if (moreButton) {
      await moreButton.click();
      await page.waitForSelector(".athing", { timeout: 5000 });
    } else {
      console.log("No 'More' button found, stopping pagination.");
      break;
    }
  }

  if (articles.length < 100) {
    console.log(
      `Only found ${articles.length} articles, expected at least 100.`
    );
    await browser.close();
    return;
  }

  // Verify if articles are sorted from newest to oldest.
  function isSortedNewestToOldest(articles) {
    for (let i = 1; i < articles.length; i++) {
      const prevTimestamp = parseTimeAgoInSeconds(articles[i - 1].timeAgo);
      const currTimestamp = parseTimeAgoInSeconds(articles[i].timeAgo);

      if (prevTimestamp > currTimestamp) {
        return false;
      }
    }
    return true;
  }

  if (isSortedNewestToOldest(articles)) {
    console.log("Articles are correctly sorted from newest to oldest.");
  } else {
    console.log("Articles are NOT sorted correctly!");
  }

  // Keep the page open for 10 seconds before closing the browser.
  await page.waitForTimeout(3000);
  await browser.close();
}

(async () => {
  await sortHackerNewsArticles();
})();
