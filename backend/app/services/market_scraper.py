import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

async def get_market_data():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto("https://www.casablanca-bourse.com/fr/live-market/overview", wait_until="load", timeout=60000)
        except Exception as e:
            print(f"Error navigating to page: {e}")
            await browser.close()
            return None

        cookie_button_selector = 'button:has-text("J\'accepte")'
        try:
            await page.click(cookie_button_selector, timeout=5000)
            print("Cookie banner accepted.")
        except Exception:
            print("Cookie banner not found or could not be clicked.")

        table_selector = 'div.grid.grid-cols-1.md\:grid-cols-2.gap-6'
        try:
            await page.wait_for_selector(table_selector, timeout=30000)
            print("Variation tables are visible.")
        except Exception as e:
            await page.screenshot(path='screenshot_error_table.png')
            print(f"Error waiting for variation tables: {e}")
            await browser.close()
            return None
        
        content = await page.content()
        await browser.close()
        
        soup = BeautifulSoup(content, 'html.parser')
        
        data = {
            "indices": [],
            "market_summary": {},
            "top_gainers": [],
            "top_losers": []
        }

        # Scrape Indices
        indices_section = soup.find('h3', string='Indices')
        if indices_section:
            indices_container = indices_section.find_next_sibling('div')
            if indices_container:
                for element in indices_container.find_all('div', class_='bg-gray-800', recursive=False):
                    name_tag = element.find('p', class_='text-sm leading-5 font-medium text-white')
                    value_tag = element.find('h3', class_='text-2xl leading-8 font-semibold text-white')
                    variation_tags = element.find_all('p', class_='text-xs leading-5 font-bold')
                    
                    if name_tag and value_tag and len(variation_tags) >= 2:
                        data['indices'].append({
                            'name': name_tag.get_text(strip=True),
                            'value': value_tag.get_text(strip=True),
                            'variation_points': variation_tags[0].get_text(strip=True),
                            'variation_percent': variation_tags[1].get_text(strip=True)
                        })

        # Scrape Market Summary
        summary_elements = soup.find_all('div', class_='bg-gray-800 py-6 px-4 text-white rounded-lg relative')
        for element in summary_elements:
            title_element = element.find('p', class_='text-white mb-[30px]')
            value_element = element.find('h4')
            if title_element and value_element:
                title = title_element.get_text(strip=True)
                value = value_element.get_text(strip=True).replace('MAD', '').strip()
                if 'Volume global' in title:
                    data['market_summary']['volume'] = value
                elif 'Capitalisation' in title:
                    data['market_summary']['capitalization'] = value
        
        # Scrape Top Gainers and Losers
        variation_section = soup.find('h3', string='Plus fortes variations')
        if variation_section:
            variation_container = variation_section.find_next_sibling('div')
            variation_tables = variation_container.select('div.relative')
            
            if len(variation_tables) > 0:
                # Plus fortes hausses
                for row in variation_tables[0].select('tbody tr'):
                    cols = row.find_all('td')
                    if len(cols) == 4:
                        data['top_gainers'].append({
                            'name': cols[0].get_text(strip=True),
                            'price': cols[1].get_text(strip=True),
                            'diff_mad': cols[2].get_text(strip=True),
                            'diff_percent': cols[3].get_text(strip=True)
                        })
                
                # Plus fortes baisses
                if len(variation_tables) > 1:
                    for row in variation_tables[1].select('tbody tr'):
                        cols = row.find_all('td')
                        if len(cols) == 4:
                            data['top_losers'].append({
                                'name': cols[0].get_text(strip=True),
                                'price': cols[1].get_text(strip=True),
                                'diff_mad': cols[2].get_text(strip=True),
                                'diff_percent': cols[3].get_text(strip=True)
                            })
        
        return data

async def main():
    market_data = await get_market_data()
    import json
    if market_data:
        with open("market_data.json", "w", encoding="utf-8") as f:
            json.dump(market_data, f, indent=2, ensure_ascii=False)
        print("Scraping successful. Data saved to market_data.json")
    else:
        print("Scraping failed.")

if __name__ == '__main__':
    asyncio.run(main())
