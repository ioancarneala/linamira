(function () {
    const defaultCountry = "RO";
    const sameBillingLabel = "Folosește aceeași adresă pentru facturare";
    let hasUserChangedSameBilling = false;
    let isApplyingSameBillingDefault = false;

    const triggerFieldUpdate = (field) => {
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const setCountryIfEmpty = (field) => {
        if (!field || field.dataset.lmCheckoutCountryDefaulted === "true") {
            return;
        }

        if (field.value && field.value !== "") {
            field.dataset.lmCheckoutCountryDefaulted = "true";
            return;
        }

        const option = [...field.options].find((item) => item.value === defaultCountry);

        if (!option) {
            return;
        }

        field.value = defaultCountry;
        field.dataset.lmCheckoutCountryDefaulted = "true";
        triggerFieldUpdate(field);
    };

    const getSameBillingCheckbox = () => {
        const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')];

        return checkboxes.find((checkbox) => {
            const label = checkbox.closest("label") || document.querySelector(`label[for="${checkbox.id}"]`);

            return label && label.textContent.trim().includes(sameBillingLabel);
        });
    };

    const setSameBillingDefault = () => {
        const checkbox = getSameBillingCheckbox();

        if (!checkbox || checkbox.checked || hasUserChangedSameBilling) {
            return;
        }

        isApplyingSameBillingDefault = true;
        checkbox.click();
        window.setTimeout(() => {
            isApplyingSameBillingDefault = false;
        }, 0);
    };

    const setCheckoutDefaults = () => {
        document
            .querySelectorAll(
                'select[name="shipping-country"], select[name="billing-country"], select[name="shipping_country"], select[name="billing_country"]'
            )
            .forEach(setCountryIfEmpty);
        setSameBillingDefault();
    };

    const normalizeStripeElements = () => {
        document.querySelectorAll(".__PrivateStripeElement").forEach((element) => {
            element.style.setProperty("margin", "0", "important");
        });
    };

    const updateCheckout = () => {
        setCheckoutDefaults();
        normalizeStripeElements();
    };

    document.addEventListener("change", (event) => {
        const checkbox = event.target instanceof HTMLInputElement ? event.target : null;

        if (!isApplyingSameBillingDefault && checkbox === getSameBillingCheckbox()) {
            hasUserChangedSameBilling = true;
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", updateCheckout, { once: true });
    } else {
        updateCheckout();
    }

    const observer = new MutationObserver(updateCheckout);
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 10000);
})();
