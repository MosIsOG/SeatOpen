const cheerio = require('cheerio');

const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();

const deriveStatus = (seatText, availableSeats) => {
    const text = seatText.toLowerCase();

    if (Number.isFinite(availableSeats) && availableSeats > 0) {
        return 'OPEN';
    }

    if (text.includes('full')) {
        return 'FULL';
    }

    if (text.includes('open') || text.includes('avail')) {
        return 'OPEN';
    }

    if (Number.isFinite(availableSeats) && availableSeats === 0) {
        return 'FULL';
    }

    return 'UNKNOWN';
};

const extractNumber = (text) => {
    const match = text.match(/(-?\d+)/);
    return match ? Number(match[1]) : NaN;
};

function parseSeatTable(html, targetCrns = []) {
    const $ = cheerio.load(html);
    const crnSet = new Set(targetCrns.map((crn) => crn.trim()));
    const results = [];

    $('table').each((_, table) => {
        const $table = $(table);
        const rows = $table.find('tr');
        let headerIdx = -1;
        let headers = [];

        rows.each((rowIndex, row) => {
            const $row = $(row);
            const headerCells = $row.find('th');

            if (headerCells.length && headerIdx === -1) {
                headers = headerCells
                    .map((_, th) => normalize($(th).text()).toLowerCase())
                    .get();

                if (headers.some((text) => text.includes('crn'))) {
                    headerIdx = rowIndex;
                }

                return;
            }

            if (headerIdx === -1 || rowIndex <= headerIdx) {
                return;
            }

            const cells = $row.find('td');
            if (!cells.length) {
                return;
            }

            const crnIndex = headers.findIndex((text) => text.includes('crn'));
            const seatsIndex = headers.findIndex((text) => text.includes('seat'));
            const capacityIndex = headers.findIndex((text) => text.includes('cap'));

            if (crnIndex === -1 || seatsIndex === -1) {
                return;
            }

            const crn = normalize($(cells[crnIndex]).text());
            if (!crnSet.has(crn)) {
                return;
            }

            const seatsText = normalize($(cells[seatsIndex]).text());
            const capacityText = capacityIndex >= 0 ? normalize($(cells[capacityIndex]).text()) : '';
            const availableSeats = extractNumber(seatsText);
            const capacity = extractNumber(capacityText);

            results.push({
                crn,
                seatsText,
                capacityText,
                availableSeats: Number.isNaN(availableSeats) ? null : availableSeats,
                capacity: Number.isNaN(capacity) ? null : capacity,
                status: deriveStatus(seatsText, availableSeats)
            });
        });
    });

    targetCrns.forEach((crn) => {
        if (!results.some((entry) => entry.crn === crn)) {
            results.push({ crn, status: 'NOT_FOUND' });
        }
    });

    return results;
}

module.exports = { parseSeatTable };
