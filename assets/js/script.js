(() => {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const panels = $$(".view-panel");
    const navLinks = $$(".nav-link[data-view]");
    const allRows = $("#all-file-rows");
    const recentRows = $("#recent-file-rows");
    const toast = $("#toast");
    const authOverlay = $("#auth-overlay");
    const authForm = $("#auth-form");
    const authError = $("#auth-error");
    const fileInput = $("#file-input");
    const fileNameInput = $("#file-name");
    const selectedFile = $("#selected-file");
    const themeToggle = $("#theme-toggle");
    const themeColor = $('meta[name="theme-color"]');
    const searchToggle = $("#global-search-toggle");
    const searchPanel = $("#global-search-panel");
    const searchInput = $("#global-search-input");
    const searchResults = $("#global-search-results");
    const searchCaption = $("#search-result-caption");
    const notificationToggle = $("#notification-toggle");
    const notificationPanel = $("#notification-panel");
    const notificationList = $("#notification-list");
    const notificationCount = $("#notification-count");
    const notificationIndicator = $("#notification-indicator");
    const notifications = [];
    let toastTimer;
    let csrfToken = "";
    let authMode = "login";
    let selectedUpload = null;
    let activeFileId = null;
    let activeLinkId = null;
    let files = [];
    let folders = [];
    let links = [];
    let audit = [];

    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add("visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
    };

    const request = async (action, { method = "GET", body, formData = false } = {}) => {
        const headers = {};
        if (method !== "GET") {
            headers["X-CSRF-Token"] = csrfToken;
            if (body && !formData) headers["Content-Type"] = "application/json";
        }
        const response = await fetch(`api.php?action=${encodeURIComponent(action)}`, {
            method,
            credentials: "same-origin",
            headers,
            body: body ? (formData ? body : JSON.stringify(body)) : undefined,
        });
        if (!response.ok) {
            let message = "Yêu cầu không thành công.";
            const result = await response.json().catch(() => null);
            if (result?.error) message = result.error;
            else if (response.status === 401) message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
            if (response.status === 401 && action !== "login" && action !== "register") {
                authOverlay.hidden = false;
                const sessionResponse = await fetch("api.php?action=session", { credentials: "same-origin" });
                if (sessionResponse.ok) {
                    const sessionData = await sessionResponse.json();
                    csrfToken = sessionData.csrf;
                }
            }
            throw new Error(message);
        }
        return response;
    };

    const applyTheme = (theme) => {
        const isDark = theme === "dark";
        document.documentElement.dataset.theme = theme;
        themeToggle.setAttribute("aria-pressed", String(isDark));
        themeToggle.setAttribute("aria-label", `Chuyển sang chế độ ${isDark ? "sáng" : "tối"}`);
        themeToggle.title = `Chuyển sang chế độ ${isDark ? "sáng" : "tối"}`;
        themeColor.content = isDark ? "#090d18" : "#f5f7fb";
    };

    let savedTheme = "dark";
    try {
        const storedTheme = localStorage.getItem("fileshare-theme");
        if (storedTheme === "dark" || storedTheme === "light") savedTheme = storedTheme;
    } catch (error) {
        // The visual preference remains usable even when storage is disabled.
    }
    applyTheme(savedTheme);
    themeToggle.addEventListener("click", () => {
        const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(theme);
        try {
            localStorage.setItem("fileshare-theme", theme);
        } catch (error) {
            showToast("Không thể lưu tùy chọn giao diện trên trình duyệt này.");
        }
    });

    const formatSize = (bytes) => {
        if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
        if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (value) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN").format(date);
    };

    const getIconType = (name) => {
        const extension = name.split(".").pop().toLowerCase();
        if (["doc", "docx"].includes(extension)) return ["word", "W"];
        if (extension === "pdf") return ["pdf", "P"];
        if (["xls", "xlsx", "csv"].includes(extension)) return ["excel", "X"];
        return ["word", extension.slice(0, 1).toUpperCase() || "F"];
    };

    const fileLinks = (fileId) => links.filter((link) => link.file_id === fileId);
    const activeLink = (fileId) => fileLinks(fileId)
        .filter((link) => link.status === "active" && link.access === "public")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

    const activateView = (viewName) => {
        const target = document.getElementById(`${viewName}-view`);
        if (!target) return;
        panels.forEach((panel) => panel.classList.toggle("active", panel === target));
        navLinks.forEach((link) => link.classList.toggle("active", link.dataset.view === viewName));
        $("#breadcrumb-current").textContent = {
            dashboard: "Tổng quan",
            files: "Tệp của tôi",
            upload: "Tải tệp lên",
            shared: "Liên kết chia sẻ",
        }[viewName] || "Tổng quan";
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const makeFileRow = (file) => {
        const row = document.createElement("tr");
        const relatedLinks = fileLinks(file.id);
        const publicLink = activeLink(file.id);
        const privateLink = relatedLinks.some((link) => link.access === "private" && link.status === "active");
        const hasActiveLink = relatedLinks.some((link) => link.status === "active");
        const access = publicLink ? "public" : (privateLink ? "private" : "private");
        const [iconType, iconLetter] = getIconType(file.name);
        row.className = "file-row";
        row.dataset.fileId = file.id;
        row.dataset.filename = file.name;
        row.dataset.folderId = file.folder_id;
        row.dataset.access = access;
        row.dataset.shared = hasActiveLink ? "active" : (relatedLinks.length ? "expired" : "none");
        if (publicLink) row.dataset.shareLink = publicLink.url;
        row.innerHTML = `<td><span class="file-name"><span class="file-icon ${iconType}"><span></span></span><span><strong></strong><small></small></span></span></td><td></td><td><span class="access-badge ${access}"><i></i></span></td><td></td><td><button class="row-menu" type="button" aria-label="Xóa tệp" title="Xóa tệp">×</button></td>`;
        $(".file-icon span", row).textContent = iconLetter;
        $(".file-name strong", row).textContent = file.name;
        $(".file-name small", row).textContent = file.missing ? "Tệp bị thiếu trên ổ đĩa" : `${formatSize(file.size)} · ${file.folder_name}`;
        row.cells[1].textContent = formatDate(file.created_at);
        $(".access-badge", row).lastChild.textContent = file.missing ? "Thiếu tệp" : publicLink ? "Đang chia sẻ" : privateLink ? "Riêng tư" : "Chưa chia sẻ";
        row.cells[3].textContent = `${file.downloads} lượt`;
        if (file.missing) row.classList.add("file-missing");
        return row;
    };

    const applyFileFilters = () => {
        const query = $("#file-search").value.trim().toLocaleLowerCase("vi");
        const shareFilter = $("#share-filter").value;
        const folderFilter = $("#folder-filter").value;
        $$(".file-row", allRows).forEach((row) => {
            const file = files.find((entry) => entry.id === row.dataset.fileId);
            const relatedLinks = file ? fileLinks(file.id) : [];
            const privateActive = relatedLinks.some((link) => link.access === "private" && link.status === "active");
            const statusMatches = shareFilter === "all"
                || (shareFilter === "active" && row.dataset.shared === "active")
                || (shareFilter === "private" && privateActive)
                || (shareFilter === "expired" && row.dataset.shared === "expired");
            row.hidden = !row.dataset.filename.toLocaleLowerCase("vi").includes(query)
                || (folderFilter !== "all" && row.dataset.folderId !== folderFilter)
                || !statusMatches;
        });
    };

    const renderFiles = () => {
        recentRows.replaceChildren();
        allRows.replaceChildren();
        files.slice(0, 8).forEach((file) => recentRows.append(makeFileRow(file)));
        files.forEach((file) => allRows.append(makeFileRow(file)));
        $("#nav-file-count").textContent = String(files.length);
        applyFileFilters();
    };

    const renderFolders = () => {
        const filter = $("#folder-filter");
        const uploadFolder = $("#folder-select");
        filter.replaceChildren(new Option("Tất cả thư mục", "all"));
        uploadFolder.replaceChildren();
        folders.forEach((folder) => {
            filter.add(new Option(folder.name, folder.id));
            uploadFolder.add(new Option(folder.name, folder.id));
        });
    };

    const linkStatusLabel = (status) => ({
        active: "Còn hiệu lực",
        expired: "Hết hạn",
        revoked: "Đã thu hồi",
        limit_reached: "Hết lượt tải",
    })[status] || "Không khả dụng";

    const renderLinks = () => {
        const linkRows = $("#link-rows");
        linkRows.replaceChildren();
        links.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).forEach((link) => {
            const file = files.find((entry) => entry.id === link.file_id);
            const row = document.createElement("tr");
            row.dataset.linkId = link.id;
            row.innerHTML = `<td></td><td><span class="access-badge ${link.status === "active" ? "public" : "private"}"><i></i></span></td><td></td><td></td><td></td><td><button class="row-menu revoke-link-row" type="button">Thu hồi</button></td>`;
            row.cells[0].textContent = file?.name || "Tệp đã xóa";
            $(".access-badge", row).lastChild.textContent = linkStatusLabel(link.status);
            row.cells[1].classList.toggle("link-status-active", link.status === "active");
            row.cells[2].textContent = link.max_downloads === null ? `${link.downloads} lượt · không giới hạn` : `${link.downloads} / ${link.max_downloads}`;
            row.cells[3].textContent = formatDate(link.expires_at);
            row.cells[4].textContent = link.password_protected ? "Có" : "Không";
            const revokeButton = $(".revoke-link-row", row);
            revokeButton.disabled = link.status !== "active";
            linkRows.append(row);
        });
    };

    const updateStorage = (used, quota) => {
        const percentage = quota ? Math.min(100, Math.round(used / quota * 100)) : 0;
        $(".storage-heading span:last-child").textContent = `${percentage}%`;
        $(".storage-bar span").style.width = `${percentage}%`;
        $(".storage-card p").innerHTML = "";
        $(".storage-card p").append(document.createTextNode(`${(used / 1024 ** 3).toFixed(2)} GB `));
        const limit = document.createElement("span");
        limit.textContent = `/ ${(quota / 1024 ** 3).toFixed(0)} GB đã dùng`;
        $(".storage-card p").append(limit);
        $(".hero-capacity strong").innerHTML = "";
        $(".hero-capacity strong").append(document.createTextNode(`${(used / 1024 ** 3).toFixed(2)} `));
        const capacity = document.createElement("small");
        capacity.textContent = `GB / ${(quota / 1024 ** 3).toFixed(0)} GB`;
        $(".hero-capacity strong").append(capacity);
    };

    const buildNotifications = () => {
        notifications.splice(0, notifications.length);
        const auditRows = $("#audit-rows");
        auditRows.replaceChildren();
        const activityList = $("#dashboard-activity");
        activityList.replaceChildren();
        const eventLabels = {
            download: "Tải xuống",
            file_missing: "Tệp bị thiếu trên ổ đĩa",
            link_created: "Cấp liên kết",
            link_revoked: "Thu hồi liên kết",
            file_uploaded: "Tải tệp lên",
            file_deleted: "Xóa tệp",
            file_cleanup: "Dọn tệp hết hạn",
        };
        audit.slice(0, 12).forEach((event, index) => {
            const file = files.find((entry) => entry.id === event.file_id);
            const eventName = eventLabels[event.event] || event.event;
            const fileName = file?.name || event.details?.name || "—";
            const row = document.createElement("tr");
            [formatDate(event.created_at), eventName, fileName, event.ip, JSON.stringify(event.details || {})].forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.append(cell);
            });
            auditRows.append(row);
            if (index < 5) {
                const activity = document.createElement("div");
                activity.className = "activity-item";
                activity.innerHTML = '<span class="activity-avatar activity-purple">FS</span><div><p><strong></strong></p><span></span></div>';
                $("strong", activity).textContent = eventName;
                $("span:last-child", activity).textContent = `${fileName} · ${formatDate(event.created_at)}`;
                activityList.append(activity);
            }
        });
        audit.slice(0, 12).forEach((event, index) => {
            if (!["download", "file_missing", "link_created", "link_revoked", "file_uploaded"].includes(event.event)) return;
            const file = files.find((entry) => entry.id === event.file_id);
            const labels = {
                download: "Có lượt tải tệp",
                file_missing: "Tệp bị thiếu trên ổ đĩa",
                link_created: "Đã tạo liên kết chia sẻ",
                link_revoked: "Đã thu hồi liên kết",
                file_uploaded: "Đã tải tệp lên",
            };
            notifications.push({
                title: labels[event.event],
                detail: `${file?.name || event.details?.name || "Tệp"} · ${formatDate(event.created_at)}`,
                filename: file?.name || "",
                unread: index < 2,
            });
        });
        renderNotifications();
    };

    const loadData = async () => {
        const response = await request("list");
        const data = await response.json();
        files = data.files;
        folders = data.folders;
        links = data.links;
        audit = data.audit;
        renderFolders();
        renderFiles();
        renderLinks();
        updateStorage(data.used, data.quota);
        $("#stat-files").textContent = String(files.length);
        $("#stat-links").textContent = String(links.filter((link) => link.status === "active").length);
        $("#stat-downloads").textContent = String(files.reduce((total, file) => total + file.downloads, 0));
        $("#hero-links-count").textContent = `${links.filter((link) => link.status === "active").length} liên kết`;
        buildNotifications();
        data.notifications.forEach(showToast);
    };

    const renderNotifications = () => {
        notificationList.replaceChildren();
        const unreadCount = notifications.filter((item) => item.unread).length;
        notificationCount.textContent = unreadCount ? `${unreadCount} thông báo mới` : "Đã cập nhật";
        notificationIndicator.hidden = unreadCount === 0;
        notificationToggle.setAttribute("aria-label", unreadCount ? `${unreadCount} thông báo chưa đọc` : "Không có thông báo mới");
        notifications.forEach((notification) => {
            const item = document.createElement("button");
            item.className = "notification-item";
            item.type = "button";
            item.dataset.filename = notification.filename;
            item.classList.toggle("unread", notification.unread);
            const status = document.createElement("span");
            status.className = "notification-status";
            status.setAttribute("aria-hidden", "true");
            const copy = document.createElement("span");
            copy.className = "notification-copy";
            const title = document.createElement("strong");
            title.textContent = notification.title;
            const detail = document.createElement("small");
            detail.textContent = notification.detail;
            copy.append(title, detail);
            item.append(status, copy);
            notificationList.append(item);
        });
    };

    const closeHeaderPanels = () => {
        searchPanel.hidden = true;
        notificationPanel.hidden = true;
        searchToggle.setAttribute("aria-expanded", "false");
        notificationToggle.setAttribute("aria-expanded", "false");
    };

    const renderSearchResults = () => {
        const query = searchInput.value.trim().toLocaleLowerCase("vi");
        const matches = files.filter((file) => `${file.name} ${file.folder_name}`.toLocaleLowerCase("vi").includes(query));
        searchResults.replaceChildren();
        searchCaption.textContent = query ? `${matches.length} kết quả` : "Tệp của bạn";
        if (!matches.length) {
            const empty = document.createElement("p");
            empty.className = "popover-empty";
            empty.textContent = "Không tìm thấy tệp phù hợp.";
            searchResults.append(empty);
            return;
        }
        matches.slice(0, 8).forEach((file) => {
            const [iconType, iconLetter] = getIconType(file.name);
            const result = document.createElement("button");
            result.className = "global-search-result";
            result.type = "button";
            result.setAttribute("role", "option");
            result.dataset.fileId = file.id;
            result.innerHTML = `<span class="file-icon ${iconType}"><span></span></span><span class="global-search-result-copy"><strong></strong><small></small></span>`;
            $(".file-icon span", result).textContent = iconLetter;
            $(".global-search-result-copy strong", result).textContent = file.name;
            $(".global-search-result-copy small", result).textContent = `${file.folder_name} · ${formatSize(file.size)}`;
            searchResults.append(result);
        });
    };

    const showAuth = (mode = "login") => {
        authMode = mode;
        const isRegister = mode === "register";
        $("#auth-title").textContent = isRegister ? "Tạo tài khoản" : "Đăng nhập";
        $("#auth-description").textContent = isRegister
            ? "Tạo không gian riêng để lưu trữ và chia sẻ tệp."
            : "Đăng nhập để quản lý tệp và liên kết chia sẻ của bạn.";
        $("#auth-name-label").hidden = !isRegister;
        $("#auth-name").hidden = !isRegister;
        $("#auth-name").required = isRegister;
        $("#auth-password").autocomplete = isRegister ? "new-password" : "current-password";
        $("#auth-password").minLength = isRegister ? 10 : 1;
        $("#auth-submit").textContent = isRegister ? "Tạo tài khoản" : "Đăng nhập";
        $("#auth-switch").textContent = isRegister ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký";
        authError.textContent = "";
        authOverlay.hidden = false;
        $("#auth-email").focus();
    };

    const updateProfile = (user) => {
        $("#profile-name").textContent = user.name;
        $("#profile-email").textContent = user.email;
        $(".avatar", $("#profile-card")).textContent = [...user.name][0].toLocaleUpperCase("vi");
        $("#welcome-title").firstChild.textContent = `Xin chào, ${user.name} `;
    };

    const openFileDetails = (fileId) => {
        const file = files.find((entry) => entry.id === fileId);
        if (!file) return;
        activeFileId = file.id;
        const [iconType, iconLetter] = getIconType(file.name);
        const share = activeLink(file.id);
        const selectedLink = share || fileLinks(file.id).find((item) => item.status === "active") || null;
        activeLinkId = selectedLink?.id || null;
        $("#detail-file-name").textContent = file.name;
        $("#detail-file-meta").textContent = `Tải lên ngày ${formatDate(file.created_at)} · ${formatSize(file.size)} · ${file.folder_name}`;
        $("#detail-file-icon").className = `file-icon ${iconType}`;
        $("#detail-file-icon").innerHTML = `<span>${iconLetter}</span>`;
        const badge = $("#detail-access");
        badge.className = `access-badge ${selectedLink?.access === "public" ? "public" : "private"}`;
        badge.innerHTML = `<i></i>${selectedLink ? (selectedLink.access === "public" ? "Công khai" : "Riêng tư") : "Chưa chia sẻ"}`;
        $("#share-url").textContent = selectedLink?.url || "Chưa có liên kết còn hiệu lực";
        $("#share-description").textContent = selectedLink
            ? `${selectedLink.downloads} lượt tải · Hết hạn ${formatDate(selectedLink.expires_at)}${selectedLink.password_protected ? " · Có mật khẩu" : ""}`
            : "Tạo liên kết mới để bắt đầu chia sẻ tệp.";
        $(".link-setting-row:nth-of-type(1) small").textContent = selectedLink ? linkStatusLabel(selectedLink.status) : "Chưa tạo liên kết";
        $(".link-setting-row:nth-of-type(2) small").textContent = selectedLink
            ? `${selectedLink.downloads} / ${selectedLink.max_downloads ?? "∞"} lượt tải`
            : "Chưa giới hạn";
        $(".link-setting-row:nth-of-type(3) small").textContent = selectedLink ? formatDate(selectedLink.expires_at) : "—";
        $("#revoke-link").disabled = !selectedLink || selectedLink.status !== "active";
        activateView("shared");
    };

    const renderAllFiles = () => {
        allRows.replaceChildren(...files.map(makeFileRow));
        applyFileFilters();
    };

    navLinks.forEach((link) => link.addEventListener("click", () => activateView(link.dataset.view)));
    $$("[data-open-upload]").forEach((button) => button.addEventListener("click", () => activateView("upload")));
    $$("[data-open-files]").forEach((button) => button.addEventListener("click", () => activateView("files")));
    $$("[data-open-shared]").forEach((button) => button.addEventListener("click", () => activateView("shared")));

    searchToggle.addEventListener("click", () => {
        const shouldOpen = searchPanel.hidden;
        closeHeaderPanels();
        if (shouldOpen) {
            searchPanel.hidden = false;
            searchToggle.setAttribute("aria-expanded", "true");
            renderSearchResults();
            searchInput.focus();
        }
    });
    searchInput.addEventListener("input", renderSearchResults);
    searchResults.addEventListener("click", (event) => {
        const result = event.target.closest(".global-search-result");
        if (!result) return;
        closeHeaderPanels();
        openFileDetails(result.dataset.fileId);
    });
    notificationToggle.addEventListener("click", () => {
        const shouldOpen = notificationPanel.hidden;
        closeHeaderPanels();
        if (shouldOpen) {
            notificationPanel.hidden = false;
            notificationToggle.setAttribute("aria-expanded", "true");
        }
    });
    $("#mark-notifications-read").addEventListener("click", () => {
        notifications.forEach((item) => { item.unread = false; });
        renderNotifications();
    });
    notificationList.addEventListener("click", (event) => {
        const item = event.target.closest(".notification-item");
        if (!item) return;
        const notification = notifications.find((entry) => entry.filename === item.dataset.filename);
        if (notification) notification.unread = false;
        renderNotifications();
        closeHeaderPanels();
        const file = files.find((entry) => entry.name === item.dataset.filename);
        if (file) openFileDetails(file.id);
        else activateView("files");
    });
    document.addEventListener("pointerdown", (event) => {
        if (!event.target.closest(".topbar-actions")) closeHeaderPanels();
    });
    document.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            closeHeaderPanels();
            searchPanel.hidden = false;
            searchToggle.setAttribute("aria-expanded", "true");
            renderSearchResults();
            searchInput.focus();
        } else if (event.key === "Escape") {
            closeHeaderPanels();
        }
    });

    const handleFileRowClick = (event) => {
        const row = event.target.closest(".file-row");
        if (!row) return;
        if (event.target.closest(".row-menu")) {
            event.stopPropagation();
            if (!window.confirm(`Xóa tệp "${row.dataset.filename}" và thu hồi các liên kết?`)) return;
            request("file-delete", { method: "POST", body: { file_id: row.dataset.fileId } })
                .then(loadData)
                .then(() => showToast("Đã xóa tệp và thu hồi các liên kết."))
                .catch((error) => showToast(error.message));
            return;
        }
        openFileDetails(row.dataset.fileId);
    };
    recentRows.addEventListener("click", handleFileRowClick);
    allRows.addEventListener("click", handleFileRowClick);

    $("#file-search").addEventListener("input", applyFileFilters);
    $("#share-filter").addEventListener("change", applyFileFilters);
    $("#folder-filter").addEventListener("change", applyFileFilters);
    $("#create-folder").addEventListener("click", async () => {
        const name = window.prompt("Tên thư mục mới:");
        if (name === null) return;
        try {
            const response = await request("folder-create", { method: "POST", body: { name } });
            const data = await response.json();
            folders.push(data.folder);
            renderFolders();
            $("#folder-select").value = data.folder.id;
            showToast("Đã tạo thư mục.");
        } catch (error) {
            showToast(error.message);
        }
    });

    const exportReport = async () => {
        try {
            const response = await request("report", { method: "POST", body: {} });
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "bao-cao-truy-cap.csv";
            anchor.click();
            URL.revokeObjectURL(url);
            showToast("Đã xuất báo cáo truy cập.");
        } catch (error) {
            showToast(error.message);
        }
    };
    $("#export-report").addEventListener("click", exportReport);
    $("#export-audit").addEventListener("click", exportReport);
    $("#export-dashboard-report").addEventListener("click", exportReport);
    $("#cleanup-preview").addEventListener("click", async () => {
        try {
            const response = await request("cleanup-preview");
            const data = await response.json();
            const preview = data.files.map((file) => `${file.name} (${formatSize(file.size)})`).join("\n");
            window.alert(data.files.length
                ? `Xem trước: ${data.files.length} tệp không còn liên kết hiệu lực sẽ được dọn bằng lệnh máy chủ:\n\n${preview}\n\nChưa có tệp nào bị xóa.`
                : "Không có tệp nào đủ điều kiện dọn dẹp. Chưa có tệp nào bị xóa.");
        } catch (error) {
            showToast(error.message);
        }
    });

    const setSelectedFile = (file) => {
        selectedUpload = file;
        fileNameInput.value = file.name;
        const [iconType, iconLetter] = getIconType(file.name);
        selectedFile.innerHTML = `<span class="file-icon ${iconType}"><span></span></span><span><strong></strong><small></small></span>`;
        $(".file-icon span", selectedFile).textContent = iconLetter;
        $("strong", selectedFile).textContent = file.name;
        $("small", selectedFile).textContent = formatSize(file.size);
        selectedFile.hidden = false;
    };
    fileInput.addEventListener("change", () => {
        const [file] = fileInput.files;
        if (file) setSelectedFile(file);
    });
    const dropzone = $("#dropzone");
    ["dragenter", "dragover"].forEach((name) => dropzone.addEventListener(name, (event) => {
        event.preventDefault();
        dropzone.classList.add("dragover");
    }));
    ["dragleave", "drop"].forEach((name) => dropzone.addEventListener(name, (event) => {
        event.preventDefault();
        dropzone.classList.remove("dragover");
    }));
    dropzone.addEventListener("drop", (event) => {
        const [file] = event.dataTransfer.files;
        if (file) setSelectedFile(file);
    });
    $$('input[name="access"]').forEach((radio) => radio.addEventListener("change", () => {
        $$(".radio-card").forEach((card) => card.classList.toggle("selected", card.contains(radio) && radio.checked));
    }));
    $("#upload-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const uploadForm = event.currentTarget;
        if (!selectedUpload) {
            showToast("Vui lòng chọn tệp trước khi tải lên.");
            fileInput.focus();
            return;
        }
        const form = new FormData();
        form.append("file", selectedUpload);
        form.append("file_name", fileNameInput.value.trim());
        form.append("folder_id", $("#folder-select").value);
        form.append("access", $('input[name="access"]:checked').value);
        form.append("max_downloads", $("#download-limit").value);
        form.append("expiry_days", $("#expiry-days").value);
        form.append("password", $("#link-password").value);
        try {
            const response = await request("upload", { method: "POST", body: form, formData: true });
            const data = await response.json();
            await loadData();
            selectedUpload = null;
            uploadForm.reset();
            selectedFile.hidden = true;
            showToast(`Đã tải "${data.file.original_name}" và tạo liên kết chia sẻ.`);
            activateView("files");
        } catch (error) {
            showToast(error.message);
        }
    });

    $("#copy-link").addEventListener("click", async () => {
        const link = $("#share-url").textContent;
        if (!link.startsWith("http")) {
            showToast("Chưa có liên kết để sao chép.");
            return;
        }
        try {
            await navigator.clipboard.writeText(link);
            showToast("Đã sao chép liên kết chia sẻ.");
        } catch (error) {
            showToast("Không thể sao chép tự động. Hãy chọn và sao chép liên kết.");
        }
    });

    $("#revoke-link").addEventListener("click", async () => {
        if (!activeLinkId) return;
        try {
            await request("link-revoke", { method: "POST", body: { link_id: activeLinkId } });
            await loadData();
            openFileDetails(activeFileId);
            showToast("Đã thu hồi liên kết chia sẻ.");
        } catch (error) {
            showToast(error.message);
        }
    });
    $("#create-link").addEventListener("click", async () => {
        if (!activeFileId) {
            showToast("Chọn một tệp trước khi tạo liên kết.");
            activateView("files");
            return;
        }
        const expiryDays = window.prompt("Liên kết có hiệu lực trong bao nhiêu ngày? (1–3650)", "7");
        if (expiryDays === null) return;
        const maxDownloads = window.prompt("Giới hạn lượt tải (để trống nếu không giới hạn):", "");
        if (maxDownloads === null) return;
        const password = window.prompt("Mật khẩu liên kết (để trống nếu không cần):", "");
        if (password === null) return;
        try {
            await request("link-create", {
                method: "POST",
                body: {
                    file_id: activeFileId,
                    access: "public",
                    expiry_days: expiryDays,
                    max_downloads: maxDownloads,
                    password,
                },
            });
            await loadData();
            openFileDetails(activeFileId);
            showToast("Đã tạo liên kết chia sẻ.");
        } catch (error) {
            showToast(error.message);
        }
    });
    $("#link-rows").addEventListener("click", async (event) => {
        const row = event.target.closest("tr[data-link-id]");
        if (!row) return;
        const link = links.find((entry) => entry.id === row.dataset.linkId);
        if (!link) return;
        if (event.target.closest(".revoke-link-row")) {
            try {
                await request("link-revoke", { method: "POST", body: { link_id: link.id } });
                await loadData();
                showToast("Đã thu hồi liên kết.");
            } catch (error) {
                showToast(error.message);
            }
            return;
        }
        openFileDetails(link.file_id);
    });

    $("#auth-switch").addEventListener("click", () => showAuth(authMode === "login" ? "register" : "login"));
    authForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        authError.textContent = "";
        const body = {
            email: $("#auth-email").value.trim(),
            password: $("#auth-password").value,
        };
        if (authMode === "register") body.name = $("#auth-name").value.trim();
        try {
            const response = await request(authMode, { method: "POST", body });
            const data = await response.json();
            csrfToken = data.csrf;
            updateProfile(data.user);
            authOverlay.hidden = true;
            await loadData();
        } catch (error) {
            authError.textContent = error.message;
        }
    });
    $("#profile-card").addEventListener("click", async () => {
        try {
            const response = await request("logout", { method: "POST", body: {} });
            const data = await response.json();
            csrfToken = data.csrf;
            files = [];
            folders = [];
            links = [];
            allRows.replaceChildren();
            recentRows.replaceChildren();
            showAuth("login");
        } catch (error) {
            showToast(error.message);
        }
    });

    document.addEventListener("click", (event) => {
        const helpLink = event.target.closest("#help-link");
        if (helpLink) {
            event.preventDefault();
            showToast("Trung tâm trợ giúp sẽ sớm có mặt.");
        }
    });

    const start = async () => {
        try {
            const response = await request("session");
            const data = await response.json();
            csrfToken = data.csrf;
            if (!data.user) {
                showAuth("login");
                return;
            }
            updateProfile(data.user);
            authOverlay.hidden = true;
            await loadData();
        } catch (error) {
            authError.textContent = `Không thể kết nối với máy chủ: ${error.message}`;
        }
    };
    start();
})();
