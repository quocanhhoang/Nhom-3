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
# Git và Github:
git remote -v: Kiểm tra project đang liên kết với repo GitHub nào.
git remote set-url origin https://github.com/quocanhhoang/PTPMMNM-CNTT1812-NHOM-3.git: Cập nhật remote sau khi đổi tên repo
git clone https://github.com/quocanhhoang/PTPMMNM-CNTT1812-NHOM-3.git: clone project từ github về máy
git checkout -b <tên-branch>: tạo nhánh cá nhân
git push -u origin <tên-branch>: Push branch lên github
'git checkout main' và 'git pull origin main': Cập nhật main
git checkout <tên-branch>: Quay lại branch riêng
git merge <main>: ghép code từ main vào branch cá nhân (chỉ dùng sau khi checkout về branch của mình)
# Docker:
curl -fsSL https://get.docker.com | sudo SBX=1 sh: cài đặt
docker --version: xem version
sudo docker run hello-world: test docker (Hello from Docker! là thành công)
sudo usermod -aG docker $USER: Cấp quyền Docker cho user (group phải xuất hiện docker)
docker ps -a: xem container
docker rm <id>: xoá container
docker rmi <name>: xoá image
# Database
sudo -u postgres psql: Đăng nhập PostgreSQL
\du: Kiểm tra role
* Từ đoạn này phải dùng lệnh sudo -u postgres psql thì mới dùng được những lệnh trong postgre
'CREATE DATABASE "fileSharing";': Tạo database
\c "fileSharing": Kết nối database
\dt: Xem danh sách bảng
\d users: Xem cấu trúc bảng
'INSERT INTO users (...);': Thêm dữ liệu mẫu
'SELECT * FROM users;': Truy vấn dữ liệu. Sau khi truy vấn xong, muốn thoát nhấn nút 'q'
\q: thoát postgre
