<?php
/**
 * LINAMIRA theme setup.
 */

if (! defined('ABSPATH')) {
    exit;
}

function linamira_update_stylesheet(): string
{
    $stylesheet = function_exists('get_stylesheet') ? (string) get_stylesheet() : 'linamira';
    $theme = function_exists('wp_get_theme') ? wp_get_theme($stylesheet) : null;

    if ($theme instanceof WP_Theme && $theme->exists()) {
        $text_domain = (string) $theme->get('TextDomain');
        $theme_name = (string) $theme->get('Name');

        if ('linamira' === $text_domain || 'LINAMIRA' === $theme_name) {
            return $stylesheet;
        }
    }

    return 'linamira';
}

function linamira_update_repository(): string
{
    $repository = defined('LINAMIRA_UPDATE_REPOSITORY')
        ? (string) LINAMIRA_UPDATE_REPOSITORY
        : 'ioancarneala/linamira';

    $repository = trim((string) apply_filters('linamira_update_repository', $repository));

    return preg_match('/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/', $repository) ? $repository : '';
}

function linamira_update_branch(): string
{
    $branch = defined('LINAMIRA_UPDATE_BRANCH') ? (string) LINAMIRA_UPDATE_BRANCH : 'main';
    $branch = trim((string) apply_filters('linamira_update_branch', $branch));

    return '' !== $branch ? $branch : 'main';
}

function linamira_update_encode_branch(string $branch): string
{
    return implode('/', array_map('rawurlencode', explode('/', $branch)));
}

function linamira_update_header_from_string(string $content, string $header): string
{
    $pattern = '/^[ \t\/*#@]*' . preg_quote($header, '/') . ':(.*)$/mi';

    if (! preg_match($pattern, $content, $matches)) {
        return '';
    }

    return trim((string) $matches[1]);
}

function linamira_update_normalize_version(string $version): string
{
    return (string) preg_replace('/[^0-9A-Za-z.+-]/', '', ltrim(trim($version), 'vV'));
}

function linamira_update_metadata(): array
{
    static $metadata = null;

    if (null !== $metadata) {
        return $metadata;
    }

    $metadata = [];
    $repository = linamira_update_repository();

    if ('' === $repository) {
        return $metadata;
    }

    $branch = linamira_update_branch();
    $encoded_branch = linamira_update_encode_branch($branch);
    $style_url = sprintf('https://api.github.com/repos/%s/contents/style.css?ref=%s', $repository, $encoded_branch);
    $package_url = sprintf('https://github.com/%s/archive/refs/heads/%s.zip', $repository, $encoded_branch);
    $project_url = sprintf('https://github.com/%s', $repository);

    $response = wp_remote_get(
        $style_url,
        [
            'headers' => [
                'Accept' => 'application/vnd.github.raw',
                'User-Agent' => 'LINAMIRA theme updater; ' . home_url('/'),
            ],
            'redirection' => 3,
            'timeout' => 10,
        ]
    );

    if (is_wp_error($response) || 200 !== wp_remote_retrieve_response_code($response)) {
        return $metadata;
    }

    $body = (string) wp_remote_retrieve_body($response);
    $version = linamira_update_normalize_version(linamira_update_header_from_string($body, 'Version'));

    if ('' === $version) {
        return $metadata;
    }

    $metadata = [
        'branch' => $branch,
        'new_version' => $version,
        'package' => $package_url,
        'url' => $project_url,
        'requires' => linamira_update_header_from_string($body, 'Requires at least') ?: '6.6',
        'requires_php' => linamira_update_header_from_string($body, 'Requires PHP') ?: '8.1',
        'tested' => linamira_update_header_from_string($body, 'Tested up to') ?: '',
    ];

    return $metadata;
}

function linamira_update_payload(array $metadata): array
{
    return [
        'theme' => linamira_update_stylesheet(),
        'new_version' => $metadata['new_version'],
        'url' => $metadata['url'],
        'package' => $metadata['package'],
        'requires' => $metadata['requires'],
        'requires_php' => $metadata['requires_php'],
    ];
}

add_filter('pre_set_site_transient_update_themes', function ($transient) {
    if (! is_object($transient)) {
        return $transient;
    }

    $stylesheet = linamira_update_stylesheet();
    $theme = wp_get_theme($stylesheet);

    if (! $theme->exists()) {
        return $transient;
    }

    $metadata = linamira_update_metadata();

    if (empty($metadata['new_version'])) {
        return $transient;
    }

    $payload = linamira_update_payload($metadata);

    if (! isset($transient->response) || ! is_array($transient->response)) {
        $transient->response = [];
    }

    if (! isset($transient->no_update) || ! is_array($transient->no_update)) {
        $transient->no_update = [];
    }

    if (version_compare((string) $metadata['new_version'], (string) $theme->get('Version'), '>')) {
        $transient->response[$stylesheet] = $payload;
        unset($transient->no_update[$stylesheet]);
    } else {
        $transient->no_update[$stylesheet] = $payload;
        unset($transient->response[$stylesheet]);
    }

    return $transient;
});

add_filter('themes_api', function ($result, string $action, $args) {
    if ('theme_information' !== $action || empty($args->slug) || linamira_update_stylesheet() !== $args->slug) {
        return $result;
    }

    $metadata = linamira_update_metadata();

    if (empty($metadata['new_version'])) {
        return $result;
    }

    return (object) [
        'name' => 'LINAMIRA',
        'slug' => linamira_update_stylesheet(),
        'version' => $metadata['new_version'],
        'author' => 'LINAMIRA',
        'homepage' => $metadata['url'],
        'requires' => $metadata['requires'],
        'requires_php' => $metadata['requires_php'],
        'sections' => [
            'description' => 'Custom WooCommerce theme for LINAMIRA.',
            'changelog' => sprintf(
                'Latest update package is built from the %s branch on GitHub.',
                esc_html((string) $metadata['branch'])
            ),
        ],
    ];
}, 10, 3);

add_filter('upgrader_source_selection', function ($source, $remote_source, $upgrader, $hook_extra) {
    unset($upgrader, $hook_extra);

    global $wp_filesystem;

    $source_path = untrailingslashit((string) $source);

    if (! $wp_filesystem || linamira_update_stylesheet() === basename($source_path)) {
        return $source;
    }

    $style_path = trailingslashit($source_path) . 'style.css';

    if (! $wp_filesystem->exists($style_path)) {
        return $source;
    }

    $style_headers = (string) $wp_filesystem->get_contents($style_path);
    $text_domain = linamira_update_header_from_string($style_headers, 'Text Domain');
    $theme_name = linamira_update_header_from_string($style_headers, 'Theme Name');

    if (linamira_update_stylesheet() !== $text_domain && 'LINAMIRA' !== $theme_name) {
        return $source;
    }

    $target_root = '' !== (string) $remote_source ? (string) $remote_source : dirname($source_path);
    $target = trailingslashit($target_root) . linamira_update_stylesheet();

    if ($wp_filesystem->exists($target)) {
        $wp_filesystem->delete($target, true);
    }

    return $wp_filesystem->move($source_path, $target, true) ? trailingslashit($target) : $source;
}, 10, 4);

function linamira_asset_version(string $relative_path): string
{
    $path = get_theme_file_path($relative_path);

    if (file_exists($path)) {
        return (string) filemtime($path);
    }

    return wp_get_theme()->get('Version');
}

function linamira_get_cart_count(): int
{
    if (! function_exists('WC') || ! WC()->cart) {
        return 0;
    }

    return max(0, (int) WC()->cart->get_cart_contents_count());
}

function linamira_get_cart_count_markup(): string
{
    $count = linamira_get_cart_count();

    return sprintf(
        '<span class="lm-cart-count%s" data-lm-cart-count aria-hidden="true">%d</span>',
        $count > 0 ? ' is-visible' : '',
        $count
    );
}

add_action('after_setup_theme', function (): void {
    add_theme_support('woocommerce');
    add_theme_support('wp-block-styles');
    add_theme_support('editor-styles');

    add_editor_style('assets/css/linamira.css');
});

add_action('wp_enqueue_scripts', function (): void {
    wp_enqueue_style(
        'linamira-foundation',
        get_theme_file_uri('assets/css/linamira.css'),
        [],
        linamira_asset_version('assets/css/linamira.css')
    );

    wp_enqueue_script(
        'linamira-header',
        get_theme_file_uri('assets/js/header.js'),
        [],
        linamira_asset_version('assets/js/header.js'),
        true
    );
    wp_localize_script(
        'linamira-header',
        'linamiraSearch',
        [
            'endpoint' => esc_url_raw(rest_url('linamira/v1/product-search')),
            'minChars' => 2,
            'limit' => 6,
            'strings' => [
                'loading' => __('Căutăm produse...', 'linamira'),
                'ready' => __('Rezultate rapide', 'linamira'),
                'empty' => __('Nu am găsit produse pentru această căutare.', 'linamira'),
                'hint' => __('Încearcă: lumânare, ulei, săpun sau difuzor.', 'linamira'),
                'allResults' => __('Vezi toate rezultatele', 'linamira'),
                'error' => __('Căutarea nu este disponibilă momentan.', 'linamira'),
            ],
        ]
    );
    wp_localize_script(
        'linamira-header',
        'linamiraHeader',
        [
            'cartCount' => linamira_get_cart_count(),
            'cartLabel' => __('Coș', 'linamira'),
            'cartLabelSingular' => __('Coș, 1 produs', 'linamira'),
            'cartLabelPlural' => __('Coș, %d produse', 'linamira'),
        ]
    );
    wp_script_add_data('linamira-header', 'strategy', 'defer');

    if (function_exists('is_checkout') && is_checkout()) {
        wp_enqueue_script(
            'linamira-checkout',
            get_theme_file_uri('assets/js/checkout.js'),
            [],
            linamira_asset_version('assets/js/checkout.js'),
            true
        );
        wp_script_add_data('linamira-checkout', 'strategy', 'defer');
    }
});

add_filter('woocommerce_add_to_cart_fragments', function (array $fragments): array {
    $fragments['.lm-header-cart .lm-cart-count'] = linamira_get_cart_count_markup();

    return $fragments;
});

add_action('rest_api_init', function (): void {
    register_rest_route(
        'linamira/v1',
        '/product-search',
        [
            'methods' => WP_REST_Server::READABLE,
            'permission_callback' => '__return_true',
            'args' => [
                'search' => [
                    'type' => 'string',
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                'limit' => [
                    'type' => 'integer',
                    'default' => 6,
                    'sanitize_callback' => 'absint',
                ],
            ],
            'callback' => 'linamira_rest_product_search',
        ]
    );
});

function linamira_rest_product_search(WP_REST_Request $request): WP_REST_Response
{
    if (! function_exists('wc_get_product')) {
        return rest_ensure_response(
            [
                'items' => [],
                'searchUrl' => home_url('/?s=' . rawurlencode((string) $request->get_param('search'))),
            ]
        );
    }

    $term = trim((string) $request->get_param('search'));
    $limit = min(8, max(1, absint($request->get_param('limit') ?: 6)));

    if (mb_strlen($term) < 2) {
        return rest_ensure_response(
            [
                'items' => [],
                'searchUrl' => home_url('/?s=' . rawurlencode($term) . '&post_type=product'),
            ]
        );
    }

    $query = new WP_Query(
        [
            'fields' => 'ids',
            'no_found_rows' => true,
            'orderby' => 'relevance',
            'post_status' => 'publish',
            'post_type' => 'product',
            'posts_per_page' => $limit,
            's' => $term,
            'tax_query' => [
                [
                    'taxonomy' => 'product_visibility',
                    'field' => 'name',
                    'terms' => ['exclude-from-search', 'exclude-from-catalog'],
                    'operator' => 'NOT IN',
                ],
            ],
        ]
    );

    $items = [];

    foreach ($query->posts as $product_id) {
        $product = wc_get_product((int) $product_id);

        if (! $product instanceof WC_Product || ! $product->is_visible()) {
            continue;
        }

        $image_id = $product->get_image_id();
        $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail') : '';

        if (! $image_url) {
            $image_url = wc_placeholder_img_src('woocommerce_thumbnail');
        }

        $categories = wp_get_post_terms((int) $product_id, 'product_cat', ['fields' => 'names']);
        $excerpt = linamira_normalize_meta_description($product->get_short_description());

        $items[] = [
            'id' => (int) $product_id,
            'title' => html_entity_decode($product->get_name(), ENT_QUOTES, get_bloginfo('charset')),
            'url' => get_permalink((int) $product_id),
            'image' => esc_url_raw($image_url),
            'imageAlt' => $product->get_name(),
            'priceHtml' => wp_kses_post($product->get_price_html()),
            'category' => ! empty($categories) ? html_entity_decode((string) $categories[0], ENT_QUOTES, get_bloginfo('charset')) : '',
            'excerpt' => $excerpt,
        ];
    }

    return rest_ensure_response(
        [
            'items' => $items,
            'searchUrl' => home_url('/?s=' . rawurlencode($term) . '&post_type=product'),
        ]
    );
}

function linamira_normalize_meta_description(string $description): string
{
    $description = trim((string) preg_replace('/\s+/', ' ', wp_strip_all_tags($description)));

    if ('' === $description) {
        return '';
    }

    return wp_html_excerpt($description, 155, '');
}

function linamira_get_document_meta_description(): string
{
    if (function_exists('is_product') && is_product() && function_exists('wc_get_product')) {
        $product = wc_get_product(get_queried_object_id());

        if ($product instanceof WC_Product) {
            $description = linamira_normalize_meta_description((string) get_post_meta($product->get_id(), '_linamira_seo_description', true));

            if ('' === $description) {
                $description = linamira_normalize_meta_description($product->get_short_description());
            }

            if ('' === $description) {
                $description = linamira_normalize_meta_description($product->get_description());
            }

            if ('' !== $description) {
                return $description;
            }

            return sprintf(
                __('%s de la Linamira, produs ales pentru seri liniștite acasă.', 'linamira'),
                $product->get_name()
            );
        }
    }

    if (function_exists('is_product_category') && is_product_category()) {
        $term = get_queried_object();

        if ($term instanceof WP_Term) {
            $description = linamira_normalize_meta_description(term_description($term->term_id, $term->taxonomy));

            if ('' !== $description) {
                return $description;
            }

            return sprintf(
                __('Descoperă %s la Linamira: produse alese pentru casă, cadouri și momente de răsfăț.', 'linamira'),
                html_entity_decode($term->name, ENT_QUOTES, get_bloginfo('charset'))
            );
        }
    }

    if (function_exists('is_shop') && is_shop()) {
        return __('Descoperă produsele Linamira pentru casă: lumânări, parfumuri, difuzoare, săpunuri și accesorii atent alese.', 'linamira');
    }

    if (is_front_page() || is_home()) {
        return __('Linamira oferă cadouri și produse de răsfăț pentru acasă: lumânări, parfumuri, săpunuri și accesorii atent alese.', 'linamira');
    }

    if (function_exists('is_account_page') && is_account_page()) {
        return __('Intră în contul Linamira pentru comenzi, adrese și detalii de livrare.', 'linamira');
    }

    if (function_exists('is_cart') && is_cart()) {
        return __('Revizuiește produsele din coșul Linamira și pregătește comanda pentru livrare.', 'linamira');
    }

    if (function_exists('is_checkout') && is_checkout()) {
        return __('Finalizează comanda Linamira cu datele de livrare, plată și facturare.', 'linamira');
    }

    if (is_singular()) {
        $post = get_queried_object();

        if ($post instanceof WP_Post) {
            $description = linamira_normalize_meta_description($post->post_excerpt);

            if ('' === $description) {
                $description = linamira_normalize_meta_description($post->post_content);
            }

            if ('' !== $description) {
                return $description;
            }
        }
    }

    return linamira_normalize_meta_description(get_bloginfo('description'));
}

add_action('wp_head', function (): void {
    $description = linamira_get_document_meta_description();

    if ('' === $description) {
        return;
    }

    echo "\n" . '<meta name="description" content="' . esc_attr($description) . '">' . "\n";
}, 5);

add_action('template_redirect', function (): void {
    if (is_admin() || wp_doing_ajax()) {
        return;
    }

    $request_path = trim((string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
    $category_redirects = [
        'seturi-cadou' => 'shop',
        'ritualuri-de-baie' => 'categorie-produs/baie-dus',
        'parfum-pentru-casa' => 'categorie-produs/parfum-pentru-casa',
        'lumanari-ceara-parfumata' => 'categorie-produs/lumanari-ceara-parfumata',
        'difuzoare-de-arome' => 'categorie-produs/difuzoare-de-arome',
        'baie-dus' => 'categorie-produs/baie-dus',
        'sapunuri' => 'categorie-produs/sapunuri',
        'accesorii-cadouri-mici' => 'categorie-produs/accesorii-cadouri-mici',
        'product-category/seturi-cadou' => 'shop',
        'product-category/ritualuri-de-baie' => 'categorie-produs/baie-dus',
        'product-category/parfum-pentru-casa' => 'categorie-produs/parfum-pentru-casa',
        'product-category/lumanari-ceara-parfumata' => 'categorie-produs/lumanari-ceara-parfumata',
        'product-category/difuzoare-de-arome' => 'categorie-produs/difuzoare-de-arome',
        'product-category/baie-dus' => 'categorie-produs/baie-dus',
        'product-category/sapunuri' => 'categorie-produs/sapunuri',
        'product-category/accesorii-cadouri-mici' => 'categorie-produs/accesorii-cadouri-mici',
    ];

    if (! isset($category_redirects[$request_path])) {
        return;
    }

    wp_safe_redirect(home_url('/' . $category_redirects[$request_path] . '/'), 301);
    exit;
});

add_action('wp_footer', function (): void {
    if (! function_exists('is_product') || ! is_product() || ! function_exists('wc_get_product')) {
        return;
    }

    $product = wc_get_product(get_queried_object_id());

    if (! $product instanceof WC_Product || ! $product->is_purchasable() || ! $product->is_in_stock()) {
        return;
    }

    $price_html = $product->get_price_html();

    if ('' === trim((string) $price_html)) {
        return;
    }

    ?>
    <aside class="lm-sticky-atc" data-lm-sticky-atc aria-label="<?php echo esc_attr__('Cumpărare rapidă', 'linamira'); ?>" aria-hidden="true">
        <div class="lm-sticky-atc__inner">
            <div class="lm-sticky-atc__summary">
                <span class="lm-sticky-atc__label"><?php esc_html_e('Produs selectat', 'linamira'); ?></span>
                <strong class="lm-sticky-atc__title"><?php echo esc_html($product->get_name()); ?></strong>
                <span class="lm-sticky-atc__price"><?php echo wp_kses_post($price_html); ?></span>
            </div>
            <button class="lm-sticky-atc__button" type="button" data-lm-sticky-atc-submit>
                <?php echo esc_html($product->single_add_to_cart_text()); ?>
            </button>
        </div>
    </aside>
    <?php
}, 30);

add_filter('woocommerce_single_product_image_thumbnail_html', function (string $html, $post_thumbnail_id): string {
    if (absint($post_thumbnail_id) || ! str_contains($html, 'woocommerce-product-gallery__image--placeholder')) {
        return $html;
    }

    if (! class_exists('WP_HTML_Tag_Processor') || ! function_exists('wc_get_image_size')) {
        return $html;
    }

    $dimensions = wc_get_image_size('woocommerce_single');
    $width = isset($dimensions['width']) ? (int) $dimensions['width'] : 600;
    $height = isset($dimensions['height']) ? (int) $dimensions['height'] : 600;

    if ($width <= 0) {
        $width = 600;
    }

    if ($height <= 0) {
        $height = $width;
    }

    $processor = new WP_HTML_Tag_Processor($html);

    if (! $processor->next_tag('img')) {
        return $html;
    }

    $processor->set_attribute('width', (string) $width);
    $processor->set_attribute('height', (string) $height);
    $processor->set_attribute('decoding', 'async');
    $processor->set_attribute('fetchpriority', 'high');

    return $processor->get_updated_html();
}, 10, 2);

add_filter('woocommerce_loop_add_to_cart_link', function (string $html, $product, array $args): string {
    if (! $product instanceof WC_Product || is_product()) {
        return $html;
    }

    return sprintf(
        '<a href="%s" aria-label="%s" class="%s">%s</a>',
        esc_url($product->get_permalink()),
        esc_attr(sprintf(__('Vezi detalii pentru %s', 'linamira'), $product->get_name())),
        esc_attr('button lm-product-card__details'),
        esc_html__('Vezi detalii', 'linamira')
    );
}, 10, 3);

add_filter('woocommerce_product_single_add_to_cart_text', function (string $text, ?WC_Product $product = null): string {
    unset($text);

    if (! $product instanceof WC_Product) {
        $product = function_exists('wc_get_product') ? wc_get_product(get_queried_object_id()) : null;
    }

    if ($product instanceof WC_Product && 'bundle' === get_post_meta($product->get_id(), '_linamira_product_kind', true)) {
        return esc_html__('Adaugă setul în coș', 'linamira');
    }

    return esc_html__('Adaugă în coș', 'linamira');
}, 10, 2);

add_filter('woocommerce_account_menu_items', function (array $items): array {
    unset($items['downloads']);

    $labels = [
        'dashboard' => __('Sumar cont', 'linamira'),
        'orders' => __('Comenzi', 'linamira'),
        'edit-address' => __('Adrese', 'linamira'),
        'edit-account' => __('Date cont', 'linamira'),
        'customer-logout' => __('Ieșire', 'linamira'),
    ];

    foreach ($labels as $key => $label) {
        if (isset($items[$key])) {
            $items[$key] = $label;
        }
    }

    return $items;
});

add_action('woocommerce_login_form_start', function (): void {
    echo '<p class="lm-account-login-note">' . esc_html__('Accesează contul Linamira pentru comenzi, adrese și detalii de livrare.', 'linamira') . '</p>';
});

add_action('woocommerce_before_account_navigation', function (): void {
    $titles = [
        'orders' => __('Comenzile tale', 'linamira'),
        'edit-address' => __('Adrese de livrare și facturare', 'linamira'),
        'edit-account' => __('Date cont', 'linamira'),
        'lost-password' => __('Resetare parolă', 'linamira'),
    ];

    $title = __('Sumar cont', 'linamira');

    foreach ($titles as $endpoint => $label) {
        if (function_exists('is_wc_endpoint_url') && is_wc_endpoint_url($endpoint)) {
            $title = $label;
            break;
        }
    }

    echo '<section class="lm-account-heading" aria-labelledby="lm-account-heading-title">';
    echo '<p class="lm-eyebrow">' . esc_html__('Contul Linamira', 'linamira') . '</p>';
    echo '<h1 id="lm-account-heading-title">' . esc_html($title) . '</h1>';
    echo '<p>' . esc_html__('Gestionează comenzile, adresele și detaliile contului tău într-un singur loc.', 'linamira') . '</p>';
    echo '</section>';
});

add_action('woocommerce_account_dashboard', function (): void {
    $links = [
        [
            'label' => __('Comenzi', 'linamira'),
            'text' => __('Vezi statusul comenzilor și istoricul cumpărăturilor.', 'linamira'),
            'url' => wc_get_account_endpoint_url('orders'),
        ],
        [
            'label' => __('Adrese', 'linamira'),
            'text' => __('Actualizează adresa de livrare și datele de facturare.', 'linamira'),
            'url' => wc_get_account_endpoint_url('edit-address'),
        ],
        [
            'label' => __('Date cont', 'linamira'),
            'text' => __('Schimbă numele, emailul sau parola contului tău.', 'linamira'),
            'url' => wc_get_account_endpoint_url('edit-account'),
        ],
    ];

    echo '<section class="lm-account-quicklinks" aria-labelledby="lm-account-quicklinks-title">';
    echo '<h2 id="lm-account-quicklinks-title">' . esc_html__('Acces rapid', 'linamira') . '</h2>';
    echo '<div class="lm-account-quicklinks__grid">';

    foreach ($links as $link) {
        echo '<a class="lm-account-quicklink" href="' . esc_url($link['url']) . '">';
        echo '<strong>' . esc_html($link['label']) . '</strong>';
        echo '<span>' . esc_html($link['text']) . '</span>';
        echo '</a>';
    }

    echo '</div>';
    echo '</section>';
});

add_filter('woocommerce_order_button_text', function (): string {
    return __('Comandă cu obligație de plată', 'linamira');
});

add_filter('woocommerce_product_tabs', function (array $tabs): array {
    if (isset($tabs['description'])) {
        $tabs['description']['title'] = __('Descriere', 'linamira');
    }

    if (isset($tabs['additional_information'])) {
        $tabs['additional_information']['title'] = __('Informații suplimentare', 'linamira');
    }

    unset($tabs['reviews']);

    return $tabs;
});

add_filter('woocommerce_product_description_heading', function (): string {
    return '';
});

add_filter('woocommerce_product_additional_information_heading', function (): string {
    return __('Informații suplimentare', 'linamira');
});

function linamira_get_single_product_info_items(WC_Product $product): array
{
    $product_id = $product->get_id();
    $kind = (string) get_post_meta($product_id, '_linamira_product_kind', true);
    $category_slugs = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'slugs']);

    if (is_wp_error($category_slugs)) {
        $category_slugs = [];
    }

    $product_name = strtolower(remove_accents($product->get_name()));
    $has_category = static fn (string $slug): bool => in_array($slug, $category_slugs, true);
    $name_contains = static fn (string $needle): bool => str_contains($product_name, strtolower(remove_accents($needle)));

    if ('bundle' === $kind || $has_category('seturi-cadou')) {
        return [
            [
                'label' => __('Potrivit pentru', 'linamira'),
                'text' => __('cadouri pentru casă, seri liniștite, răsfăț acasă', 'linamira'),
            ],
            [
                'label' => __('Detalii', 'linamira'),
                'text' => __('set atent ales cu produse pentru casă și răsfăț', 'linamira'),
            ],
            [
                'label' => __('Livrare', 'linamira'),
                'text' => __('2-3 zile lucrătoare', 'linamira'),
            ],
        ];
    }

    $items = [
        [
            'label' => __('Potrivit pentru', 'linamira'),
            'text' => __('cadouri simple, momente de răsfăț acasă, produse pentru casă', 'linamira'),
        ],
        [
            'label' => __('Detalii', 'linamira'),
            'text' => __('produs ales pentru casă și răsfăț', 'linamira'),
        ],
        [
            'label' => __('Livrare', 'linamira'),
            'text' => __('2-3 zile lucrătoare', 'linamira'),
        ],
    ];

    if ($has_category('accesorii-cadouri-mici') || $name_contains('arzator') || $name_contains('savoniera') || $name_contains('saculet') || $name_contains('tote') || $name_contains('neceser') || $name_contains('bratara')) {
        $items[0]['text'] = __('completarea unui cadou, organizare, detalii utile acasă', 'linamira');
        $items[1]['text'] = __('accesoriu practic pentru cadouri și folosire acasă', 'linamira');
    } elseif ($has_category('baie-dus')) {
        $items[0]['text'] = __('baie, duș, cadouri mici pentru răsfăț acasă', 'linamira');
        $items[1]['text'] = __('produs pentru baie, folosit conform instrucțiunilor', 'linamira');
    } elseif ($has_category('sapunuri')) {
        if ($name_contains('flori de sapun')) {
            $items[0]['text'] = __('cadouri mici, baie sau chiuvetă, decor parfumat discret', 'linamira');
            $items[1]['text'] = __('flori de săpun pentru cadou sau baie', 'linamira');
        } else {
            $items[0]['text'] = __('baie sau chiuvetă, completarea unui cadou, folosire zilnică', 'linamira');
            $items[1]['text'] = __('săpun parfumat pentru baie sau chiuvetă', 'linamira');
        }
    } elseif ($has_category('lumanari-ceara-parfumata')) {
        if ($name_contains('ceara') || $name_contains('tablete')) {
            $items[0]['text'] = __('arzătoare compatibile, living, seri liniștite acasă', 'linamira');
            $items[1]['text'] = __('ceară parfumată pentru parfumarea casei', 'linamira');
        } else {
            $items[0]['text'] = __('living, dormitor, cadouri simple pentru casă', 'linamira');
            $items[1]['text'] = __('lumânare parfumată pentru atmosferă caldă acasă', 'linamira');
        }
    } elseif ($has_category('difuzoare-de-arome')) {
        if ($name_contains('difuzor cu betisoare')) {
            $items[0]['text'] = __('parfumare treptată a camerei, living, hol sau baie', 'linamira');
            $items[1]['text'] = __('difuzor cu bețișoare pentru parfumare constantă', 'linamira');
        } elseif ($name_contains('ulei esential')) {
            $items[0]['text'] = __('difuzoare compatibile, spații aerisite, parfum discret', 'linamira');
            $items[1]['text'] = __('ulei esențial pentru folosire cu accesorii compatibile', 'linamira');
        } elseif ($name_contains('ulei')) {
            $items[0]['text'] = __('difuzoare compatibile, spații aerisite, parfum discret', 'linamira');
            $items[1]['text'] = __('ulei pentru difuzor sau aromatizator compatibil', 'linamira');
        }
    } elseif ($has_category('parfum-pentru-casa')) {
        if ($name_contains('spray')) {
            $items[0]['text'] = __('împrospătarea rapidă a camerei, hol, living sau dormitor', 'linamira');
            $items[1]['text'] = __('spray de cameră pentru parfumare rapidă', 'linamira');
        } elseif ($name_contains('ulei esential')) {
            $items[0]['text'] = __('difuzoare compatibile, spații aerisite, parfum discret', 'linamira');
            $items[1]['text'] = __('ulei esențial pentru folosire cu accesorii compatibile', 'linamira');
        } elseif ($name_contains('ulei')) {
            $items[0]['text'] = __('difuzoare sau arzătoare compatibile, parfumarea casei', 'linamira');
            $items[1]['text'] = __('ulei parfumat pentru casă, folosit conform instrucțiunilor', 'linamira');
        } else {
            $items[0]['text'] = __('parfumarea discretă a casei, living, dormitor sau hol', 'linamira');
            $items[1]['text'] = __('produs pentru parfumarea casei', 'linamira');
        }
    }

    return $items;
}

add_filter('render_block', function (string $block_content, array $block): string {
    if (! function_exists('is_product') || ! is_product() || 'woocommerce/product-meta' !== ($block['blockName'] ?? '')) {
        return $block_content;
    }

    $product = function_exists('wc_get_product') ? wc_get_product(get_queried_object_id()) : null;

    if (! $product instanceof WC_Product) {
        return $block_content;
    }

    $items = linamira_get_single_product_info_items($product);

    $info = '<div class="lm-product-info-list" aria-label="' . esc_attr__('Informații produs', 'linamira') . '">';

    foreach ($items as $item) {
        $info .= sprintf(
            '<div class="lm-product-info-item"><span>%s</span><p>%s</p></div>',
            esc_html($item['label']),
            esc_html($item['text'])
        );
    }

    $info .= '</div>';

    return $block_content . $info;
}, 10, 2);

add_filter('render_block', function (string $block_content, array $block): string {
    if ('woocommerce/product-image' !== ($block['blockName'] ?? '') || ! class_exists('WP_HTML_Tag_Processor')) {
        return $block_content;
    }

    $processor = new WP_HTML_Tag_Processor($block_content);

    while ($processor->next_tag('img')) {
        $style = (string) $processor->get_attribute('style');

        if ('' === $style || ! str_contains(strtolower($style), 'object-fit')) {
            continue;
        }

        $style = trim((string) preg_replace('/(?:^|;)\s*object-fit\s*:\s*[^;]+;?/i', ';', $style));
        $style = trim($style, " \t\n\r\0\x0B;");

        if ('' === $style) {
            $processor->remove_attribute('style');
        } else {
            $processor->set_attribute('style', $style);
        }
    }

    return $processor->get_updated_html();
}, 10, 2);

function linamira_is_product_archive_card_context(): bool
{
    return function_exists('is_shop')
        && (is_shop() || is_product_category() || is_product_tag() || is_product_taxonomy());
}

function linamira_get_loop_product(): ?WC_Product
{
    if (! function_exists('wc_get_product')) {
        return null;
    }

    $product_id = get_the_ID();

    if (! $product_id) {
        global $post;
        $product_id = $post instanceof WP_Post ? $post->ID : 0;
    }

    $product = $product_id ? wc_get_product($product_id) : null;

    return $product instanceof WC_Product ? $product : null;
}

function linamira_prepare_product_card_price_html(string $block_content): string
{
    if (! class_exists('WP_HTML_Tag_Processor')) {
        return $block_content;
    }

    $processor = new WP_HTML_Tag_Processor($block_content);

    if (! $processor->next_tag()) {
        return $block_content;
    }

    $processor->remove_class('has-font-size');
    $processor->remove_class('has-small-font-size');
    $processor->remove_class('has-text-align-center');
    $processor->remove_attribute('style');

    return $processor->get_updated_html();
}

add_filter('render_block', function (string $block_content, array $block): string {
    if (
        'woocommerce/product-price' !== ($block['blockName'] ?? '')
        || ! linamira_is_product_archive_card_context()
        || str_contains($block_content, 'lm-product-card__excerpt')
    ) {
        return $block_content;
    }

    $product = linamira_get_loop_product();

    if (! $product instanceof WC_Product) {
        return $block_content;
    }

    $excerpt = trim(wp_strip_all_tags($product->get_short_description()));

    if ('' === $excerpt) {
        return $block_content;
    }

    $excerpt = wp_trim_words($excerpt, 18, '...');
    $block_content = linamira_prepare_product_card_price_html($block_content);

    return '<p class="lm-product-card__excerpt">' . esc_html($excerpt) . '</p>' . $block_content;
}, 10, 2);

add_filter('woocommerce_catalog_orderby', function (array $options): array {
    $labels = [
        'menu_order' => 'Recomandate',
        'popularity' => 'Cele mai populare',
        'rating' => 'Cele mai apreciate',
        'date' => 'Cele mai noi',
        'price' => 'Preț: crescător',
        'price-desc' => 'Preț: descrescător',
        'relevance' => 'Relevanță',
    ];

    foreach ($labels as $key => $label) {
        if (isset($options[$key])) {
            $options[$key] = $label;
        }
    }

    return $options;
});

add_filter('woocommerce_breadcrumb_defaults', function (array $defaults): array {
    $defaults['home'] = 'Acasă';

    return $defaults;
});

add_filter('gettext_woocommerce', function (string $translation, string $text): string {
    return match ($text) {
        'Place order', 'Place Order' => 'Comandă cu obligație de plată',
        'Shop order' => 'Ordine produse',
        'Showing the single result' => 'Se afișează un singur rezultat',
        'Sort by' => 'Sortează după',
        default => $translation,
    };
}, 10, 2);

add_filter('ngettext_woocommerce', function (string $translation, string $single, string $plural, int $number): string {
    unset($plural);

    if ('Showing all %1$d result' === $single) {
        return 1 === $number ? 'Se afișează %1$d produs' : 'Se afișează toate cele %1$d produse';
    }

    return $translation;
}, 10, 4);

add_filter('ngettext_with_context_woocommerce', function (string $translation, string $single, string $plural, int $number): string {
    unset($plural);

    if ('Showing %1$d&ndash;%2$d of %3$d result' === $single) {
        return 1 === $number
            ? 'Se afișează %1$d&ndash;%2$d din %3$d produs'
            : 'Se afișează %1$d&ndash;%2$d din %3$d produse';
    }

    return $translation;
}, 10, 4);
