const fs = require('fs')
const https = require('https')
const puppeteer = require('puppeteer');

const API_KEY = 'RYAQHF10PKFAUTE6ZWEFERIZBGRY0DI2IMSXV7IUFHYWTLLH2KOO4I9LPOAVV646L4AAB4PULMX4CEQEUX9ZYQB632T4T9E123US'
const ME = 'user98219280187'
const JESSICA = 'user73379190824'
const USERS = [ME, JESSICA]

const URLS = [
    ["BrightSite", "https://185.webclimber.de/de/booking/offer/bouldern-im-aussenbereich"],
    ["Suedbloc", "https://141.webclimber.de/de/booking/offer/aussenbereich-boulderzeit"]
]

async function checkSite(page, url) {
    await page.goto(url);
    await page.waitForSelector('#bookingCalendar');
    const { length } = await page.$$("#bookingCalendar .day:not(.disabled)")
    return length
}

async function sendRequest(body) {

    const data = JSON.stringify(body)
    console.log(JSON.stringify(body, null, 2))

    const options = {
        hostname: 'api.spontit.com',
        port: 443,
        path: '/v3/push',
        method: 'POST',
        headers: {
            'X-Authorization': API_KEY,
            'X-UserId': ME,
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    }

    const req = https.request(options, res => {
        console.log(`statusCode: ${res.statusCode}`)

        res.on('data', d => {
            process.stdout.write(d)
        })
    })

    req.on('error', error => {
        console.error(error)
    })

    req.write(data)
    req.end()
}

async function notify(results, previousResults) {
    for (const boulderHall in results) {
        const count = results[boulderHall]

        if (!count || previousResults[boulderHall] === count) {
            continue
        }

        const [_, link] = URLS.find(([name]) => name === boulderHall)

        const content = `${boulderHall} has ${count} available days`

        sendRequest({
            "content": content,
            "pushTitle": "Boulder",
            "pushToFollowers": USERS,
            link
        })
    }
}

async function saveResults(results) {
    return new Promise((res, rej) => {
        fs.writeFile('./results.json', JSON.stringify(results, null, 2), (err) => {
            if (err) rej(err)
            else res()
        });
    })
}

async function getPreviousResults() {
    return new Promise((res, rej) => {
        fs.readFile('./results.json', (err, data) => {
            if (err) rej(err)
            else res(JSON.parse(data))
        });
    })
}

async function main(force) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const results = {}

    for await (let [name, url] of URLS) { // (4)
        results[name] = await checkSite(page, url)
    }

    await browser.close();

    const anyAvailabilities = Object.entries(results).some(available => available)

    if (!anyAvailabilities) {
        console.log('No availabilities')
        return
    }

    const previousResults = (force) ? {} : await getPreviousResults()
    await notify(results, previousResults)
    await saveResults(results)
}

try {
    // force notifications
    main(false)
} catch (e) {
    console.warn(e)
}

