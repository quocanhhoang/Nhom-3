(() => {
    const panels = [...document.querySelectorAll(".view-panel")];
    const navLinks = [...document.querySelectorAll(".nav-link[data-view]")];
    const breadcrumb = document.getElementById("breadcrumb-current");
    const allFileRows = document.getElementById("all-file-rows");
    const recentFileRows = document.getElementById("recent-file-rows");
    const toast = document.getElementById("toast");
    const fileInput = document.getElementById("file-input");
    const fileNameInput = document.getElementById("file-name");
    const selectedFile = document.getElementById("selected-file");
    let toastTimer;
    let selectedUpload = null;
    const revokedLinks = new Set();

    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add("visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
    };

    const formatSize = (bytes) => {
        if (!Number.isFinite(bytes) || bytes <= 0) return "Kích thước không xác định";
        if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getIconType = (name) => {
        const extension = name.split(".").pop().toLowerCase();
        if (["doc", "docx"].includes(extension)) return ["word", "W"];
        if (extension === "pdf") return ["pdf", "P"];
        if (["xls", "xlsx", "csv"].includes(extension)) return ["excel", "X"];
        return ["word", "F"];
    };

    const activateView = (viewName) => {
        const target = document.getElementById(`${viewName}-view`);
        if (!target) return;
        panels.forEach((panel) => panel.classList.toggle("active", panel === target));
        navLinks.forEach((link) => link.classList.toggle("active", link.dataset.view === viewName));
        breadcrumb.textContent = {
            dashboard: "Tổng quan",
            files: "Tệp của tôi",
            upload: "Tải tệp lên",
            shared: "Chi tiết tệp",
        }[viewName] || "Tổng quan";
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const renderAllFiles = () => {
        allFileRows.innerHTML = "";
        [...recentFileRows.querySelectorAll(".file-row")].forEach((row) => {
            allFileRows.append(row.cloneNode(true));
        });
    };

    const setSelectedFile = (file) => {
        selectedUpload = file;
        fileNameInput.value = file.name;
        const [iconType, iconLetter] = getIconType(file.name);
        selectedFile.innerHTML = `<span class="file-icon ${iconType}"><span>${iconLetter}</span></span><span><strong></strong><small></small></span>`;
        selectedFile.querySelector("strong").textContent = file.name;
        selectedFile.querySelector("small").textContent = formatSize(file.size);
        selectedFile.hidden = false;
    };

    document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
        link.addEventListener("click", () => activateView(link.dataset.view));
    });

    document.querySelectorAll("[data-open-upload]").forEach((button) => {
        button.addEventListener("click", () => activateView("upload"));
    });
    document.querySelectorAll("[data-open-files]").forEach((button) => {
        button.addEventListener("click", () => activateView("files"));
    });

    const openFileDetails = (event) => {
        if (event.target.closest(".row-menu")) {
            showToast("Các tùy chọn tệp sẽ hiển thị tại đây.");
            return;
        }
        const row = event.target.closest(".file-row");
        if (!row) return;
        const name = row.dataset.filename;
        const [iconType, iconLetter] = getIconType(name);
        const accessBadge = row.querySelector(".access-badge");
        const access = accessBadge.classList.contains("private") ? "private" : "public";
        const linkRevoked = revokedLinks.has(name);
        const linkToggle = document.querySelector(".link-setting-row .toggle");
        const detailBadge = document.getElementById("detail-access");
        const fileIcon = document.getElementById("detail-file-icon");
        document.getElementById("detail-file-name").textContent = name;
        document.getElementById("detail-file-meta").textContent = `Tải lên ngày ${row.cells[1].textContent} · ${row.querySelector(".file-name small").textContent}`;
        document.getElementById("share-url").textContent = linkRevoked
            ? "Liên kết này đã bị thu hồi"
            : row.dataset.shareLink || "Liên kết chưa được tạo";
        document.getElementById("share-description").textContent = linkRevoked
            ? "Liên kết chia sẻ đã bị thu hồi và không còn truy cập được."
            : access === "public"
            ? "Ai có liên kết đều có thể xem và tải tệp này."
            : "Chỉ những người được cấp quyền mới có thể truy cập tệp này.";
        fileIcon.className = `file-icon ${iconType}`;
        fileIcon.innerHTML = `<span>${iconLetter}</span>`;
        detailBadge.className = `access-badge ${access}`;
        detailBadge.innerHTML = `<i></i>${access === "public" ? "Công khai" : "Riêng tư"}`;
        document.getElementById("revoke-link").disabled = linkRevoked;
        linkToggle.classList.toggle("on", !linkRevoked);
        document.querySelector(".link-setting-row small").textContent = linkRevoked ? "Liên kết đã bị thu hồi" : "Đã tạo liên kết chia sẻ";
        activateView("shared");
    };
    recentFileRows.addEventListener("click", openFileDetails);
    allFileRows.addEventListener("click", openFileDetails);
    renderAllFiles();

    fileInput.addEventListener("change", () => {
        const [file] = fileInput.files;
        if (file) setSelectedFile(file);
    });

    const dropzone = document.getElementById("dropzone");
    ["dragenter", "dragover"].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropzone.classList.add("dragover");
        });
    });
    ["dragleave", "drop"].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropzone.classList.remove("dragover");
        });
    });
    dropzone.addEventListener("drop", (event) => {
        const [file] = event.dataTransfer.files;
        if (file) setSelectedFile(file);
    });

    document.querySelectorAll('input[name="access"]').forEach((radio) => {
        radio.addEventListener("change", () => {
            document.querySelectorAll(".radio-card").forEach((card) => card.classList.toggle("selected", card.contains(radio) && radio.checked));
        });
    });

    document.getElementById("upload-form").addEventListener("submit", (event) => {
        event.preventDefault();
        if (!fileNameInput.value.trim()) {
            fileNameInput.focus();
            showToast("Vui lòng nhập tên tệp.");
            return;
        }

        const name = fileNameInput.value.trim();
        const access = document.querySelector('input[name="access"]:checked').value;
        const date = new Intl.DateTimeFormat("vi-VN").format(new Date());
        const [iconType, iconLetter] = getIconType(name);
        const row = document.createElement("tr");
        row.className = "file-row";
        row.dataset.filename = name;
        row.dataset.shareLink = `https://fileshare.vn/f/${Date.now().toString(36)}`;
        row.innerHTML = `<td><span class="file-name"><span class="file-icon ${iconType}"><span>${iconLetter}</span></span><span><strong></strong><small></small></span></span></td><td>${date}</td><td><span class="access-badge ${access}"><i></i>${access === "public" ? "Công khai" : "Riêng tư"}</span></td><td>0 lượt</td><td><button class="row-menu" type="button" aria-label="Tùy chọn tệp">···</button></td>`;
        row.querySelector(".file-name strong").textContent = name;
        row.querySelector(".file-name small").textContent = selectedUpload ? formatSize(selectedUpload.size) : "Chưa có kích thước";
        recentFileRows.prepend(row);
        document.getElementById("nav-file-count").textContent = recentFileRows.querySelectorAll(".file-row").length;
        renderAllFiles();
        event.currentTarget.reset();
        fileNameInput.value = "";
        selectedUpload = null;
        selectedFile.hidden = true;
        activateView("files");
        showToast("Đã thêm tệp vào danh sách xem trước.");
    });

    document.getElementById("file-search").addEventListener("input", (event) => {
        const search = event.target.value.trim().toLocaleLowerCase("vi");
        allFileRows.querySelectorAll(".file-row").forEach((row) => {
            row.hidden = !row.dataset.filename.toLocaleLowerCase("vi").includes(search);
        });
    });

    document.getElementById("copy-link").addEventListener("click", async (event) => {
        const link = document.getElementById("share-url").textContent;
        if (!navigator.clipboard?.writeText) {
            showToast("Trình duyệt không hỗ trợ sao chép tự động. Hãy chọn và sao chép liên kết.");
            return;
        }
        try {
            await navigator.clipboard.writeText(link);
            event.currentTarget.innerHTML = "✓ Đã sao chép";
            window.setTimeout(() => {
                event.currentTarget.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>Sao chép';
            }, 1800);
            showToast("Đã sao chép liên kết chia sẻ.");
        } catch (error) {
            showToast("Không thể sao chép tự động. Hãy chọn và sao chép liên kết.");
        }
    });

    document.getElementById("add-user-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const emailInput = document.getElementById("user-email");
        const email = emailInput.value.trim();
        const alreadyAdded = [...document.querySelectorAll("#permission-list small")].some((item) => item.textContent.toLowerCase() === email.toLowerCase());
        if (alreadyAdded) {
            showToast("Địa chỉ email này đã được cấp quyền.");
            return;
        }

        const user = document.createElement("div");
        user.className = "permission-user";
        user.innerHTML = '<span class="mini-avatar user-c"></span><span><strong></strong><small></small></span><span class="permission-check" aria-label="Được cấp quyền">✓</span>';
        user.querySelector(".mini-avatar").textContent = email.slice(0, 2).toUpperCase();
        user.querySelector("strong").textContent = email.split("@")[0];
        user.querySelector("small").textContent = email;
        document.getElementById("permission-list").append(user);
        const count = document.querySelectorAll("#permission-list .permission-user").length;
        document.getElementById("permission-count").textContent = `${count} người`;
        emailInput.value = "";
        showToast("Đã thêm người dùng vào danh sách chia sẻ.");
    });

    document.getElementById("revoke-link").addEventListener("click", () => {
        const fileName = document.getElementById("detail-file-name").textContent;
        revokedLinks.add(fileName);
        document.getElementById("share-url").textContent = "Liên kết này đã bị thu hồi";
        document.getElementById("share-description").textContent = "Liên kết chia sẻ đã bị thu hồi và không còn truy cập được.";
        document.querySelector(".link-setting-row .toggle").classList.remove("on");
        document.querySelector(".link-setting-row small").textContent = "Liên kết đã bị thu hồi";
        document.getElementById("revoke-link").disabled = true;
        showToast("Đã thu hồi liên kết chia sẻ.");
    });

    document.getElementById("help-link").addEventListener("click", (event) => {
        event.preventDefault();
        showToast("Trung tâm trợ giúp sẽ sớm có mặt.");
    });

    document.querySelectorAll(".search-button, .notification-button, .storage-upgrade, .more-button, .filter-button, .profile-card, .activity-link").forEach((button) => {
        button.addEventListener("click", () => showToast("Tính năng này sẽ sớm có mặt."));
    });
})();