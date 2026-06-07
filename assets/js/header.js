(function () {
    const root = document.documentElement;
    const header = document.querySelector(".lm-site-header");
    const announcement = document.querySelector(".lm-announcement");
    const nav = document.querySelector(".lm-desktop-nav");
    const openButton = nav ? nav.querySelector(".wp-block-navigation__responsive-container-open") : null;
    const topNoticeSelector = [
        "#wpadminbar",
        ".woocommerce-store-notice",
        ".woocommerce-store-notice__notice",
        ".demo_store",
    ].join(",");
    let frame = 0;

    const isVisible = (element) => {
        if (!element) {
            return false;
        }

        const style = window.getComputedStyle(element);

        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    };

    const measureTopNotices = (limit) => {
        let bottom = 0;

        document.querySelectorAll(topNoticeSelector).forEach((element) => {
            if (!isVisible(element)) {
                return;
            }

            const rect = element.getBoundingClientRect();
            const position = window.getComputedStyle(element).position;
            const isTopLayer = position === "fixed" || position === "sticky" || rect.top <= 4;

            if (!isTopLayer || rect.height <= 0 || rect.top > limit || rect.bottom > window.innerHeight * 0.55) {
                return;
            }

            bottom = Math.max(bottom, rect.bottom);
        });

        return bottom;
    };

    const updateHeaderMetrics = () => {
        frame = 0;

        const headerRect = header ? header.getBoundingClientRect() : null;
        const announcementRect = announcement ? announcement.getBoundingClientRect() : null;
        const openRect = openButton ? openButton.getBoundingClientRect() : null;
        const headerBottom = Math.max(
            headerRect ? headerRect.bottom : 0,
            announcementRect ? announcementRect.bottom : 0,
            openRect ? openRect.bottom : 0
        );
        const noticeBottom = measureTopNotices(Math.max(headerBottom, 160));
        const offset = Math.ceil(Math.max(headerBottom, noticeBottom, 0));

        root.style.setProperty("--lm-header-offset", `${offset}px`);
        root.style.setProperty("--lm-mobile-header-overlay-end", `${offset}px`);

        if (!openRect || openRect.width <= 0 || openRect.height <= 0) {
            return;
        }

        root.style.setProperty("--lm-mobile-menu-button-top", `${Math.round(Math.max(openRect.top, noticeBottom))}px`);
        root.style.setProperty("--lm-mobile-menu-button-left", `${Math.round(openRect.left)}px`);
        root.style.setProperty("--lm-mobile-menu-button-size", `${Math.round(openRect.width)}px`);
    };

    const requestUpdate = () => {
        if (frame) {
            return;
        }

        frame = window.requestAnimationFrame(updateHeaderMetrics);
    };

    requestUpdate();
    window.addEventListener("load", requestUpdate);
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("orientationchange", requestUpdate);
    window.addEventListener("scroll", requestUpdate, { passive: true });

    if (openButton) {
        openButton.addEventListener("pointerdown", updateHeaderMetrics);
        openButton.addEventListener("click", updateHeaderMetrics);
    }

    if ("MutationObserver" in window) {
        const observer = new MutationObserver(requestUpdate);
        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
        });
    }
})();

(function () {
    const config = window.linamiraSearch || {};
    const endpoint = config.endpoint;
    const forms = [...document.querySelectorAll(".lm-header-search, .lm-mobile-menu-search")];

    if (!endpoint || forms.length === 0) {
        return;
    }

    const minChars = Number(config.minChars || 2);
    const limit = Number(config.limit || 6);
    const strings = {
        loading: "Căutăm produse...",
        ready: "Rezultate rapide",
        empty: "Nu am găsit produse pentru această căutare.",
        hint: "Încearcă: lumânare, ulei, săpun sau difuzor.",
        allResults: "Vezi toate rezultatele",
        error: "Căutarea nu este disponibilă momentan.",
        ...(config.strings || {}),
    };
    const state = new WeakMap();

    const escapeHTML = (value) =>
        String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    const setExpanded = (input, expanded) => {
        input.setAttribute("aria-expanded", expanded ? "true" : "false");
    };

    const enhanceForm = (form, index) => {
        const input = form.querySelector('input[type="search"]');

        if (!input) {
            return null;
        }

        const id = input.id || `lm-search-input-${index + 1}`;
        const panelId = `${id}-results`;
        let panel = form.querySelector(".lm-search-panel");

        input.id = id;
        input.autocomplete = "off";
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-controls", panelId);
        setExpanded(input, false);

        if (!form.querySelector('input[name="post_type"]')) {
            const postTypeInput = document.createElement("input");
            postTypeInput.type = "hidden";
            postTypeInput.name = "post_type";
            postTypeInput.value = "product";
            form.appendChild(postTypeInput);
        }

        if (!panel) {
            panel = document.createElement("div");
            panel.className = "lm-search-panel";
            panel.hidden = true;
            form.appendChild(panel);
        }

        panel.id = panelId;
        panel.dataset.lmSearchResults = "";
        panel.setAttribute("role", "region");
        panel.setAttribute("aria-label", "Rezultate căutare");

        return { input, panel };
    };

    const getFormParts = (form) => {
        const input = form.querySelector('input[type="search"]');
        const panel = form.querySelector(".lm-search-panel");

        return input && panel ? { input, panel } : null;
    };

    const hidePanel = (form) => {
        const parts = getFormParts(form);

        if (!parts) {
            return;
        }

        parts.panel.hidden = true;
        parts.panel.innerHTML = "";
        setExpanded(parts.input, false);
    };

    const showMessage = (form, message, hint = "") => {
        const parts = getFormParts(form);

        if (!parts) {
            return;
        }

        parts.panel.innerHTML = `
            <div class="lm-search-panel__state" role="status">
                <strong>${escapeHTML(message)}</strong>
                ${hint ? `<span>${escapeHTML(hint)}</span>` : ""}
            </div>
        `;
        parts.panel.hidden = false;
        setExpanded(parts.input, true);
    };

    const resultTemplate = (item) => `
        <a class="lm-search-result" href="${escapeHTML(item.url)}">
            <span class="lm-search-result__image">
                <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.imageAlt || item.title)}" loading="lazy" />
            </span>
            <span class="lm-search-result__body">
                ${item.category ? `<span class="lm-search-result__category">${escapeHTML(item.category)}</span>` : ""}
                <span class="lm-search-result__title">${escapeHTML(item.title)}</span>
                ${item.excerpt ? `<span class="lm-search-result__excerpt">${escapeHTML(item.excerpt)}</span>` : ""}
                ${item.priceHtml ? `<span class="lm-search-result__price">${item.priceHtml}</span>` : ""}
            </span>
        </a>
    `;

    const renderResults = (form, data) => {
        const parts = getFormParts(form);
        const items = Array.isArray(data.items) ? data.items : [];

        if (!parts) {
            return;
        }

        if (items.length === 0) {
            showMessage(form, strings.empty, strings.hint);
            return;
        }

        parts.panel.innerHTML = `
            <div class="lm-search-panel__label">${escapeHTML(strings.ready)}</div>
            <div class="lm-search-panel__list">
                ${items.map(resultTemplate).join("")}
            </div>
            <a class="lm-search-panel__all" href="${escapeHTML(data.searchUrl || form.action)}">${escapeHTML(strings.allResults)}</a>
        `;
        parts.panel.hidden = false;
        setExpanded(parts.input, true);
    };

    const searchProducts = (form) => {
        const parts = getFormParts(form);

        if (!parts) {
            return;
        }

        const query = parts.input.value.trim();
        const currentState = state.get(form) || {};

        window.clearTimeout(currentState.timer);

        if (currentState.controller) {
            currentState.controller.abort();
        }

        if (query.length < minChars) {
            hidePanel(form);
            state.set(form, { ...currentState, controller: null, timer: 0, query });
            return;
        }

        const timer = window.setTimeout(async () => {
            const controller = new AbortController();
            state.set(form, { ...currentState, controller, timer: 0, query });
            showMessage(form, strings.loading);

            try {
                const url = new URL(endpoint);
                url.searchParams.set("search", query);
                url.searchParams.set("limit", String(limit));

                const response = await fetch(url.toString(), {
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Search request failed: ${response.status}`);
                }

                const data = await response.json();

                if (parts.input.value.trim() !== query) {
                    return;
                }

                renderResults(form, data);
            } catch (error) {
                if (error.name === "AbortError") {
                    return;
                }

                showMessage(form, strings.error, strings.hint);
            }
        }, 220);

        state.set(form, { ...currentState, timer, query });
    };

    const focusResult = (panel, direction) => {
        const links = [...panel.querySelectorAll("a")];

        if (links.length === 0) {
            return;
        }

        const currentIndex = links.indexOf(document.activeElement);
        const nextIndex = currentIndex < 0
            ? 0
            : (currentIndex + direction + links.length) % links.length;

        links[nextIndex].focus();
    };

    forms.forEach((form, index) => {
        const parts = enhanceForm(form, index);

        if (!parts) {
            return;
        }

        parts.input.addEventListener("input", () => searchProducts(form));

        parts.input.addEventListener("focus", () => {
            if (parts.input.value.trim().length >= minChars && parts.panel.innerHTML.trim() !== "") {
                parts.panel.hidden = false;
                setExpanded(parts.input, true);
            }
        });

        parts.input.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                hidePanel(form);
                return;
            }

            if (event.key === "ArrowDown" && !parts.panel.hidden) {
                event.preventDefault();
                focusResult(parts.panel, 1);
            }
        });

        parts.panel.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                hidePanel(form);
                parts.input.focus();
                return;
            }

            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                focusResult(parts.panel, event.key === "ArrowDown" ? 1 : -1);
            }
        });
    });

    document.addEventListener("click", (event) => {
        forms.forEach((form) => {
            if (event.target instanceof Node && form.contains(event.target)) {
                return;
            }

            hidePanel(form);
        });
    });
})();

(function () {
    const sticky = document.querySelector("[data-lm-sticky-atc]");

    if (!sticky) {
        return;
    }

    const submit = sticky.querySelector("[data-lm-sticky-atc-submit]");
    const form = document.querySelector("body.single-product form.cart");
    const originalButton = form ? form.querySelector(".single_add_to_cart_button") : null;
    const mobileQuery = window.matchMedia("(max-width: 759px)");
    let originalVisible = true;
    let hasScrolled = window.scrollY > 260;

    if (!submit || !form || !originalButton) {
        sticky.remove();
        return;
    }

    const syncDisabledState = () => {
        const disabled = originalButton.disabled || originalButton.classList.contains("disabled");
        submit.disabled = disabled;
        submit.setAttribute("aria-disabled", disabled ? "true" : "false");
    };

    const setVisible = (visible) => {
        sticky.classList.toggle("is-visible", visible);
        sticky.setAttribute("aria-hidden", visible ? "false" : "true");
        document.body.classList.toggle("lm-sticky-atc-visible", visible);
    };

    const updateSticky = () => {
        syncDisabledState();
        setVisible(mobileQuery.matches && hasScrolled && !originalVisible);
    };

    const submitOriginalForm = () => {
        syncDisabledState();

        if (submit.disabled) {
            return;
        }

        if (typeof form.requestSubmit === "function") {
            form.requestSubmit(originalButton);
            return;
        }

        originalButton.click();
    };

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
            ([entry]) => {
                originalVisible = Boolean(entry && entry.isIntersecting);
                updateSticky();
            },
            {
                rootMargin: "0px 0px -12% 0px",
                threshold: 0,
            }
        );

        observer.observe(form);
    } else {
        originalVisible = false;
    }

    submit.addEventListener("click", submitOriginalForm);
    form.addEventListener("change", syncDisabledState);
    form.addEventListener("input", syncDisabledState);

    window.addEventListener(
        "scroll",
        () => {
            hasScrolled = window.scrollY > 260;
            updateSticky();
        },
        { passive: true }
    );

    if (typeof mobileQuery.addEventListener === "function") {
        mobileQuery.addEventListener("change", updateSticky);
    } else {
        mobileQuery.addListener(updateSticky);
    }

    updateSticky();
})();

(function () {
    const nav = document.querySelector(".woocommerce-MyAccount-navigation");
    const list = nav ? nav.querySelector("ul") : null;

    if (!nav || !list) {
        return;
    }

    const mobileQuery = window.matchMedia("(max-width: 899px)");
    const previous = document.createElement("button");
    const next = document.createElement("button");

    previous.type = "button";
    previous.className = "lm-account-nav-arrow";
    previous.dataset.direction = "previous";
    previous.setAttribute("aria-label", "Derulează meniul contului spre stânga");
    previous.textContent = "‹";

    next.type = "button";
    next.className = "lm-account-nav-arrow";
    next.dataset.direction = "next";
    next.setAttribute("aria-label", "Derulează meniul contului spre dreapta");
    next.textContent = "›";

    nav.insertBefore(previous, list);
    nav.appendChild(next);

    const getScrollStep = () => Math.max(160, Math.round(list.clientWidth * 0.72));

    const update = () => {
        const isMobile = mobileQuery.matches;
        const maxScroll = Math.max(0, list.scrollWidth - list.clientWidth - 1);
        const isScrollable = isMobile && maxScroll > 0;

        nav.classList.toggle("is-scrollable", isScrollable);
        previous.disabled = !isScrollable || list.scrollLeft <= 1;
        next.disabled = !isScrollable || list.scrollLeft >= maxScroll;
    };

    const scrollByDirection = (direction) => {
        list.scrollBy({
            left: direction * getScrollStep(),
            behavior: "smooth",
        });
    };

    previous.addEventListener("click", () => scrollByDirection(-1));
    next.addEventListener("click", () => scrollByDirection(1));
    list.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("load", update);

    if (typeof mobileQuery.addEventListener === "function") {
        mobileQuery.addEventListener("change", update);
    } else {
        mobileQuery.addListener(update);
    }

    window.requestAnimationFrame(() => {
        const activeLink = list.querySelector(".is-active a");

        if (activeLink && mobileQuery.matches) {
            activeLink.scrollIntoView({ block: "nearest", inline: "center" });
        }

        update();
    });
})();
