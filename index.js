const API = "https://api.tcgdex.net/v2/en/"

const form = document.getElementById("search")
const input = document.getElementById("card-id")
const status = document.getElementById("status")
const card = document.getElementById("card")
const illustrations = document.getElementById("illustrations")
const gallery = document.getElementById("gallery")

function loadCard(url, notFoundMessage) {
    status.textContent = "Loading..."
    card.hidden = true
    illustrations.hidden = true

    return fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`${notFoundMessage} (${response.status})`)
            return response.json()
        })
        .then(data => {
            input.value = data.id
            displayCard(data)
            status.textContent = ""
            return fetchIllustrations(data)
        })
        .catch(error => {
            console.error(error)
            status.textContent = error.message
        })
}

function fetchCard(id) {
    return loadCard(API + "cards/" + encodeURIComponent(id), `Card "${id}" not found`)
}

function fetchRandomCard() {
    return loadCard(API + "random/card", "Could not get a random card")
}

function fetchJson(url) {
    return fetch(url).then(response => response.json())
}

// Every card featuring the same Pokémon across all sets: name variants
// (V, VMAX, ex, Radiant, Blaine's...), full arts, alt arts and reprints.
// Trainers and Energy have no Pokédex number, so they match on exact name.
function fetchIllustrations(data) {
    const requests = data.dexId?.length
        ? data.dexId.map(dex => fetchJson(API + "cards?dexId=eq:" + dex))
        : [fetchJson(API + "cards?name=eq:" + encodeURIComponent(data.name))]

    return Promise.all(requests)
        .then(results => {
            // Tag team cards (e.g. Reshiram & Charizard) appear in several lists
            const unique = new Map()
            for (const c of results.flat()) unique.set(c.id, c)
            displayIllustrations(data, [...unique.values()])
        })
        .catch(error => console.error(error))
}

function displayIllustrations(current, cards) {
    // Some cards in the database have no scan yet
    const withImages = cards.filter(c => c.image)
    document.getElementById("illustrations-title").textContent =
        `All illustrations (${withImages.length})`

    // Group by card name, current card's name first
    const groups = new Map([[current.name, []]])
    for (const c of withImages) {
        if (!groups.has(c.name)) groups.set(c.name, [])
        groups.get(c.name).push(c)
    }

    gallery.innerHTML = ""
    for (const [name, group] of groups) {
        if (group.length === 0) continue

        const heading = document.createElement("h3")
        heading.textContent = `${name} (${group.length})`
        gallery.appendChild(heading)

        const grid = document.createElement("div")
        grid.className = "grid"
        for (const c of group) {
            const img = document.createElement("img")
            img.src = `${c.image}/low.webp`
            img.alt = `${c.name} ${c.id}`
            img.title = c.id
            img.loading = "lazy"
            if (c.id === current.id) img.classList.add("current")
            img.addEventListener("click", () => {
                fetchCard(c.id)
                window.scrollTo({ top: 0, behavior: "smooth" })
            })
            grid.appendChild(img)
        }
        gallery.appendChild(grid)
    }

    illustrations.hidden = withImages.length === 0
}

function formatPrice(value, unit) {
    if (value == null) return "—"
    return new Intl.NumberFormat("en", { style: "currency", currency: unit }).format(value)
}

// Pulls the useful numbers out of data.pricing
function getPrices(pricing) {
    const rows = []
    if (!pricing) return rows

    const tcg = pricing.tcgplayer
    if (tcg) {
        // tcgplayer has one entry per variant: normal, holofoil, reverse-holofoil, ...
        for (const [variant, p] of Object.entries(tcg)) {
            if (typeof p !== "object" || p === null) continue
            rows.push({
                source: "TCGplayer",
                variant,
                market: formatPrice(p.marketPrice, tcg.unit),
                range: `${formatPrice(p.lowPrice, tcg.unit)} – ${formatPrice(p.highPrice, tcg.unit)}`
            })
        }
    }

    const cm = pricing.cardmarket
    if (cm) {
        rows.push({
            source: "Cardmarket",
            variant: "normal",
            market: formatPrice(cm.trend, cm.unit),
            range: `avg ${formatPrice(cm.avg, cm.unit)}, low ${formatPrice(cm.low, cm.unit)}`
        })
        if (cm["trend-holo"] != null) {
            rows.push({
                source: "Cardmarket",
                variant: "holo",
                market: formatPrice(cm["trend-holo"], cm.unit),
                range: `avg ${formatPrice(cm["avg-holo"], cm.unit)}, low ${formatPrice(cm["low-holo"], cm.unit)}`
            })
        }
    }

    return rows
}

function displayCard(data) {
    // data.image is a base URL; the API expects a quality + extension appended
    document.getElementById("card-image").src = data.image ? `${data.image}/high.webp` : ""
    document.getElementById("card-image").alt = data.name
    document.getElementById("card-name").textContent = data.name
    document.getElementById("card-meta").textContent =
        [data.set?.name, `#${data.localId}`, data.rarity].filter(Boolean).join(" · ")

    const rows = getPrices(data.pricing)
    const prices = document.getElementById("card-prices")
    if (rows.length === 0) {
        prices.textContent = "No pricing data available."
    } else {
        prices.innerHTML = `
            <table>
                <thead><tr><th>Source</th><th>Variant</th><th>Market</th><th>Range</th></tr></thead>
                <tbody></tbody>
            </table>`
        const tbody = prices.querySelector("tbody")
        for (const row of rows) {
            const tr = document.createElement("tr")
            for (const key of ["source", "variant", "market", "range"]) {
                const td = document.createElement("td")
                td.textContent = row[key]
                tr.appendChild(td)
            }
            tbody.appendChild(tr)
        }
    }

    card.hidden = false
}

form.addEventListener("submit", event => {
    event.preventDefault()
    const id = input.value.trim()
    if (id) fetchCard(id)
})

document.getElementById("random").addEventListener("click", fetchRandomCard)

fetchCard(input.value)
