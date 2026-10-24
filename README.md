# Nhom-3
Học lập trình web bằng PHP

## Lưu tệp vào PostgreSQL

- Cấu hình kết nối PostgreSQL trong `config/database.php`.
- Giao diện hiện lưu tệp cho người dùng có ID `2` trong bảng `users`. Có thể đổi ID bằng biến môi trường `FILESHARE_OWNER_ID`.
- Chạy ứng dụng qua PHP server, ví dụ: `php -S localhost:8000`, rồi mở `http://localhost:8000`.
- PHP cần bật các extension `pgsql` và `fileinfo`; giới hạn tải lên của PHP (`upload_max_filesize`, `post_max_size`) cần cho phép tệp tối đa 100 MB.
- Nội dung tệp được lưu bên ngoài thư mục web, mặc định ở thư mục `../<tên-thư-mục-dự-án>-storage/uploads`. Có thể đổi bằng `FILESHARE_STORAGE_DIR`; tài khoản chạy PHP cần quyền ghi vào thư mục này.
- `files` lưu metadata, `activity_logs` lưu hoạt động tải lên, và `file_permissions` lưu quyền chia sẻ theo email của tài khoản đã đăng ký.
- Liên kết tải hoạt động cho tệp công khai, có kiểm tra trạng thái, ngày hết hạn và giới hạn lượt tải. Ứng dụng chưa có đăng nhập; không đưa giao diện/API lên môi trường công khai trước khi bổ sung xác thực người dùng. Quyền riêng tư hiện chưa được dùng để xác thực người tải xuống.
