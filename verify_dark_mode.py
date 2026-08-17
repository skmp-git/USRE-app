import asyncio
from playwright.async_api import async_playwright

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1600, 'height': 1200})

        # Go to app
        await page.goto("http://localhost:8501", timeout=60000)
        await page.wait_for_timeout(5000)

        # Tab 1
        await page.screenshot(path="dark_tab_1.png", full_page=True)
        print("Tab 1 screenshot saved to dark_tab_1.png")

        # Tab 2
        tab2 = page.get_by_text("Tab 2: Treasury Yield Curve & FOMC Rate Probabilities")
        await tab2.click()
        await page.wait_for_timeout(3000)
        await page.screenshot(path="dark_tab_2.png", full_page=True)
        print("Tab 2 screenshot saved to dark_tab_2.png")

        # Tab 3
        tab3 = page.get_by_text("Tab 3: Cross-Asset Correlations")
        await tab3.click()
        await page.wait_for_timeout(3000)
        await page.screenshot(path="dark_tab_3.png", full_page=True)
        print("Tab 3 screenshot saved to dark_tab_3.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
