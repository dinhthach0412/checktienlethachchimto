import { Connection, PublicKey } from "@solana/web3.js";
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import http from "http";

/* ================= CONFIGURATION ================= */
const TG_TOKEN = process.env.TG_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PORT = process.env.PORT || 3000;

// Khoảng cách quét (120s là cực kỳ an toàn cho Render Free và tránh bị RPC chặn)
const POLL_INTERVAL = 120_000; 

const bot = new TelegramBot(TG_TOKEN, { polling: false });

/* ================= WEB SERVER (KEEP-ALIVE) ================= */
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("ROAM BOT BY DINHTHACH IS RUNNING");
}).listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

/* ================= URGENT NOTIFICATION (SPAM) ================= */
async function sendUrgentAlert(chain, amount, extraInfo) {
    const messages = [
        `🚨🚨🚨 **[${chain}] ROAM NẠP POOL!!** 🚨🚨🚨\n\nSố lượng: **+${amount.toLocaleString()} ROAM**\n${extraInfo}`,
        `🔥 **GẤP! GẤP! GẤP!** 🔥\n\nPool đang mở, vào húp ngay kẻo hết!\n🔗 Link: https://weroam.xyz/`,
        `⚡ **PROJECT BY DINHTHACH** ⚡\n\nCheck ví và rút ngay! 🚀🚀🚀`
    ];

    for (const msg of messages) {
        try {
            await bot.sendMessage(CHAT_ID, msg, { parse_mode: "Markdown" });
            await new Promise(res => setTimeout(res, 800)); // Delay nhẹ tránh Telegram chặn spam
        } catch (e) {
            console.error("Telegram send error:", e.message);
        }
    }
}

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
            const diff = current - lastSolBalance;
            await sendUrgentAlert("SOLANA", diff, `💰 Tổng dư: ${current.toLocaleString()}`);
        }
        lastSolBalance = current;
        console.log(`[SOL] Balance: ${current}`);
    } catch (e) {
        console.warn("⚠️ Solana Check Failed - Skipping to next turn");
    }
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
            const contract = new ethers.Contract(BNB_TOKEN, [
                "event Transfer(address indexed from, address indexed to, uint256 value)"
            ], bscProvider);

            const events = await contract.queryFilter("Transfer", lastBnbBlock + 1, currentBlock);
            for (const e of events) {
                const { from, to, value } = e.args;
                if (from.toLowerCase() === BNB_DEV.toLowerCase() && to.toLowerCase() === BNB_POOL.toLowerCase()) {
                    const amount = Number(ethers.formatUnits(value, 18));
                    await sendUrgentAlert("BNB", amount, `🔎 Tx: https://bscscan.com/tx/${e.transactionHash}`);
                }
            }
            lastBnbBlock = currentBlock;
            console.log(`[BNB] Block: ${currentBlock}`);
        }
    } catch (e) {
        console.warn("⚠️ BNB Check Failed - Skipping to next turn");
    }
}

/* ================= MASTER LOOP (FALLBACK) ================= */
async function runBot() {
    console.log("--- Bắt đầu vòng quét mới ---");
    await checkSolana();
    await checkBNB();
    
    // Tự gọi lại sau khoảng thời gian cấu hình
    setTimeout(runBot, POLL_INTERVAL);
}

// Khởi chạy
bot.sendMessage(CHAT_ID, "🚀 **ROAM-BOT DINHTHACH** đã online!\nChế độ: Spam dồn dập.");
runBot();
