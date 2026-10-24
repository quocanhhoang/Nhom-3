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
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
    let toastTimer;
    let selectedUpload = null;
    let selectedFileId = null;
    let files = [];

    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add("visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
    };

    const apiRequest = async (url, { method = "GET", body } = {}) => {
        const headers = { "X-CSRF-Token": csrfToken };
        let requestBody = body;
        if (body && !(body instanceof FormData)) {
            headers["Content-Type"] = "application/json";
            requestBody = JSON.stringify(body);
        }

        const response = await fetch(url, { method, headers, body: requestBody });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || "Yêu cầu không thành công.");
        }
        return result;
    };

    const formatSize = (bytes) => {
        if (!Number.isFinite(bytes) || bytes < 0) return "Kích thước không xác định";
        if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getIconType = (name) => {
        const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
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

    const makeCell = (text) => {
        const cell = document.createElement("td");
        cell.textContent = text;
        return cell;
    };

    const makeFileRow = (file) => {
        const row = document.createElement("tr");
        row.className = "file-row";
        row.dataset.fileId = String(file.id);
        row.dataset.filename = file.file_name;
        row.tabIndex = 0;

        const [iconType, iconLetter] = getIconType(file.file_name);
        const nameCell = document.createElement("td");
        const fileName = document.createElement("span");
        fileName.className = "file-name";
        const icon = document.createElement("span");
        icon.className = `file-icon ${iconType}`;
        const letter = document.createElement("span");
        letter.textContent = iconLetter;
        icon.append(letter);
        const copy = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = file.file_name;
        const size = document.createElement("small");
        size.textContent = formatSize(file.file_size);
        copy.append(name, size);
        fileName.append(icon, copy);
        nameCell.append(fileName);

        const access = document.createElement("span");
        access.className = `access-badge ${file.access_type === "public" ? "public" : "private"}`;
        const dot = document.createElement("i");
        access.append(dot, document.createTextNode(file.access_type === "public" ? "Công khai" : "Riêng tư"));

        const menuCell = document.createElement("td");
        const menu = document.createElement("button");
        menu.className = "row-menu";
        menu.type = "button";
        menu.setAttribute("aria-label", `Tùy chọn ${file.file_name}`);
        menu.textContent = "···";
        menuCell.append(menu);

        const accessCell = document.createElement("td");
        accessCell.append(access);
        row.append(
            nameCell,
            makeCell(new Intl.DateTimeFormat("vi-VN").format(new Date(file.created_at))),
            accessCell,
            makeCell(`${file.download_count} lượt`),
            menuCell
        );
        return row;
    };

    const renderRows = (target, list) => {
        target.replaceChildren();
        if (list.length === 0) {
            const row = document.createElement("tr");
            const cell = makeCell("Chưa có tệp nào được lưu.");
            cell.colSpan = 5;
            row.append(cell);
            target.append(row);
            return;
        }
        list.forEach((file) => target.append(makeFileRow(file)));
    };

    const renderFiles = () => {
        renderRows(recentFileRows, files.slice(0, 3));
        renderRows(allFileRows, files);
        document.getElementById("nav-file-count").textContent = String(files.length);
        document.getElementById("stat-file-count").textContent = String(files.length);
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

    const renderPermissions = (permissions) => {
        const permissionList = document.getElementById("permission-list");
        permissionList.replaceChildren();
        permissions.forEach((permission) => {
            const user = document.createElement("div");
            user.className = "permission-user";
            const avatar = document.createElement("span");
            avatar.className = "mini-avatar user-c";
            avatar.textContent = permission.email.slice(0, 2).toUpperCase();
            const copy = document.createElement("span");
            const name = document.createElement("strong");
            name.textContent = permission.full_name || permission.email.split("@")[0];
            const email = document.createElement("small");
            email.textContent = permission.email;
            copy.append(name, email);
            const check = document.createElement("span");
            check.className = "permission-check";
            check.setAttribute("aria-label", "Được cấp quyền");
            check.textContent = "✓";
            user.append(avatar, copy, check);
            permissionList.append(user);
        });
        document.getElementById("permission-count").textContent = `${permissions.length} người`;
    };

    const openFileDetails = async (event) => {
        if (event.target.closest(".row-menu")) {
            showToast("Các tùy chọn tệp sẽ hiển thị tại đây.");
            return;
        }
        const row = event.target.closest(".file-row");
        if (!row) return;

        const file = files.find((item) => item.id === Number(row.dataset.fileId));
        if (!file) return;
        selectedFileId = file.id;
        const [iconType, iconLetter] = getIconType(file.file_name);
        const isPublic = file.access_type === "public";
        const shareUrl = new URL(`download.php?code=${encodeURIComponent(file.share_code)}`, window.location.href).href;
        const isActive = file.is_link_active;
        document.getElementById("detail-file-name").textContent = file.file_name;
        document.getElementById("detail-file-meta").textContent =
            `Tải lên ngày ${new Intl.DateTimeFormat("vi-VN").format(new Date(file.created_at))} · ${formatSize(file.file_size)}`;
        document.getElementById("share-url").textContent = isActive ? shareUrl : "Liên kết này đã bị thu hồi";
        document.getElementById("share-description").textContent = !isActive
            ? "Liên kết chia sẻ đã bị thu hồi và không còn truy cập được."
            : isPublic
                ? "Ai có liên kết đều có thể tải tệp này."
                : "Tệp riêng tư không thể tải qua liên kết công khai.";
        const detailBadge = document.getElementById("detail-access");
        detailBadge.className = `access-badge ${isPublic ? "public" : "private"}`;
        detailBadge.replaceChildren(document.createElement("i"), document.createTextNode(isPublic ? "Công khai" : "Riêng tư"));
        const icon = document.getElementById("detail-file-icon");
        icon.className = `file-icon ${iconType}`;
        icon.innerHTML = `<span>${iconLetter}</span>`;
        document.getElementById("revoke-link").disabled = !isActive;
        document.querySelector(".link-setting-row .toggle").classList.toggle("on", isActive);
        document.querySelector(".link-setting-row small").textContent = isActive ? "Liên kết đang hoạt động" : "Liên kết đã bị thu hồi";
        renderPermissions([]);
        activateView("shared");

        try {
            const { permissions } = await apiRequest(`api/permissions.php?file_id=${file.id}`);
            if (selectedFileId === file.id) renderPermissions(permissions);
        } catch (error) {
            showToast(error.message);
        }
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
    recentFileRows.addEventListener("click", openFileDetails);
    allFileRows.addEventListener("click", openFileDetails);
    allFileRows.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") openFileDetails(event);
    });

    const loadFiles = async () => {
        renderRows(recentFileRows, []);
        renderRows(allFileRows, []);
        try {
            const result = await apiRequest("api/files.php");
            files = result.files;
            renderFiles();
        } catch (error) {
            renderRows(recentFileRows, []);
            renderRows(allFileRows, []);
            showToast(error.message);
        }
    };

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
            document.querySelectorAll(".radio-card").forEach((card) => {
                card.classList.toggle("selected", card.contains(radio) && radio.checked);
            });
        });
    });

    document.getElementById("upload-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!selectedUpload) {
            showToast("Vui lòng chọn tệp cần tải lên.");
            fileInput.click();
            return;
        }
        if (!fileNameInput.value.trim()) {
            fileNameInput.focus();
            showToast("Vui lòng nhập tên tệp.");
            return;
        }

        const form = event.currentTarget;
        const submitButton = form.querySelector('button[type="submit"]');
        const data = new FormData();
        data.append("file", selectedUpload);
        data.append("fileName", fileNameInput.value.trim());
        data.append("access", document.querySelector('input[name="access"]:checked').value);
        data.append("limit", document.getElementById("download-limit").value);
        data.append("expiry", document.getElementById("expiry-date").value);
        submitButton.disabled = true;

        try {
            const { file } = await apiRequest("api/upload.php", { method: "POST", body: data });
            files.unshift(file);
            renderFiles();
            form.reset();
            selectedUpload = null;
            selectedFile.hidden = true;
            document.querySelectorAll(".radio-card").forEach((card) => {
                card.classList.toggle("selected", card.querySelector('input[name="access"]').checked);
            });
            activateView("files");
            showToast("Đã lưu tệp vào cơ sở dữ liệu.");
        } catch (error) {
            showToast(error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    document.getElementById("file-search").addEventListener("input", (event) => {
        const search = event.target.value.trim().toLocaleLowerCase("vi");
        allFileRows.querySelectorAll(".file-row").forEach((row) => {
            row.hidden = !row.dataset.filename.toLocaleLowerCase("vi").includes(search);
        });
    });

    document.getElementById("copy-link").addEventListener("click", async () => {
        const link = document.getElementById("share-url").textContent;
        if (!link.startsWith("http")) {
            showToast("Liên kết này không còn khả dụng.");
            return;
        }
        if (!navigator.clipboard?.writeText) {
            showToast("Trình duyệt không hỗ trợ sao chép tự động.");
            return;
        }
        try {
            await navigator.clipboard.writeText(link);
            showToast("Đã sao chép liên kết chia sẻ.");
        } catch {
            showToast("Không thể sao chép tự động. Hãy chọn và sao chép liên kết.");
        }
    });

    document.getElementById("add-user-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!selectedFileId) {
            showToast("Vui lòng chọn tệp trước.");
            return;
        }

        const emailInput = document.getElementById("user-email");
        try {
            await apiRequest("api/permissions.php", {
                method: "POST",
                body: { file_id: selectedFileId, email: emailInput.value.trim() },
            });
            emailInput.value = "";
            const { permissions } = await apiRequest(`api/permissions.php?file_id=${selectedFileId}`);
            renderPermissions(permissions);
            showToast("Đã lưu quyền truy cập.");
        } catch (error) {
            showToast(error.message);
        }
    });

    document.getElementById("revoke-link").addEventListener("click", async () => {
        if (!selectedFileId) {
            showToast("Vui lòng chọn tệp trước.");
            return;
        }
        try {
            await apiRequest("api/revoke.php", {
                method: "POST",
                body: { file_id: selectedFileId },
            });
            const file = files.find((item) => item.id === selectedFileId);
            file.is_link_active = false;
            renderFiles();
            document.getElementById("share-url").textContent = "Liên kết này đã bị thu hồi";
            document.getElementById("share-description").textContent = "Liên kết chia sẻ đã bị thu hồi và không còn truy cập được.";
            document.querySelector(".link-setting-row .toggle").classList.remove("on");
            document.querySelector(".link-setting-row small").textContent = "Liên kết đã bị thu hồi";
            document.getElementById("revoke-link").disabled = true;
            showToast("Đã thu hồi liên kết chia sẻ.");
        } catch (error) {
            showToast(error.message);
        }
    });

    document.getElementById("help-link").addEventListener("click", (event) => {
        event.preventDefault();
        showToast("Trung tâm trợ giúp sẽ sớm có mặt.");
    });

    document.querySelectorAll(".search-button, .notification-button, .storage-upgrade, .more-button, .filter-button, .profile-card, .activity-link").forEach((button) => {
        button.addEventListener("click", () => showToast("Tính năng này sẽ sớm có mặt."));
    });

    loadFiles();
})();
