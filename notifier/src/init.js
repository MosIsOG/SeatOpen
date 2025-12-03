require('dotenv').config();
const axios = require('axios');
const puppeteer = require('puppeteer');
const path = require('path');
const { parseSeatTable } = require('./seatParser');

const cliFlags = new Set(process.argv.slice(2));
const runOnce = cliFlags.has('--once');
const interactiveLoginFlag = cliFlags.has('--interactive-login');

const boolFromEnv = (value, fallback = true) => {
    if (value === undefined) {
        return fallback;
    }
    return ['true', '1', 'yes'].includes(String(value).toLowerCase());
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const config = {
    pageUrl:
        process.env.COURSE_SEARCH_URL || 'https://selfservice.banner.vt.edu/ssb/HZSKVTSC.P_DispRequest',
    campusLabel: process.env.CAMPUS_LABEL || 'Blacksburg',
    termLabel: process.env.TERM_LABEL || 'Spring 2026',
    subjectLabel: process.env.SUBJECT_LABEL || 'CS - Computer Science',
    courseNumber: process.env.COURSE_NUMBER || '3214',
    selectors: {
        campus: process.env.CAMPUS_SELECTOR || 'select[name="CAMPUS"]',
        term: process.env.TERM_SELECTOR || 'select[name="TERMYEAR"]',
        subject: process.env.SUBJECT_SELECTOR || 'select[name="subj_code"]',
        courseNumber: process.env.COURSE_NUMBER_SELECTOR || 'input[name="course_number"], input[name="CRSE_NUMBER"]',
        submit: process.env.SUBMIT_SELECTOR || 'input[value="FIND class sections"]',
        results: process.env.RESULTS_SELECTOR || '#main table'
    },
    targetCrns: (process.env.TARGET_CRNS || '13470,13471')
        .split(',')
        .map((crn) => crn.trim())
        .filter(Boolean),
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 300000),
    webhookUrl: process.env.WEBHOOK_URL,
    headless: boolFromEnv(process.env.HEADLESS, true),
    interactiveLogin: boolFromEnv(process.env.INTERACTIVE_LOGIN, false) || interactiveLoginFlag,
    authTimeoutMs: Number(process.env.AUTH_TIMEOUT_MS || 180000),
    userDataDir: process.env.USER_DATA_DIR
        ? path.resolve(process.cwd(), process.env.USER_DATA_DIR)
        : undefined,
    notifyOnEveryPoll: boolFromEnv(process.env.NOTIFY_EVERY_POLL, false),
    disableSandbox: boolFromEnv(
        process.env.DISABLE_PUPPETEER_SANDBOX,
        typeof process.getuid === 'function' ? process.getuid() === 0 : false
    )
};

if (config.interactiveLogin && config.headless) {
    console.warn('INTERACTIVE_LOGIN requested; forcing HEADLESS=false for this run.');
    config.headless = false;
}

const launchArgs = [];
if (config.disableSandbox) {
    launchArgs.push('--no-sandbox', '--disable-setuid-sandbox');
}

const launchOptions = {
    headless: config.headless ? 'new' : false,
    args: launchArgs,
    userDataDir: config.userDataDir
};

const lastStatusByCrn = new Map();

async function selectOptionByText(page, selector, text) {
    await page.waitForSelector(selector, { timeout: 15000 });
    const matched = await page.evaluate((sel, optionText) => {
        const select = document.querySelector(sel);
        if (!select) {
            return false;
        }

        const options = Array.from(select.options);
        const target = options.find(
            (opt) => opt.text.trim().toLowerCase() === optionText.trim().toLowerCase()
        );

        if (!target) {
            return false;
        }

        select.value = target.value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }, selector, text);

    if (!matched) {
        throw new Error(`Unable to select "${text}" for ${selector}`);
    }
}

async function fillForm(page) {
    await selectOptionByText(page, config.selectors.campus, config.campusLabel);
    await selectOptionByText(page, config.selectors.term, config.termLabel);
    await selectOptionByText(page, config.selectors.subject, config.subjectLabel);

    await page.waitForSelector(config.selectors.courseNumber, { timeout: 15000 });
    await page.$eval(
        config.selectors.courseNumber,
        (input, value) => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        },
        config.courseNumber
    );
}

async function ensureSearchFormAvailable(page) {
    const formSelector = config.selectors.subject;
    const hasForm = await page.$(formSelector);
    if (hasForm) {
        return;
    }

    if (!config.interactiveLogin) {
        throw new Error(
            'Course search form is not visible. Run with HEADLESS=false and set INTERACTIVE_LOGIN=true (or pass --interactive-login) to log in manually, or provide an authenticated session.'
        );
    }

    console.log(
        'Login required. Complete Duo/VT sign-in inside the Chromium window; the watcher will continue once the course search form loads.'
    );

    await page.waitForSelector(formSelector, { timeout: config.authTimeoutMs });
    console.log('Detected course search form – continuing automation.');
}

async function fetchSeatStatus() {
    const browser = await puppeteer.launch(launchOptions);
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(45000);

        await page.goto(config.pageUrl, { waitUntil: 'domcontentloaded' });
        await ensureSearchFormAvailable(page);
        await fillForm(page);

        await page.click(config.selectors.submit);
        await page.waitForSelector(config.selectors.results, { timeout: 20000 });
        await delay(1000);
        const html = await page.content();
        return parseSeatTable(html, config.targetCrns);
    } finally {
        await browser.close();
    }
}

const buildWebhookPayload = (message) => {
    if (/discord\.com\/api\/webhooks/i.test(config.webhookUrl || '')) {
        return { content: message };
    }

    return { text: message };
};

async function sendWebhook(section) {
    if (!config.webhookUrl) {
        console.warn('WEBHOOK_URL not set; skipping webhook notification.');
        return;
    }

    const payload = buildWebhookPayload(
        `CRN ${section.crn} now has ${section.availableSeats ?? 'unknown'} open seat(s) for ${config.subjectLabel} ${config.courseNumber}.`
    );

    await axios.post(config.webhookUrl, payload);
}

async function checkAndNotify() {
    try {
        const sections = await fetchSeatStatus();
        const webhookPromises = [];

        sections.forEach((section) => {
            const previousStatus = lastStatusByCrn.get(section.crn);
            lastStatusByCrn.set(section.crn, section.status);

            const shouldNotify =
                section.status === 'OPEN' && (config.notifyOnEveryPoll || previousStatus !== 'OPEN');

            console.log(`[CRN ${section.crn}] Status: ${section.status} (Seats: ${section.seatsText})`);

            if (shouldNotify) {
                webhookPromises.push(
                    sendWebhook(section).catch((error) => {
                        console.error('Failed to send webhook notification', error);
                    })
                );
            }
        });

        await Promise.allSettled(webhookPromises);
    } catch (error) {
        console.error('Error while checking seat availability:', error.message);
    }
}

async function start() {
    await checkAndNotify();

    if (runOnce) {
        return;
    }

    setInterval(checkAndNotify, config.pollIntervalMs);
}

process.on('SIGINT', () => {
    console.log('Received SIGINT – exiting.');
    process.exit(0);
});

start();

