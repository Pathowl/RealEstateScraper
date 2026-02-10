import { open, Database } from 'sqlite'; // <--- WAŻNE: Importujemy typ 'Database'
import sqlite3 from 'sqlite3';

async function setupDatabase() {
    const db = await open({
        filename: './nieruchomosci.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS apartments (
            id TEXT PRIMARY KEY,
            investment_name TEXT,
            name TEXT,
            price REAL,
            area REAL,
            rooms INTEGER,
            floor INTEGER,
            status TEXT,
            last_seen TEXT
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            apartment_id TEXT,
            old_price REAL,
            new_price REAL,
            old_status TEXT,
            new_status TEXT,
            change_date TEXT
        )
    `);

    return db;
}

export { setupDatabase };