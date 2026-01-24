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

/* ================= BNB LOGIC (BẢN CẢI TIẾN - QUÉT SỐ DƯ) ================= */
// Mình thay bằng link RPC llama để tốc độ phản hồi nhanh hơn link cũ
const BSC_HTTP = "https://binance.llamarpc.com"; 
const bscProvider = new ethers.JsonRpcProvider(BSC_HTTP);
const BNB_TOKEN = "0x3fefe29da25bea166fb5f6ade7b5976d2b0e586b";
const BNB_POOL = "0xEf74d1FCEEA7d142d7A64A6AF969955839A17B83";

// Thay đổi từ theo dõi Block sang theo dõi Số dư
let lastBnbBalance = null; 

async function checkBNB() {
    try {
        const contract = new ethers.Contract(BNB_TOKEN, [
            "function balanceOf(address owner) view returns (uint256)"
        ], bscProvider);

        // Lấy số dư hiện tại của ví Pool
        const balanceWei = await contract.balanceOf(BNB_POOL);
        const current = Number(ethers.formatUnits(balanceWei, 18));

        // Khởi tạo số dư lần đầu khi bot chạy
        if (lastBnbBalance === null) {
            lastBnbBalance = current;
            console.log(`[BNB] Khởi tạo số dư: ${current}`);
            return;
        }

        // Nếu số dư tăng lên (ví dụ nạp thêm trên 10 ROAM)
        if (current > lastBnbBalance + 10) {
            const diff = current - lastBnbBalance;
            // Kích hoạt spam báo về điện thoại của bạn
            await sendUrgentAlert("BNB", diff, `💰 Tổng dư ví Pool: ${current.toLocaleString()} ROAM`);
        }
        
        lastBnbBalance = current;
        console.log(`[BNB] Cập nhật số dư: ${current}`);

    } catch (e) { 
        // Nếu mạng lag, bot chỉ ghi log chứ không sập (fallback)
        console.log("⚠️ BNB lag hoặc RPC quá tải... Đang đợi lượt sau."); 
    }
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
