(function () {
    const toggle = document.querySelector(".lm-menu-toggle");
    const panel = document.getElementById("lm-menu-panel");
    const header = document.querySelector("[data-lm-header]");
    const announcement = document.querySelector(".lm-announcement");

    if (!toggle || !panel) {
        return;
    }

    const focusableSelector = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopHeaderQuery = window.matchMedia("(min-width: 1120px)");
    let restoreTarget = null;
    let closeTimer = 0;

    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

    const updateMenuOffset = () => {
        const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
        const announcementBottom = announcement ? announcement.getBoundingClientRect().bottom : 0;
        const offset = Math.max(headerBottom, announcementBottom, 0);

        document.documentElement.style.setProperty("--lm-header-offset", `${Math.ceil(offset)}px`);
    };

    const focusSafely = (element) => {
        if (!element || typeof element.focus !== "function") {
            return;
        }

        try {
            element.focus({ preventScroll: true });
        } catch {
            element.focus();
        }
    };

    const getPanelFocusable = () => [...panel.querySelectorAll(focusableSelector)];

    const openMenu = () => {
        if (isOpen() || desktopHeaderQuery.matches) {
            return;
        }

        window.clearTimeout(closeTimer);
        updateMenuOffset();
        restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : toggle;

        panel.hidden = false;
        panel.setAttribute("aria-hidden", "false");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Închide meniul");
        document.body.classList.add("lm-menu-open");

        window.requestAnimationFrame(() => {
            panel.classList.add("is-open");
        });
    };

    const closeMenu = ({ restoreFocus = true } = {}) => {
        if (!isOpen() && panel.hidden) {
            return;
        }

        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Meniu");
        panel.setAttribute("aria-hidden", "true");
        panel.classList.remove("is-open");
        document.body.classList.remove("lm-menu-open");

        const hidePanel = () => {
            panel.hidden = true;
        };

        if (reduceMotionQuery.matches) {
            hidePanel();
        } else {
            closeTimer = window.setTimeout(hidePanel, 240);
        }

        if (restoreFocus) {
            focusSafely(restoreTarget || toggle);
        }
    };

    toggle.addEventListener("click", () => {
        if (isOpen()) {
            closeMenu();
            return;
        }

        openMenu();
    });

    document.addEventListener("keydown", (event) => {
        if (!isOpen()) {
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
            return;
        }

        if (event.key !== "Tab") {
            return;
        }

        const panelFocusable = getPanelFocusable();
        const firstPanelItem = panelFocusable[0];
        const lastPanelItem = panelFocusable[panelFocusable.length - 1];

        if (!firstPanelItem || !lastPanelItem) {
            event.preventDefault();
            focusSafely(toggle);
            return;
        }

        if (document.activeElement === toggle && !event.shiftKey) {
            event.preventDefault();
            focusSafely(firstPanelItem);
            return;
        }

        if (document.activeElement === toggle && event.shiftKey) {
            event.preventDefault();
            focusSafely(lastPanelItem);
            return;
        }

        if (event.shiftKey && document.activeElement === firstPanelItem) {
            event.preventDefault();
            focusSafely(toggle);
            return;
        }

        if (!event.shiftKey && document.activeElement === lastPanelItem) {
            event.preventDefault();
            focusSafely(toggle);
        }
    });

    panel.addEventListener("click", (event) => {
        if (!(event.target instanceof Element) || !event.target.closest("a")) {
            return;
        }

        closeMenu({ restoreFocus: false });
    });

    const handleDesktopHeaderChange = (event) => {
        if (event.matches) {
            closeMenu({ restoreFocus: false });
        }
    };

    updateMenuOffset();
    window.addEventListener("resize", updateMenuOffset);
    window.addEventListener("load", updateMenuOffset);

    if (typeof desktopHeaderQuery.addEventListener === "function") {
        desktopHeaderQuery.addEventListener("change", handleDesktopHeaderChange);
    } else {
        desktopHeaderQuery.addListener(handleDesktopHeaderChange);
    }
})();

(function () {
    const config = window.linamiraSearch || {};
    const endpoint = config.endpoint;
    const forms = [...document.querySelectorAll("[data-lm-search]")];

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

    const getFormParts = (form) => {
        const input = form.querySelector("[data-lm-search-input]");
        const panel = form.querySelector("[data-lm-search-results]");

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

    forms.forEach((form) => {
        const parts = getFormParts(form);

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
        setVisible(mobileQuery.matches && hasScrolled && !originalVisible && !document.body.classList.contains("lm-menu-open"));
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

(function () {
    const cart = document.querySelector(".lm-header-cart");

    if (!cart) {
        return;
    }

    const config = window.linamiraHeader || {};
    let currentCount = null;
    const getCountElement = () => cart.querySelector("[data-lm-cart-count]");
    const parseCount = (value) => {
        const count = Number.parseInt(String(value || "0").replace(/\D/g, ""), 10);

        return Number.isFinite(count) ? Math.max(0, count) : 0;
    };
    const getLabel = (count) => {
        if (count === 1) {
            return config.cartLabelSingular || "Coș, 1 produs";
        }

        if (count > 1) {
            const template = config.cartLabelPlural || "Coș, %d produse";

            return template.replace("%d", String(count));
        }

        return config.cartLabel || "Coș";
    };
    const syncCartCount = (count) => {
        const countElement = getCountElement();

        if (!countElement) {
            return;
        }

        if (countElement.textContent !== String(count)) {
            countElement.textContent = String(count);
        }

        countElement.classList.toggle("is-visible", count > 0);
        cart.setAttribute("aria-label", getLabel(count));
        currentCount = count;
    };

    syncCartCount(parseCount(config.cartCount));

    const observer = new MutationObserver(() => {
        const countElement = getCountElement();

        if (!countElement) {
            return;
        }

        const count = parseCount(countElement.textContent);

        if (count !== currentCount) {
            syncCartCount(count);
        }
    });

    observer.observe(cart, {
        childList: true,
        subtree: true,
        characterData: true,
    });
})();
