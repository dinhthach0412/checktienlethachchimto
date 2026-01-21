import { Connection, PublicKey } from "@solana/web3.js";
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import http from "http";

/* ================= CONFIGURATION ================= */
const TG_TOKEN = process.env.TG_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PORT = process.env.PORT || 3000;

const POLL_INTERVAL = 120_000; // 2 phút quét 1 lần
const HEARTBEAT_INTERVAL = 2 * 60 * 60 * 1000; // 2 tiếng báo cáo 1 lần

if (!TG_TOKEN || !CHAT_ID) {
    console.error("❌ THIẾU CONFIG!");
    process.exit(1);
}

const bot = new TelegramBot(TG_TOKEN, { polling: false });

/* ================= WEB SERVER (KEEP-ALIVE) ================= */
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("ROAM BOT DINHTHACH STATUS: OK");
}).listen(PORT);

/* ================= NOTIFICATION SYSTEM ================= */

// Hàm spam khi có Pool
async function sendUrgentAlert(chain, amount, extraInfo) {
    const messages = [
        `🚨🚨🚨 **[${chain}] ROAM NẠP POOL!!** 🚨🚨🚨\n\nSố lượng: **+${amount.toLocaleString()} ROAM**\n${extraInfo}`,
        `🔥 **GẤP! GẤP! GẤP!** 🔥\n\nLink: https://weroam.xyz/`,
        `⚡ **PROJECT BY DINHTHACH** ⚡`
    ];
    for (const msg of messages) {
        try {
            await bot.sendMessage(CHAT_ID, msg, { parse_mode: "Markdown" });
            await new Promise(res => setTimeout(res, 800));
        } catch (e) { console.error("Lỗi gửi tin spam"); }
    }
}

// Báo cáo định kỳ (Heartbeat)
setInterval(async () => {
    try {
        await bot.sendMessage(CHAT_ID, "😎 Anh Thạch đẹp trai, em đang làm việc chăm chỉ đây, mọi thứ đang chạy rất tốt! ✅");
    } catch (e) { console.error("Lỗi gửi heartbeat"); }
}, HEARTBEAT_INTERVAL);

/* ================= SOLANA LOGIC ================= */
const SOL_RPC = "https://api.mainnet-beta.solana.com";
const solConn = new Connection(SOL_RPC, "confirmed");
const SOL_POOL_ACC = new PublicKey("rVbzVr3ewmAn2YTD88KvsiKhfkxDngvGoh8DrRzmU5X");
let lastSolBalance = null;

async function checkSolana() {
    try {
        const res = await solConn.getTokenAccountBalance(SOL_POOL_ACC);
        const current = res?.value?.uiAmount ?? 0;
        if (lastSolBalance !== null && current > lastSolBalance + 10) {
            await sendUrgentAlert("SOLANA", current - lastSolBalance, `💰 Tổng dư: ${current.toLocaleString()}`);
        }
        lastSolBalance = current;
    } catch (e) { console.log("Solana lag..."); }
}

/* ================= BNB LOGIC ================= */
const BSC_HTTP = "https://bsc.publicnode.com";
const bscProvider = new ethers.JsonRpcProvider(BSC_HTTP);
const BNB_TOKEN = "0x3fefe29da25bea166fb5f6ade7b5976d2b0e586b";
const BNB_POOL = "0xEf74d1FCEEA7d142d7A64A6AF969955839A17B83";
const BNB_DEV = "0x5555601c3f86d0fF98b3a09C17fe5E0C597EC0Ce";
let lastBnbBlock = null;

async function checkBNB() {
    try {
        const currentBlock = await bscProvider.getBlockNumber();
        if (lastBnbBlock === null) {
            lastBnbBlock = currentBlock;
        } else if (currentBlock > lastBnbBlock) {
            const contract = new ethers.Contract(BNB_TOKEN, ["event Transfer(address indexed from, address indexed to, uint256 value)"], bscProvider);
            const events = await contract.queryFilter("Transfer", lastBnbBlock + 1, currentBlock);
            for (const e of events) {
                const { from, to, value } = e.args;
                if (from.toLowerCase() === BNB_DEV.toLowerCase() && to.toLowerCase() === BNB_POOL.toLowerCase()) {
                    const amount = Number(ethers.formatUnits(value, 18));
                    await sendUrgentAlert("BNB", amount, `🔎 Tx: https://bscscan.com/tx/${e.transactionHash}`);
                }
            }
            lastBnbBlock = currentBlock;
        }
    } catch (e) { console.log("BNB lag..."); }
}

/* ================= SYSTEM HANDLER (BÁO SẬP) ================= */

// Khi bot khởi động lại
bot.sendMessage(CHAT_ID, "🚀 **BOT DINHTHACH ĐÃ ONLINE!**\nEm đã sẵn sàng soi Pool cho anh.");

// Khi có lỗi cực nặng làm sập bot
process.on('uncaughtException', async (err) => {
    try {
        await bot.sendMessage(CHAT_ID, "❌ **ANH THẠCH ƠI, EM SẬP RỒI!**\nLỗi: " + err.message + "\nAnh kiểm tra lại Render nhé.");
    } catch (e) {}
    process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
    console.error("Lỗi không xác định:", reason);
});

/* ================= VÒNG LẶP CHÍNH ================= */
async function runBot() {
    await checkSolana();
    await checkBNB();
    setTimeout(runBot, POLL_INTERVAL);
}

runBot();
