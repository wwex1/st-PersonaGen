// ═══════════════════════════════════════════════════════
// Replace & Summary Tool (SillyTavern Extension)
// ═══════════════════════════════════════════════════════

const MODULE_NAME = "st-replace-tool";

jQuery(async () => {
    console.log("[RT] 확장프로그램 로딩...");

    const { getContext } = SillyTavern;

    // ═════════════════════════════════════════════
    // 🔄 파트 1: 텍스트 치환 (변경 없음)
    // ═════════════════════════════════════════════

    const replacePopupHtml = `
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
    $("body").append(replacePopupHtml);

    const bgEl = document.getElementById("rt-bg");
    const popupEl = document.getElementById("rt-popup");
    const rulesEl = document.getElementById("rt-rules");
    const previewEl = document.getElementById("rt-preview");
    const badgeEl = document.getElementById("rt-msg-badge");
    let currentMesId = null;

    function addRule(findVal, replaceVal) {
        const rule = document.createElement("div");
        rule.className = "rt-rule";
        rule.innerHTML = `
            <textarea class="rt-find" placeholder="찾을 텍스트" rows="1">${findVal || ""}</textarea>
            <textarea class="rt-replace" placeholder="바꿀 텍스트 (비우면 삭제)" rows="1">${replaceVal || ""}</textarea>
            <div class="rt-rule-del" title="규칙 삭제">✕</div>`;
        rule.querySelector(".rt-find").addEventListener("input", updatePreview);
        rule.querySelector(".rt-replace").addEventListener("input", updatePreview);
        rule.querySelector(".rt-rule-del").addEventListener("click", () => { rule.remove(); updatePreview(); });
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
    function applyRules(text, rules) {
        const cutInfoblock = document.getElementById("rt-cut-infoblock").checked;
        let target = text, suffix = "";
        if (cutInfoblock) { const idx = text.indexOf("<infoblock>"); if (idx !== -1) { target = text.substring(0, idx); suffix = text.substring(idx); } }
        for (const r of rules) target = target.split(r.find).join(r.replace);
        return target + suffix;
    }
    function getRawText(mesId) { try { const ctx = getContext(); if (ctx?.chat?.[mesId]) return ctx.chat[mesId].mes; } catch (e) {} return null; }
    function updatePreview() { const raw = getRawText(currentMesId); if (!raw) return; previewEl.textContent = applyRules(raw, getRules()); }
    function updateDOM(ctx, mesId, newText) {
        const el = document.querySelector('.mes[mesid="' + mesId + '"]'); if (!el) return;
        const mt = el.querySelector(".mes_text"); if (!mt) return;
        try { if (typeof ctx.messageFormatting === "function") { const c = ctx.chat[mesId]; mt.innerHTML = ctx.messageFormatting(newText, c.name, c.is_system, c.is_user, mesId); } else mt.innerHTML = newText.replace(/\n/g, "<br>"); }
        catch (e) { mt.innerHTML = newText.replace(/\n/g, "<br>"); }
    }
    function doSaveChat(ctx) { if (typeof ctx.saveChatDebounced === "function") ctx.saveChatDebounced(); else if (typeof ctx.saveChat === "function") ctx.saveChat(); }

    function openReplacePopup(mesId) {
        currentMesId = Number(mesId); rulesEl.innerHTML = ""; addRule();
        const raw = getRawText(currentMesId);
        previewEl.textContent = raw || "(텍스트 없음)";
        badgeEl.textContent = "#" + currentMesId;
        bgEl.classList.add("rt-show"); popupEl.classList.add("rt-show"); popupEl.style.display = "flex";
    }
    function closeReplacePopup() { bgEl.classList.remove("rt-show"); popupEl.classList.remove("rt-show"); popupEl.style.display = "none"; currentMesId = null; }
    function executeReplace() {
        const ctx = getContext(); if (!ctx?.chat || currentMesId === null) return;
        const msg = ctx.chat[currentMesId]; if (!msg) return;
        const rules = getRules(); if (!rules.length) { if (typeof toastr !== "undefined") toastr.warning("치환 규칙을 입력해주세요."); return; }
        const newText = applyRules(msg.mes, rules);
        if (newText === msg.mes) { if (typeof toastr !== "undefined") toastr.info("변경된 내용이 없습니다."); return; }
        ctx.chat[currentMesId].mes = newText; updateDOM(ctx, currentMesId, newText); doSaveChat(ctx);
        if (typeof toastr !== "undefined") toastr.success("치환 완료! (" + rules.length + "개 규칙)", "RT", { timeOut: 2000 });
        closeReplacePopup();
    }

    document.getElementById("rt-close").addEventListener("click", closeReplacePopup);
    bgEl.addEventListener("click", closeReplacePopup);
    document.getElementById("rt-add").addEventListener("click", () => addRule());
    document.getElementById("rt-exec").addEventListener("click", executeReplace);

    function upsertReplaceButtons() {
        document.querySelectorAll(".mes").forEach(mes => {
            const mesId = mes.getAttribute("mesid"); if (!mesId) return;
            const target = mes.querySelector(".extraMesButtons") || mes.querySelector(".mes_button") || mes.querySelector(".mes_buttons");
            if (!target) return;
            let btn = target.querySelector(".rt-mes-btn");
            if (!btn) {
                btn = document.createElement("div"); btn.className = "rt-mes-btn mes_button";
                btn.innerHTML = '<i class="fa-solid fa-right-left"></i>'; btn.title = "텍스트 치환";
                btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); const id = mes.getAttribute("mesid"); if (id) openReplacePopup(id); });
                target.prepend(btn);
            }
            btn.dataset.mesid = mesId;
        });
    }
    const chat = document.getElementById("chat");
    if (chat) { const observer = new MutationObserver(upsertReplaceButtons); observer.observe(chat, { childList: true, subtree: true }); upsertReplaceButtons(); }
    console.log("[RT] 🔄 치환 기능 활성화!");

    // ═════════════════════════════════════════════
    // 📝 파트 2: 요약 기능
    // ═════════════════════════════════════════════

    const SUMMARY_PROMPTS = [
        {
            label: "📖 현재 스토리 아크 요약",
            prompt: `(OOC: RP 무조건 중단. 해당 채팅을 자세히 과거형으로 요약하세요. 아래 양식을 엄격히 지키세요.\n\n## Archived Story Arc (Present)\n\n- 주요 사건 요약 (담백하게, 사실만, 자세히.)\n\n한글본, 영어본으로 각각 코드블럭에 넣어줘.\n**RP는 절대 이어가지 말고 중단할 것.**`
        },
        {
            label: "📚 전체 스토리 아크 요약",
            prompt: `(ooc: rp를 중단하고 대답해. 내용을 절대 이어가지 마. 지금까지의 채팅 진행 상황과 전체 스토리 아크까지 전부 포함해서 자세히 과거형으로 요약하세요. 아래 양식을 엄격히 지키세요.\n\n## Archived Story Arc (Past~Present)\n\n### **Month**\n-\n-\n.\n.\n.\n\n을 한글본, 영어본으로 각각 코드블럭에 넣어줘.)\n\n**RP 절대 이어가지 말 것.**`
        },
        {
            label: "📋 현재 상태 정리",
            prompt: `(ooc: rp를 중단하고 대답해. 내용을 절대 이어가지 마. 지금까지의 진행 상황을 기반으로 \n\n## Current Status\n- 현재 배경 (장소, 상황, 특이점)\n- {{char}} 현재 상태(신체, 심리, 부상, 특이점 등)\n- {{user}} 현재 상태(신체, 심리, 부상, 특이점 등)\n- 계획\n- 중요 아이템 (물건이름 : 간단한 설명과 보관위치 설명)\n\n을 한글본, 영어본으로 각각 코드블럭에 넣어줘.\n\n**절대 내용을 이어가지 말고 OOC 요청에 대답할 것.**)`
        }
    ];

    // 요약 상태
    let sumVersions = [];
    let sumViewIdx = -1;
    let sumCurrentPromptIdx = 0;
    let sumGenerating = false;
    let sumApiSource = "main";     // "main" 또는 "profile:ID"
    let sumIsEditing = false;

    // ── 요약 선택 팝업 HTML ──
    const sumSelectHtml = `
    <div id="sum-bg"></div>
    <div id="sum-select-popup">
        <div class="rt-header">
            <span>📝 요약 타입 선택</span>
            <span class="rt-close" id="sum-select-close">✕</span>
        </div>
        <div class="sum-select-body">
            <div class="sum-api-row">
                <label class="sum-api-label">API:</label>
                <select id="sum-api-select" class="sum-api-select"></select>
            </div>
            ${SUMMARY_PROMPTS.map((p, i) => `
                <div class="sum-select-item" data-idx="${i}">
                    <div class="sum-select-label">${p.label}</div>
                </div>
            `).join("")}
        </div>
    </div>`;
    $("body").append(sumSelectHtml);

    // ── 요약 결과 팝업 HTML ──
    const sumResultHtml = `
    <div id="sum-result-bg"></div>
    <div id="sum-result-popup">
        <div class="rt-header">
            <span>📝 요약 결과</span>
            <span class="sum-swipe-info" id="sum-swipe-info"></span>
            <span class="rt-close" id="sum-result-close">✕</span>
        </div>
        <div class="sum-result-body">
            <div class="sum-result-display" id="sum-result-display"></div>
            <textarea class="sum-result-editor" id="sum-result-editor" style="display:none;"></textarea>
            <div class="sum-result-actions">
                <div class="rt-btn sum-btn-prev" id="sum-prev" title="이전 버전">◀</div>
                <div class="rt-btn sum-btn-regen" id="sum-regen" title="재생성">🔄 재생성</div>
                <div class="rt-btn sum-btn-next" id="sum-next" title="다음 버전">▶</div>
            </div>
            <div class="sum-result-actions2">
                <div class="rt-btn sum-btn-copy" id="sum-copy">📋 복사</div>
                <div class="rt-btn sum-btn-edit" id="sum-edit">✏️ 직접 수정</div>
                <div class="rt-btn sum-btn-save" id="sum-save" style="display:none;">💾 저장</div>
                <div class="rt-btn sum-btn-cancel-edit" id="sum-cancel-edit" style="display:none;">취소</div>
            </div>
            <div class="sum-revise-section">
                <textarea id="sum-revise-input" placeholder="수정 방향을 입력하세요..." rows="2"></textarea>
                <div class="rt-btn rt-btn-exec" id="sum-revise-send">📨 수정 요청</div>
            </div>
        </div>
    </div>`;
    $("body").append(sumResultHtml);

    const sumBg = document.getElementById("sum-bg");
    const sumSelectPopup = document.getElementById("sum-select-popup");
    const sumResultBg = document.getElementById("sum-result-bg");
    const sumResultPopup = document.getElementById("sum-result-popup");
    const sumDisplay = document.getElementById("sum-result-display");
    const sumEditor = document.getElementById("sum-result-editor");
    const sumSwipeInfo = document.getElementById("sum-swipe-info");
    const sumReviseInput = document.getElementById("sum-revise-input");
    const sumApiSelect = document.getElementById("sum-api-select");

    // ── 하단 바에 요약 버튼 삽입 ──
    const sumOpenBtn = document.createElement("div");
    sumOpenBtn.id = "sum-open-btn";
    sumOpenBtn.className = "list-group-item flex-container flexGap5 interactable";
    sumOpenBtn.title = "요약";
    sumOpenBtn.innerHTML = '<i class="fa-solid fa-file-lines"></i> 요약';

    const sdGen = document.getElementById("sd_gen");
    const extMenu = document.getElementById("extensionsMenu");
    if (sdGen && sdGen.parentNode) sdGen.parentNode.insertBefore(sumOpenBtn, sdGen.nextSibling);
    else if (extMenu) extMenu.appendChild(sumOpenBtn);
    else { const wand = document.getElementById("data_bank_wand_container"); if (wand?.parentNode) wand.parentNode.insertBefore(sumOpenBtn, wand.nextSibling); else document.body.appendChild(sumOpenBtn); }

    // ── API 프로필 목록 로드 ──
    function loadApiProfiles() {
        sumApiSelect.innerHTML = '<option value="main">Main API</option>';
        try {
            const ctx = getContext();
            const cmrs = ctx.ConnectionManagerRequestService;
            let profiles = [];
            if (cmrs) {
                if (typeof cmrs.getConnectionProfiles === "function") profiles = cmrs.getConnectionProfiles() || [];
                else if (typeof cmrs.getAllProfiles === "function") profiles = cmrs.getAllProfiles() || [];
                else if (typeof cmrs.getProfiles === "function") profiles = cmrs.getProfiles() || [];
                if (!profiles.length) {
                    const s = ctx.extensionSettings?.connectionManager?.profiles || ctx.extensionSettings?.ConnectionManager?.profiles;
                    if (Array.isArray(s)) profiles = s;
                    else if (s && typeof s === "object") profiles = Object.values(s);
                }
            }
            profiles.forEach(p => {
                const id = p.id || p.profileId || "";
                const name = p.name || p.profileName || id;
                if (id) { const opt = document.createElement("option"); opt.value = "profile:" + id; opt.textContent = name; sumApiSelect.appendChild(opt); }
            });
        } catch (e) { console.log("[RT] 프로필 로드 실패:", e); }
        sumApiSelect.value = sumApiSource;
    }

    sumApiSelect.addEventListener("change", () => { sumApiSource = sumApiSelect.value; });

    // ── 요약 선택 팝업 열기/닫기 ──
    function openSumSelect() {
        loadApiProfiles();
        sumBg.classList.add("rt-show"); sumSelectPopup.classList.add("rt-show"); sumSelectPopup.style.display = "flex";
    }
    function closeSumSelect() { sumBg.classList.remove("rt-show"); sumSelectPopup.classList.remove("rt-show"); sumSelectPopup.style.display = "none"; }

    sumOpenBtn.addEventListener("click", () => {
        if (sumVersions.length > 0) { openSumResult(); renderSumResult(); return; }
        openSumSelect();
    });
    document.getElementById("sum-select-close").addEventListener("click", closeSumSelect);
    sumBg.addEventListener("click", closeSumSelect);

    document.querySelectorAll(".sum-select-item").forEach(item => {
        item.addEventListener("click", () => {
            const idx = parseInt(item.dataset.idx, 10);
            closeSumSelect();
            startSummary(idx);
        });
    });

    // ── 결과 팝업 열기/닫기 ──
    function openSumResult() { sumResultBg.classList.add("rt-show"); sumResultPopup.classList.add("rt-show"); sumResultPopup.style.display = "flex"; }
    function closeSumResult() { sumResultBg.classList.remove("rt-show"); sumResultPopup.classList.remove("rt-show"); sumResultPopup.style.display = "none"; exitEditMode(); }

    document.getElementById("sum-result-close").addEventListener("click", closeSumResult);
    sumResultBg.addEventListener("click", closeSumResult);

    // ── 렌더링 ──
    function renderSumResult() {
        if (!sumVersions.length) return;
        const text = sumVersions[sumViewIdx];
        sumDisplay.textContent = text;
        sumDisplay.style.display = "block";
        sumEditor.style.display = "none";
        sumSwipeInfo.textContent = (sumViewIdx + 1) + " / " + sumVersions.length;
        exitEditMode();
    }

    function showSumLoading(msg) {
        sumDisplay.innerHTML = '<div class="sum-loading">' + msg + '</div>';
        sumDisplay.style.display = "block";
        sumEditor.style.display = "none";
        sumSwipeInfo.textContent = "";
    }

    // ── 직접 수정 모드 ──
    function enterEditMode() {
        sumIsEditing = true;
        sumEditor.value = sumVersions[sumViewIdx] || "";
        sumDisplay.style.display = "none";
        sumEditor.style.display = "block";
        sumEditor.focus();
        document.getElementById("sum-edit").style.display = "none";
        document.getElementById("sum-save").style.display = "";
        document.getElementById("sum-cancel-edit").style.display = "";
    }
    function exitEditMode() {
        sumIsEditing = false;
        sumEditor.style.display = "none";
        sumDisplay.style.display = "block";
        document.getElementById("sum-edit").style.display = "";
        document.getElementById("sum-save").style.display = "none";
        document.getElementById("sum-cancel-edit").style.display = "none";
    }
    function saveEdit() {
        if (!sumVersions.length) return;
        sumVersions[sumViewIdx] = sumEditor.value;
        renderSumResult();
        if (typeof toastr !== "undefined") toastr.success("저장됨", "RT", { timeOut: 1500 });
    }

    document.getElementById("sum-edit").addEventListener("click", enterEditMode);
    document.getElementById("sum-save").addEventListener("click", saveEdit);
    document.getElementById("sum-cancel-edit").addEventListener("click", () => { exitEditMode(); renderSumResult(); });

    // ── 컨텍스트 수집 (StoryIdeas 패턴 차용) ──
    function getPersona() {
        try {
            const pu = window.power_user || SillyTavern.getContext().power_user;
            const ua = window.user_avatar || SillyTavern.getContext().user_avatar;
            if (!pu || !ua) return "";
            let s = ""; const name = pu.personas?.[ua] || pu.name || "User";
            s += "User/Persona: " + name + "\n";
            const desc = pu.persona_descriptions?.[ua];
            if (desc?.description) s += "\nPersona Description:\n" + desc.description + "\n";
            else if (pu.persona_description) s += "\nPersona Description:\n" + pu.persona_description + "\n";
            return s.trim();
        } catch { return ""; }
    }
    function getCharacter() {
        try {
            const c = getContext(); const ch = c.characters?.[c.characterId]; if (!ch) return "";
            const d = ch.data || ch; let s = "";
            if (ch.name) s += "Character: " + ch.name + "\n";
            if (d.description) s += "\nDescription:\n" + d.description + "\n";
            if (d.personality) s += "\nPersonality:\n" + d.personality + "\n";
            if (d.scenario) s += "\nScenario:\n" + d.scenario + "\n";
            return s.trim();
        } catch { return ""; }
    }
    function gatherSystemPrompt() {
        let t = "";
        const p = getPersona(); if (p) t += "=== PERSONA ===\n" + p + "\n\n";
        const c = getCharacter(); if (c) t += "=== CHARACTER ===\n" + c + "\n\n";
        return t.trim();
    }
    function gatherChatMessages(maxMessages) {
        const ctx = getContext(); if (!ctx?.chat?.length) return [];
        const msgs = [];
        const sys = gatherSystemPrompt();
        if (sys) msgs.push({ role: "system", content: sys });
        const start = Math.max(0, ctx.chat.length - (maxMessages || 30));
        for (let i = start; i < ctx.chat.length; i++) {
            const m = ctx.chat[i]; if (!m) continue;
            msgs.push({ role: m.is_user ? "user" : "assistant", content: m.extra?.display_text ?? m.mes });
        }
        return msgs;
    }
    function gatherPlainContext(maxMessages) {
        const ctx = getContext(); if (!ctx?.chat?.length) return "";
        let t = gatherSystemPrompt();
        if (t) t += "\n\n";
        t += "=== CONVERSATION ===\n";
        const start = Math.max(0, ctx.chat.length - (maxMessages || 30));
        for (let i = start; i < ctx.chat.length; i++) {
            const m = ctx.chat[i]; if (!m) continue;
            const who = m.is_user ? (m.name || "User") : (m.name || "Character");
            t += who + ": " + (m.extra?.display_text ?? m.mes) + "\n\n";
        }
        return t.trim();
    }

    // ── API 호출 ──
    async function callApi(promptText) {
        const ctx = getContext();

        if (sumApiSource === "main") {
            // Main API - generateRaw
            const { generateRaw } = ctx;
            if (!generateRaw) throw new Error("generateRaw not available");
            const bg = gatherPlainContext(30);
            return await generateRaw({ systemPrompt: bg, prompt: promptText, streaming: false });
        } else {
            // Connection Profile
            const profileId = sumApiSource.replace("profile:", "");
            if (!profileId) throw new Error("프로필 ID 없음");
            if (!ctx.ConnectionManagerRequestService) throw new Error("Connection Manager 미로드");
            const msgs = gatherChatMessages(30);
            msgs.push({ role: "user", content: promptText });
            const resp = await ctx.ConnectionManagerRequestService.sendRequest(
                profileId, msgs, 8000,
                { stream: false, extractData: true, includePreset: false, includeInstruct: false }
            ).catch(e => { throw new Error("Profile 오류: " + e.message); });

            if (typeof resp === "string") return resp;
            if (resp?.choices?.[0]?.message) { const m = resp.choices[0].message; return m.reasoning_content || m.content || ""; }
            return resp?.content || resp?.message || "";
        }
    }

    // ── 요약 실행 ──
    async function startSummary(promptIdx) {
        if (sumGenerating) { if (typeof toastr !== "undefined") toastr.warning("생성 중입니다..."); return; }
        const ctx = getContext();
        if (!ctx?.chat?.length) { if (typeof toastr !== "undefined") toastr.warning("대화 내역이 없습니다."); return; }

        sumCurrentPromptIdx = promptIdx;
        sumGenerating = true;
        openSumResult();
        showSumLoading("⏳ 요약 생성 중...");

        try {
            // substituteParams가 있으면 {{char}} {{user}} 치환
            let prompt = SUMMARY_PROMPTS[promptIdx].prompt;
            if (ctx.substituteParams) prompt = ctx.substituteParams(prompt);

            const result = await callApi(prompt);
            if (!result?.trim()) throw new Error("빈 응답");

            sumVersions.push(result.trim());
            sumViewIdx = sumVersions.length - 1;
            renderSumResult();
        } catch (e) {
            console.error("[RT] 요약 실패:", e);
            sumDisplay.innerHTML = '<div class="sum-loading">❌ 요약 생성 실패: ' + escHtml(e.message) + '</div>';
        }
        sumGenerating = false;
    }

    async function regenSummary() {
        if (sumGenerating) return;
        const ctx = getContext();
        if (!ctx?.chat?.length) return;

        sumGenerating = true;
        showSumLoading("⏳ 재생성 중...");

        try {
            let prompt = SUMMARY_PROMPTS[sumCurrentPromptIdx].prompt;
            if (ctx.substituteParams) prompt = ctx.substituteParams(prompt);

            const result = await callApi(prompt);
            if (!result?.trim()) throw new Error("빈 응답");

            sumVersions.push(result.trim());
            sumViewIdx = sumVersions.length - 1;
            renderSumResult();
        } catch (e) {
            console.error("[RT] 재생성 실패:", e);
            if (sumVersions.length) renderSumResult();
            else sumDisplay.innerHTML = '<div class="sum-loading">❌ 재생성 실패</div>';
        }
        sumGenerating = false;
    }

    async function reviseSummary() {
        if (sumGenerating) return;
        const direction = sumReviseInput.value.trim();
        if (!direction) { if (typeof toastr !== "undefined") toastr.warning("수정 방향을 입력해주세요."); return; }
        if (!sumVersions.length) return;

        sumGenerating = true;
        showSumLoading("⏳ 수정 중...");

        try {
            const currentText = sumVersions[sumViewIdx];
            const ctx = getContext();
            let editPrompt = `(OOC: RP 중단. 아래는 이전에 생성한 요약입니다:\n\n${currentText}\n\n위 요약을 다음 방향으로 수정해줘: ${direction}\n\n한글본, 영어본으로 각각 코드블럭에 넣어줘.\n**RP는 절대 이어가지 말 것.**)`;
            if (ctx.substituteParams) editPrompt = ctx.substituteParams(editPrompt);

            const result = await callApi(editPrompt);
            if (!result?.trim()) throw new Error("빈 응답");

            sumVersions.push(result.trim());
            sumViewIdx = sumVersions.length - 1;
            renderSumResult();
            sumReviseInput.value = "";
        } catch (e) {
            console.error("[RT] 수정 실패:", e);
            if (sumVersions.length) renderSumResult();
            else sumDisplay.innerHTML = '<div class="sum-loading">❌ 수정 실패</div>';
        }
        sumGenerating = false;
    }

    // ── 복사 ──
    async function copySummary() {
        if (!sumVersions.length) return;
        const text = sumIsEditing ? sumEditor.value : sumVersions[sumViewIdx];
        if (navigator.clipboard && window.isSecureContext) {
            try { await navigator.clipboard.writeText(text); if (typeof toastr !== "undefined") toastr.success("복사 완료!", "RT", { timeOut: 1500 }); return; } catch (e) {}
        }
        // fallback
        const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;left:-9999px;"; document.body.appendChild(ta);
        ta.select(); try { document.execCommand("copy"); if (typeof toastr !== "undefined") toastr.success("복사 완료!", "RT", { timeOut: 1500 }); } catch (e) { if (typeof toastr !== "undefined") toastr.error("복사 실패"); }
        document.body.removeChild(ta);
    }

    // ── 이벤트 바인딩 ──
    document.getElementById("sum-prev").addEventListener("click", () => { if (sumViewIdx > 0) { sumViewIdx--; renderSumResult(); } });
    document.getElementById("sum-next").addEventListener("click", () => { if (sumViewIdx < sumVersions.length - 1) { sumViewIdx++; renderSumResult(); } });
    document.getElementById("sum-regen").addEventListener("click", regenSummary);
    document.getElementById("sum-copy").addEventListener("click", copySummary);
    document.getElementById("sum-revise-send").addEventListener("click", reviseSummary);
    sumReviseInput.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); reviseSummary(); } });

    function escHtml(s) { const d = document.createElement("span"); d.textContent = s; return d.innerHTML; }

    console.log("[RT] 📝 요약 기능 활성화!");
    console.log("[RT] 로드 완료!");
});
