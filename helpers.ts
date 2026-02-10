async function killPopups(page) {
    // checking page loading
    try {
        await page.waitForLoadState('domcontentloaded'); 
    } catch (e) {}

    console.log('waiting for popups...');

    // waiting for cookies
    try {
        // waititng 2 secs
        const cookieBtn = await page.waitForSelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', { state: 'visible', timeout: 2000 });
        await cookieBtn.click();
        console.log('cookies closed');
    } catch (e) {

    }
    
    // promo baner
    try {
        const promoClose = await page.waitForSelector('#AnimateBannerClose', { state: 'visible', timeout: 2000 });
        await promoClose.click();
        console.log('promotion banner closed');
    } catch (e) {}

    // call banner
    try {
        const phoneBtn = await page.waitForSelector('[data-test="widget-close-btn"]', { state: 'visible', timeout: 2000 });
        await phoneBtn.click();
        console.log('call banner closed');
    } catch (e) {}
}

function parseNumber(raw: string): number | null {
    if (!raw || raw === 'N/A') return null;
    const cleanStr = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    const result = parseFloat(cleanStr);
    return isNaN(result) ? null : result;
}

const UnitStatus = { AVAILABLE: 'AVAILABLE', RESERVED: 'RESERVED', SOLD: 'SOLD', UNKNOWN: 'UNKNOWN' } as const;
type UnitStatus = (typeof UnitStatus)[keyof typeof UnitStatus];

function normalizeStatus(raw: string): UnitStatus {
    const lower = raw.toLowerCase().trim();
    if (lower.includes('wolne')) return UnitStatus.AVAILABLE;
    if (lower.includes('rezerwacja') || lower.includes('zarezerwowane')) return UnitStatus.RESERVED;
    if (lower.includes('sprzedane')) return UnitStatus.SOLD;
    return UnitStatus.UNKNOWN;
}
export { killPopups, parseNumber, normalizeStatus, UnitStatus };

