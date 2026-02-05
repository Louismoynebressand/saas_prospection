import { getYear, format, isSameDay, parseISO } from "date-fns"

// Fixed holidays for France (day/month)
const FIXED_HOLIDAYS_FR = [
    { day: 1, month: 1, label: "Jour de l'an" },
    { day: 1, month: 5, label: "Fête du Travail" },
    { day: 8, month: 5, label: "Victoire 1945" },
    { day: 14, month: 7, label: "Fête Nationale" },
    { day: 15, month: 8, label: "Assomption" },
    { day: 1, month: 11, label: "Toussaint" },
    { day: 11, month: 11, label: "Armistice 1918" },
    { day: 25, month: 12, label: "Noël" },
]

// Easter based holidays (variable)
function getEasterDate(year: number): Date {
    const f = Math.floor
    const G = year % 19
    const C = f(year / 100)
    const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30
    const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11))
    const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7
    const L = I - J
    const month = 3 + f((L + 40) / 44)
    const day = L + 28 - 31 * f(month / 4)
    return new Date(year, month - 1, day)
}

export interface Holiday {
    date: Date
    dateString: string // YYYY-MM-DD
    label: string
}

export function getFrenchHolidays(year: number): Holiday[] {
    const holidays: Holiday[] = []

    // 1. Fixed Holidays
    FIXED_HOLIDAYS_FR.forEach(h => {
        const date = new Date(year, h.month - 1, h.day)
        holidays.push({
            date,
            dateString: format(date, "yyyy-MM-dd"),
            label: h.label
        })
    })

    // 2. Variable Holidays (Easter based)
    const easter = getEasterDate(year)

    // Lundi de Pâques (Easter + 1 day)
    const easterMonday = new Date(easter)
    easterMonday.setDate(easter.getDate() + 1)
    holidays.push({
        date: easterMonday,
        dateString: format(easterMonday, "yyyy-MM-dd"),
        label: "Lundi de Pâques"
    })

    // Ascension (Easter + 39 days)
    const ascension = new Date(easter)
    ascension.setDate(easter.getDate() + 39)
    holidays.push({
        date: ascension,
        dateString: format(ascension, "yyyy-MM-dd"),
        label: "Ascension"
    })

    // Pentecôte (Easter + 50 days)
    const pentecost = new Date(easter)
    pentecost.setDate(easter.getDate() + 50)
    holidays.push({
        date: pentecost,
        dateString: format(pentecost, "yyyy-MM-dd"),
        label: "Lundi de Pentecôte"
    })

    return holidays.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function isHoliday(date: Date, holidaysStr?: string[]): boolean {
    const dateStr = format(date, "yyyy-MM-dd")

    // Check against custom list if provided
    if (holidaysStr && holidaysStr.includes(dateStr)) {
        return true
    }

    // Otherwise check generic french holidays logic if no custom list is provided 
    // (But typically we will pass the computed list as custom list to be efficient)
    return false
}

export function getHolidaysForRange(startYear: number, endYear: number): Holiday[] {
    let all: Holiday[] = []
    for (let y = startYear; y <= endYear; y++) {
        all = [...all, ...getFrenchHolidays(y)]
    }
    return all
}
