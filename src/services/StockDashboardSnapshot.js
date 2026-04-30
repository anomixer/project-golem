const fs = require('fs');
const path = require('path');

const SNAPSHOT_DIR = path.resolve(process.cwd(), 'data', 'dashboard');
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, 'stock-dashboard-snapshot.json');
const MAX_SNAPSHOT_BYTES = 700 * 1024;

let memorySnapshot = null;

function ensureStorage() {
    if (!fs.existsSync(SNAPSHOT_DIR)) {
        fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    }
}

function trimSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const cloned = JSON.parse(JSON.stringify(snapshot));
    if (Array.isArray(cloned.watchlist)) cloned.watchlist = cloned.watchlist.slice(0, 30);
    if (Array.isArray(cloned.quoteErrors)) cloned.quoteErrors = cloned.quoteErrors.slice(0, 20);
    return cloned;
}

function saveStockSnapshot(snapshot) {
    const safeSnapshot = trimSnapshot(snapshot);
    if (!safeSnapshot) {
        throw new Error('Invalid stock dashboard snapshot');
    }
    const payload = {
        ...safeSnapshot,
        savedAt: new Date().toISOString(),
    };
    const raw = JSON.stringify(payload, null, 2);
    if (Buffer.byteLength(raw, 'utf8') > MAX_SNAPSHOT_BYTES) {
        throw new Error('Stock dashboard snapshot is too large');
    }
    ensureStorage();
    fs.writeFileSync(SNAPSHOT_PATH, raw, 'utf8');
    memorySnapshot = payload;
    return payload;
}

function readStockSnapshot() {
    if (memorySnapshot) return memorySnapshot;
    try {
        if (!fs.existsSync(SNAPSHOT_PATH)) return null;
        const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        memorySnapshot = parsed;
        return parsed;
    } catch (error) {
        console.warn('[StockSnapshot] Failed to read stock dashboard snapshot:', error.message);
        return null;
    }
}

function buildStockSnapshotInjection(snapshot = readStockSnapshot()) {
    if (!snapshot) {
        return [
            '[Dashboard Stock Snapshot]',
            '目前沒有可用的股市看板快照。請先開啟 Dashboard 的「股市分析」頁，等待行情載入後再要求分析。',
        ].join('\n');
    }

    return [
        '[Dashboard Stock Snapshot]',
        '以下是 Dashboard「股市分析」頁最近同步的結構化看板資料。請以此為主要資料來源，並說明資料時間與限制。',
        JSON.stringify(snapshot, null, 2),
    ].join('\n');
}

module.exports = {
    SNAPSHOT_PATH,
    saveStockSnapshot,
    readStockSnapshot,
    buildStockSnapshotInjection,
};
