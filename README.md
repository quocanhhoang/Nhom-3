# Nhom-3
Học lập trình web bằng PHP
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
