import { chromium } from "playwright";
import { killPopups, normalizeStatus, parseNumber } from "./helpers";
import { setupDatabase } from "./database";

async function run() {
  const db = await setupDatabase();
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  console.log("navigating to atal...");
  await page.goto("https://atal.pl/");

  // Navigation selectors
  const cookieButtonSelector =
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll";
  const callRequestCloseSelector = '[data-test="widget-close-btn"]';
  const mainMenuSelector = '[data-label="Mieszkania"]';
  const RegionSelectorTricityReda = '[data-label="Trójmiasto / Reda"]';
  const CitySelector = '[data-label="Gdańsk"]';
  const promoLocator = "#AnimateBannerClose";

  // pop up handling
  try {
    await page.waitForSelector(cookieButtonSelector, { timeout: 5000 });
    await page.click(cookieButtonSelector);
  } catch (e) {
    console.log("no cookies");
  }

  try {
    await page.hover(mainMenuSelector);
    await page.waitForSelector(callRequestCloseSelector, { timeout: 3000 });
    await page.click(callRequestCloseSelector);
  } catch (e) {
    console.log("no call banner");
  }

  // Going to Gdansk
  console.log("choosing gdansk");
  await page.hover(mainMenuSelector);
  await page.hover(RegionSelectorTricityReda);
  await page.click(CitySelector);
  await page.waitForLoadState("networkidle");

  // all investment links
  const investmentLocators = await page.locator(".investmentBox__link").all();
  const tasks = [];

  for (const link of investmentLocators) {
    const url = await link.getAttribute("href");
    const title = await link.getAttribute("title");
    if (url && title) {
      tasks.push({
        name: title,
        url: url.startsWith("http") ? url : `https://atal.pl${url}`,
      });
    }
  }

  console.log(`Found ${tasks.length} investments. Scanning...`);

  // main investment loop
  for (const task of tasks) {
    let showAllTiles = ".button__item.js-show-all-tiles";
    let showAllTiles2 = ".table-promotion-button";
    let apartmentTile = ".apartmentTile.js-apartment-tile";
    console.log(`\nInvestment: ${task.name}`);
    try {
      await page.goto(task.url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await killPopups(page);

      // Rozwiń listę mieszkań
      try {
        const showAllBtn = page.locator(showAllTiles);
        const showAllBtn2 = page.locator(showAllTiles2);
        if (await showAllBtn.isVisible()) {
          await showAllBtn.click();
          console.log("expanding apartment list...");
          await page.waitForTimeout(1000);
        }
        if (await showAllBtn2.isVisible()) {
          await showAllBtn2.click();
          console.log("expanding apartment list (alternative button)...");
          await page.waitForTimeout(1000);
        }
      } catch (e) {}

      // waiting 5 secs for tiles to load
      try {
        await page.waitForSelector(apartmentTile, { timeout: 5000 });
      } catch (e) {
        console.log("No apartments found or page structure changed!");
      }

      // downloading
      const apartments = await page.locator(apartmentTile).all();
      console.log(`Found ${apartments.length} apartments.`);

      for (const singleApartment of apartments) {
        // Pobieranie surowych danych
        let priceRaw = "N/A",
          areaRaw = "N/A",
          nameRaw = "N/A",
          statusRaw = "N/A",
          roomsRaw = "N/A",
          floorRaw = "N/A",
          priceSqmRaw = "N/A";

        try {
          priceRaw = await singleApartment
            .locator(".apartmentTile__price__value")
            .innerText();
        } catch (e) {}
        try {
          areaRaw = await singleApartment
            .locator(".apartmentTile__data__item__value", { hasText: "m²" })
            .innerText();
        } catch (e) {}
        try {
          nameRaw = await singleApartment
            .locator(".apartmentTile__basicData__item__name")
            .innerText();
        } catch (e) {}
        try {
          statusRaw = await singleApartment
            .locator(".apartmentTile__basicData__item__badge")
            .first()
            .innerText();
        } catch (e) {}
        try {
          roomsRaw = await singleApartment
            .locator(".apartmentTile__data__item")
            .filter({ hasText: "pokoje" })
            .locator(".apartmentTile__data__item__value")
            .innerText();
        } catch (e) {}
        try {
          floorRaw = await singleApartment
            .locator(".apartmentTile__data__item")
            .filter({ hasText: "piętro" })
            .locator(".apartmentTile__data__item__value")
            .innerText();
        } catch (e) {}
        try {
          priceSqmRaw = await singleApartment
            .locator(".apartmentTile__price__sqm")
            .innerText();
        } catch (e) {}

        // normalization
        const currentApt = {
          name: nameRaw,
          price: parseNumber(priceRaw),
          area: parseNumber(areaRaw),
          status: normalizeStatus(statusRaw),
          rooms: parseNumber(roomsRaw),
          floor: parseNumber(floorRaw),
          priceSqm: parseNumber(priceSqmRaw),
          scraped_at: new Date().toISOString(),
        };

        // database
        const apartmentId = `${task.name}_${currentApt.name}`.replace(
          /\s+/g,
          "_",
        );
        const existing = await db.get("SELECT * FROM apartments WHERE id = ?", [
          apartmentId,
        ]);

        if (!existing) {
          // new apartment
          await db.run(
            `INSERT INTO apartments (id, investment_name, name, price, status, last_seen) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              apartmentId,
              task.name,
              currentApt.name,
              currentApt.price,
              currentApt.status,
              currentApt.scraped_at,
            ],
          );
        } else {
          // status update
          await db.run("UPDATE apartments SET last_seen = ? WHERE id = ?", [
            currentApt.scraped_at,
            apartmentId,
          ]);

          // checking changes
          if (
            existing.price !== currentApt.price ||
            existing.status !== currentApt.status
          ) {
            // print changes
            if (existing.price !== currentApt.price) {
              console.log(
                `price change ${currentApt.name}: ${existing.price} PLN -> ${currentApt.price} PLN`,
              );
            }

            // status change
            if (existing.status !== currentApt.status) {
              console.log(
                `status change ${currentApt.name}: ${existing.status} -> ${currentApt.status}`,
              );
            }

            // saving changes
            await db.run(
              `INSERT INTO price_history (apartment_id, old_price, new_price, old_status, new_status, change_date) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                apartmentId,
                existing.price,
                currentApt.price,
                existing.status,
                currentApt.status,
                currentApt.scraped_at,
              ],
            );

            await db.run(
              `UPDATE apartments SET price = ?, status = ? WHERE id = ?`,
              [currentApt.price, currentApt.status, apartmentId],
            );
          }
        }
      }
    } catch (error) {
      console.error(`Error ${task.name}:`, error);
    }
  }

  console.log("\nScraping completed. Closing browser.");
  await browser.close();
}

run();
