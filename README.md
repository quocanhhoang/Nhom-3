# FileShare

Ứng dụng PHP quản lý tệp riêng tư, tài khoản người dùng và liên kết tải xuống có kiểm soát.

## Chạy ứng dụng

- Cần PHP 8.1 trở lên với các extension `fileinfo`, `session` và `pgsql`.
- Đăng nhập/đăng ký sử dụng bảng PostgreSQL `public.users` đã có sẵn; ứng dụng không tự tạo hay sửa schema.
- Bảng `public.users` cần có các cột `id`, `username`, `full_name`, `email`, `password_hash`, `status` và `storage_limit`, như schema hiện tại của database `fileSharing`. `username` và `email` cần unique; role PostgreSQL mà PHP sử dụng cần quyền `SELECT` và `INSERT`.
- Cấu hình kết nối bằng `DB_HOST` (mặc định `localhost`), `DB_PORT` (mặc định `5432`), `DB_NAME` (mặc định `fileSharing`), `DB_USER` và `DB_PASSWORD`. Không lưu mật khẩu trong mã nguồn hoặc gửi mật khẩu qua chat.
- Ví dụ chạy development từ cùng terminal trên Ubuntu; lệnh `read` nhận mật khẩu trực tiếp, không echo mật khẩu ra màn hình:

  ```sh
  export DB_HOST=localhost DB_PORT=5432 DB_NAME=fileSharing DB_USER=your_postgres_user
  read -rsp "PostgreSQL password: " DB_PASSWORD; export DB_PASSWORD; echo
  php -S localhost:8000
  ```

- Với Apache/PHP-FPM, đặt các biến trên trong môi trường service/pool PHP một cách an toàn rồi reload service; không đặt mật khẩu vào URL hay repository.
- Chạy từ thư mục dự án bằng `php -S localhost:8000`.
- Mở `http://localhost:8000`. Tạo tài khoản mới hoặc đăng nhập; mật khẩu tối thiểu 10 ký tự.
- Mỗi tài khoản có thư mục mặc định và hạn mức 10 GB. Có thể đặt `FILESHARE_DATA_DIR` để chọn thư mục dữ liệu riêng nằm ngoài document root.
- Tệp được giới hạn 100 MB mặc định. Nếu dùng PHP built-in server, cấu hình `upload_max_filesize` và `post_max_size` trong `php.ini` đủ lớn (ví dụ 100M và 105M).
- Chỉ chấp nhận PDF, TXT, CSV, PNG, JPG/JPEG, GIF và WEBP; MIME thực tế được xác minh phía máy chủ.
- Metadata JSON, khóa đồng bộ và nội dung tải lên được lưu trong thư mục riêng, không thể truy cập trực tiếp qua URL. Bảo đảm tài khoản chạy PHP có quyền ghi thư mục này và không đặt nó trong thư mục public.
- Khi triển khai sau reverse proxy hoặc dùng domain cố định, đặt `FILESHARE_BASE_URL` (ví dụ `https://files.example.com`) để liên kết chia sẻ luôn trỏ đúng địa chỉ HTTPS.
- Tài khoản mới được mở đăng ký tự do. Đưa ứng dụng lên production cần HTTPS và thiết lập giới hạn tải phù hợp trên web server.
- Đăng ký ghi trực tiếp vào `public.users`: `username` được tạo từ phần trước `@` của email kèm hậu tố ngẫu nhiên, tên lưu vào `full_name`, email lưu vào `email`, hạn mức lưu vào `storage_limit`, và mật khẩu chỉ lưu dưới dạng `password_hash()`. Đăng nhập chỉ chấp nhận tài khoản có `status = 'active'`. Các API quản lý tệp cũng lọc theo ID tài khoản đang đăng nhập thay vì ID chủ sở hữu cố định.

## Dọn tệp không còn liên kết hiệu lực

Tệp chỉ đủ điều kiện dọn dẹp khi đã từng có liên kết và không còn liên kết nào đang hiệu lực.

1. Xem trước danh sách: `php cleanup.php --preview`
2. Xem danh sách lần nữa và xác nhận xóa bằng cách nhập `XOA`: `php cleanup.php --execute`

Lệnh không thể chạy qua web request; API chỉ cung cấp danh sách xem trước. Việc xóa cũng ghi lại sự kiện trong lịch sử truy cập.
