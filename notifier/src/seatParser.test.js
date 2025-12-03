const assert = require('node:assert/strict');
const { parseSeatTable } = require('./seatParser');

const SAMPLE_HTML = `
<table>
    <tr>
        <th>CRN ?</th>
        <th>Course</th>
        <th>Title</th>
        <th>Schedule Type ?</th>
        <th>Modality</th>
        <th>Cr Hrs</th>
        <th>Seats</th>
        <th>Capacity ?</th>
    </tr>
    <tr>
        <td>13470</td>
        <td>CS-3214</td>
        <td>Computer Systems</td>
        <td>L</td>
        <td>Face-to-Face Instruction</td>
        <td>3</td>
        <td>Full 0</td>
        <td>250</td>
    </tr>
    <tr>
        <td>13471</td>
        <td>CS-3214</td>
        <td>Computer Systems</td>
        <td>L</td>
        <td>Face-to-Face Instruction</td>
        <td>3</td>
        <td>Avail 14</td>
        <td>150</td>
    </tr>
</table>
`;

const results = parseSeatTable(SAMPLE_HTML, ['13470', '13471']);
const crnMap = new Map(results.map((entry) => [entry.crn, entry]));

assert.equal(crnMap.get('13470').status, 'FULL');
assert.equal(crnMap.get('13470').availableSeats, 0);

assert.equal(crnMap.get('13471').status, 'OPEN');
assert.equal(crnMap.get('13471').availableSeats, 14);

console.log('seatParser tests passed');
