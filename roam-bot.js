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

async function sendUrgentAlert(chain, amount, extraInfo) {
    const messages = [
        `🚨🚨🚨 **[${chain}] ROAM NẠP POOL!!** 🚨🚨🚨\n\nSố lượng: **+${amount.toLocaleString()} ROAM**\n${extraInfo}`,
        `🔥 **CHECK NGAY TẠI:** https://weroam.xyz/`,
        `⚡ **DỰ ÁN CỦA ANH THẠCH - TOOL VIETNAM** ⚡`
    ];
    for (const msg of messages) {
        try {
            await bot.sendMessage(CHAT_ID, msg, { parse_mode: "Markdown" });
            await new Promise(res => setTimeout(res, 800));
        } catch (e) { console.error("Lỗi gửi tin spam"); }
    }
}

// Báo cáo định kỳ
setInterval(async () => {
    try {
        await bot.sendMessage(CHAT_ID, "😎 Hệ thống BNB & SOL vẫn đang canh gác 24/7 cho anh Thạch nhé! ✅");
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
            await sendUrgentAlert("SOLANA", current - lastSolBalance, `💰 Pooled ROAM: ${current.toLocaleString()}`);
        }
        lastSolBalance = current;
    } catch (e) { console.log("Solana lag..."); }
}

/* ================= BNB LOGIC (SỬ DỤNG PAIR CONTRACT THẬT) ================= */
const BSC_HTTP = "https://binance.llamarpc.com"; 
const bscProvider = new ethers.JsonRpcProvider(BSC_HTTP);
const BNB_TOKEN = "0x3fefe29da25bea166fb5f6ade7b5976d2b0e586b";

// ĐÃ ĐỔI SANG PAIR CONTRACT ROAM/USDT (PANCAKE V3)
const BNB_POOL = "0x30D59a44930B3994c116846EFe55fC8fcF608aa8".toLowerCase();

let lastBnbBalance = null; 

async function checkBNB() {
    try {
        const contract = new ethers.Contract(BNB_TOKEN, [
            "function balanceOf(address owner) view returns (uint256)"
        ], bscProvider);

        const balanceWei = await contract.balanceOf(BNB_POOL);
        const current = Number(ethers.formatUnits(balanceWei, 18));

        if (lastBnbBalance === null) {
            lastBnbBalance = current;
            console.log(`[BNB] Khởi tạo Pooled ROAM: ${current}`);
            return;
        }

        // Nếu lượng ROAM trong Pool tăng lên (Dev nạp thanh khoản)
        if (current > lastBnbBalance + 10) {
            const diff = current - lastBnbBalance;
            await sendUrgentAlert("BNB CHAIN", diff, `📊 Tổng Pooled ROAM hiện tại: ${current.toLocaleString()}`);
        }
        
        lastBnbBalance = current;
        console.log(`[BNB] Check Pool: ${current} ROAM`);

    } catch (e) { 
        console.log("⚠️ BNB Pool đang bận, đợi lượt sau..."); 
    }
}

/* ================= SYSTEM HANDLER ================= */

bot.sendMessage(CHAT_ID, "🚀 **BOT BNB V2.5 ONLINE!**\nĐã nhắm mục tiêu vào Pool ROAM/USDT thật.");

process.on('uncaughtException', async (err) => {
    try {
        await bot.sendMessage(CHAT_ID, "❌ **SERVER CÓ BIẾN!**\nLỗi: " + err.message);
    } catch (e) {}
    process.exit(1);
});

/* ================= VÒNG LẶP CHÍNH ================= */
async function runBot() {
    await checkSolana();
    await checkBNB();
    setTimeout(runBot, POLL_INTERVAL);
}

runBot();
