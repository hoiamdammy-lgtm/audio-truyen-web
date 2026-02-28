import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = 31932328;
const apiHash = "a19d5bd2b6e5d3db7a4e16b28272b852"; 

const stringSession = new StringSession("");

(async () => {
  console.log("Đang kết nối đến máy chủ Telegram...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Nhập số điện thoại của bạn (VD: +84965419394): "),
    password: async () => await input.text("Nhập mật khẩu 2FA (Nếu tài khoản bạn không cài mật khẩu cấp 2 thì cứ để trống rồi ấn Enter): "),
    phoneCode: async () => await input.text("Nhập mã xác nhận Telegram vừa gửi về máy bạn: "),
    onError: (err) => console.log(err),
  });

  console.log("\n=== KẾT NỐI THÀNH CÔNG! ===");
  console.log("Hãy copy toàn bộ đoạn mã lộn xộn bên dưới đây:");
  console.log("\n" + client.session.save() + "\n");
  console.log("===========================\n");
  
  process.exit(0);
})();