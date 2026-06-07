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
