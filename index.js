// ═══════════════════════════════════════════════════════
// Replace Tool - 텍스트 치환 (SillyTavern Extension)
// ═══════════════════════════════════════════════════════

const MODULE_NAME = "st-replace-tool";

jQuery(async () => {
    console.log("[Replace Tool] 확장프로그램 로딩...");

    const { getContext } = SillyTavern;

    // ── 팝업 HTML 삽입 ──
    const popupHtml = `
    <div id="rt-bg"></div>
    <div id="rt-popup">
        <div class="rt-header">
            <span>🔄 텍스트 치환</span>
            <span class="rt-msg-badge" id="rt-msg-badge"></span>
            <span class="rt-close" id="rt-close">✕</span>
        </div>
        <div class="rt-body">
            <div id="rt-rules"></div>
            <div class="rt-options">
                <label class="rt-opt-label">
                    <input type="checkbox" id="rt-cut-infoblock" checked />
                    <span>&lt;infoblock&gt; 위까지만 치환</span>
                </label>
            </div>
            <div class="rt-actions">
                <div class="rt-btn rt-btn-add" id="rt-add">+ 규칙 추가</div>
                <div class="rt-btn rt-btn-exec" id="rt-exec">🚀 치환 실행</div>
            </div>
            <div class="rt-preview-section">
                <label>미리보기</label>
                <div id="rt-preview" class="rt-preview"></div>
            </div>
        </div>
    </div>`;
    $("body").append(popupHtml);

    const bgEl = document.getElementById("rt-bg");
    const popupEl = document.getElementById("rt-popup");
    const rulesEl = document.getElementById("rt-rules");
    const previewEl = document.getElementById("rt-preview");
    const badgeEl = document.getElementById("rt-msg-badge");

    let currentMesId = null;

    // ── 규칙 관리 ──
    function addRule(findVal, replaceVal) {
        const rule = document.createElement("div");
        rule.className = "rt-rule";
        rule.innerHTML = `
            <textarea class="rt-find" placeholder="찾을 텍스트" rows="1">${findVal || ""}</textarea>
            <textarea class="rt-replace" placeholder="바꿀 텍스트 (비우면 삭제)" rows="1">${replaceVal || ""}</textarea>
            <div class="rt-rule-del" title="규칙 삭제">✕</div>
        `;
        rule.querySelector(".rt-find").addEventListener("input", updatePreview);
        rule.querySelector(".rt-replace").addEventListener("input", updatePreview);
        rule.querySelector(".rt-rule-del").addEventListener("click", () => {
            rule.remove();
            updatePreview();
        });
        rulesEl.appendChild(rule);
    }

    function getRules() {
        const rules = [];
        rulesEl.querySelectorAll(".rt-rule").forEach(el => {
            const find = el.querySelector(".rt-find").value;
            const replace = el.querySelector(".rt-replace").value;
            if (find) rules.push({ find, replace });
        });
        return rules;
    }

    // ── 치환 적용 (실제 실행용) ──
    function applyRules(text, rules) {
        const cutInfoblock = document.getElementById("rt-cut-infoblock").checked;
        let target = text;
        let suffix = "";

        if (cutInfoblock) {
            const idx = text.indexOf("<infoblock>");
            if (idx !== -1) {
                target = text.substring(0, idx);
                suffix = text.substring(idx);
            }
        }

        for (const r of rules) {
            target = target.split(r.find).join(r.replace);
        }
        return target + suffix;
    }

    // ── 하이라이트 미리보기 (찾을 텍스트만 노란 형광펜) ──
    function buildHighlightedPreview(text, rules) {
        const cutInfoblock = document.getElementById("rt-cut-infoblock").checked;
        let target = text;
        let suffix = "";

        if (cutInfoblock) {
            const idx = text.indexOf("<infoblock>");
            if (idx !== -1) {
                target = text.substring(0, idx);
                suffix = text.substring(idx);
            }
        }

        // find 키워드 목록 (빈 문자열 제외)
        const findTerms = rules.map(r => r.find).filter(f => f.length > 0);

        if (findTerms.length === 0) {
            return escapeHtml(target) + escapeHtml(suffix);
        }

        // 정규식 특수문자 이스케이프 후 OR로 결합
        const escaped = findTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const regex = new RegExp("(" + escaped.join("|") + ")", "g");

        // target 영역만 하이라이트
        const parts = target.split(regex);
        const findSet = new Set(findTerms);
        let html = "";
        for (const part of parts) {
            if (findSet.has(part)) {
                html += '<span class="rt-hl">' + escapeHtml(part) + "</span>";
            } else {
                html += escapeHtml(part);
            }
        }

        return html + escapeHtml(suffix);
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // ── Raw 텍스트 가져오기 ──
    function getRawText(mesId) {
        try {
            const ctx = getContext();
            if (ctx && ctx.chat && ctx.chat[mesId]) return ctx.chat[mesId].mes;
        } catch (e) {}
        return null;
    }

    // ── 미리보기 업데이트 ──
    function updatePreview() {
        const raw = getRawText(currentMesId);
        if (!raw) return;
        const rules = getRules();
        previewEl.innerHTML = buildHighlightedPreview(raw, rules);
    }

    // ── DOM 업데이트 ──
    function updateDOM(ctx, mesId, newText) {
        const el = document.querySelector('.mes[mesid="' + mesId + '"]');
        if (!el) return;
        const mt = el.querySelector(".mes_text");
        if (!mt) return;
        try {
            if (typeof ctx.messageFormatting === "function") {
                const c = ctx.chat[mesId];
                mt.innerHTML = ctx.messageFormatting(newText, c.name, c.is_system, c.is_user, mesId);
            } else {
                mt.innerHTML = newText.replace(/\n/g, "<br>");
            }
        } catch (e) {
            mt.innerHTML = newText.replace(/\n/g, "<br>");
        }
    }

    function doSaveChat(ctx) {
        if (typeof ctx.saveChatDebounced === "function") ctx.saveChatDebounced();
        else if (typeof ctx.saveChat === "function") ctx.saveChat();
    }

    // ── 팝업 위치 (상단 고정, 키보드 영향 없음) ──
    function posPopup() {
        popupEl.style.display = "flex";
    }

    // ── 열기/닫기 ──
    function openPopup(mesId) {
        currentMesId = Number(mesId);
        rulesEl.innerHTML = "";
        addRule();

        const raw = getRawText(currentMesId);
        if (raw) previewEl.innerHTML = escapeHtml(raw);
        else previewEl.textContent = "(텍스트 없음)";

        badgeEl.textContent = "#" + currentMesId;

        bgEl.classList.add("rt-show");
        popupEl.classList.add("rt-show");
        posPopup();
        setTimeout(posPopup, 100);
    }

    function closePopup() {
        bgEl.classList.remove("rt-show");
        popupEl.classList.remove("rt-show");
        popupEl.style.display = "none";
        currentMesId = null;
    }

    // ── 치환 실행 ──
    function executeReplace() {
        const ctx = getContext();
        if (!ctx || !ctx.chat || currentMesId === null) return;
        const msg = ctx.chat[currentMesId];
        if (!msg) return;

        const rules = getRules();
        if (rules.length === 0) {
            if (typeof toastr !== "undefined") toastr.warning("치환 규칙을 입력해주세요.");
            return;
        }

        const newText = applyRules(msg.mes, rules);
        if (newText === msg.mes) {
            if (typeof toastr !== "undefined") toastr.info("변경된 내용이 없습니다.");
            return;
        }

        ctx.chat[currentMesId].mes = newText;
        updateDOM(ctx, currentMesId, newText);
        doSaveChat(ctx);

        if (typeof toastr !== "undefined") toastr.success("치환 완료! (" + rules.length + "개 규칙)", "Replace Tool", { timeOut: 2000 });
        closePopup();
    }

    // ── 이벤트 바인딩 ──
    document.getElementById("rt-close").addEventListener("click", closePopup);
    bgEl.addEventListener("click", closePopup);
    document.getElementById("rt-add").addEventListener("click", () => addRule());
    document.getElementById("rt-exec").addEventListener("click", executeReplace);

    // ── 메시지 버튼 삽입 ──
    function upsertReplaceButtons() {
        document.querySelectorAll(".mes").forEach(mes => {
            const mesId = mes.getAttribute("mesid");
            if (!mesId) return;

            if (mes.querySelector(".rt-mes-btn")) return;

            const target = mes.querySelector(".extraMesButtons");
            if (!target) return;

            const btn = document.createElement("div");
            btn.className = "rt-mes-btn mes_button fa-solid fa-right-left";
            btn.title = "텍스트 치환";
            btn.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                openPopup(mesId);
            });
            target.prepend(btn);
        });
    }

    const chat = document.getElementById("chat");
    if (chat) {
        const observer = new MutationObserver(upsertReplaceButtons);
        observer.observe(chat, { childList: true, subtree: true });
        upsertReplaceButtons();
    }

    console.log("[Replace Tool] 로드 완료!");
});
